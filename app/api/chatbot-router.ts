import { z } from "zod";
import { eq, desc, and, count, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, chatRateLimitedQuery } from "./middleware";
import { logger } from "./lib/logger";
import { chatConversations, chatMessages } from "../db/schema";
import type { InsertChatConversation, InsertChatMessage } from "../db/schema";
import { getDb } from "./queries/connection";
import {
    getOpenRouterClient,
    buildSystemPrompt,
    DEFAULT_MODEL,
    type OpenRouterMessage,
    type OpenRouterTool,
} from "./services/openrouter";
import { env } from "./lib/env";

// ─── Schemas ────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
    conversationId: z.number().optional(),
    message: z.string().min(1).max(4000),
    model: z.enum(["openrouter/free", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-1.5-flash"]).optional(),
});

const conversationIdSchema = z.object({
    conversationId: z.number(),
});

const updateConversationSchema = z.object({
    conversationId: z.number(),
    title: z.string().min(1).max(255).optional(),
    isArchived: z.boolean().optional(),
});

// ─── Tool Definitions for Function Calling ──────────────────────────

// ─── Role-Based Tool Filtering ────────────────────────────────────────

/** Real-estate staff property tools */
const REAL_ESTATE_STAFF_TOOLS = new Set([
    "search_properties",
    "get_property_detail",
]);

/** Tools any signed-in user may use */
const BASE_USER_TOOLS = new Set([
    "get_user_info",
    "get_attendance_summary",
    "get_payroll_info",
    "navigate_to_page",
]);

const STAFF_TOOL_NAMES = new Set([...BASE_USER_TOOLS, ...REAL_ESTATE_STAFF_TOOLS]);
const DEVELOPER_TOOL_NAMES = new Set([...BASE_USER_TOOLS]);
const ARCHITECTURE_STAFF_TOOL_NAMES = new Set([...BASE_USER_TOOLS]);

/** Filter tools based on user role */
function getAllowedTools(role: string | undefined): OpenRouterTool[] {
    if (role === "admin") {
        return CHAT_TOOLS;
    }
    if (role === "staff") {
        return CHAT_TOOLS.filter((t) => STAFF_TOOL_NAMES.has(t.function.name));
    }
    if (role === "developer") {
        return CHAT_TOOLS.filter((t) => DEVELOPER_TOOL_NAMES.has(t.function.name));
    }
    if (role === "architecture_staff") {
        return CHAT_TOOLS.filter((t) => ARCHITECTURE_STAFF_TOOL_NAMES.has(t.function.name));
    }
    return CHAT_TOOLS.filter((t) => BASE_USER_TOOLS.has(t.function.name));
}

function isAdminRole(role?: string): boolean {
    return role === "admin";
}

function assertOwnUserData(
    ctx: { unifiedUser?: { id: number; role: string } },
    targetUserId: number,
): string | null {
    if (isAdminRole(ctx.unifiedUser?.role)) return null;
    if (targetUserId !== ctx.unifiedUser?.id) {
        return "You can only access your own information.";
    }
    return null;
}

const NAV_PAGE_ROUTES: Record<string, string> = {
    dashboard: "/",
    properties: "/properties",
    "property-types": "/property-types",
    documents: "/documents",
    billing: "/billing",
    approvals: "/approvals",
    users: "/users",
    attendance: "/attendance",
    payroll: "/payroll",
    reports: "/reports",
    notifications: "/notifications",
    "activity-logs": "/activity-logs",
    profile: "/profile",
    settings: "/settings",
    "software-dev": "/software-dev",
    architecture: "/architecture",
};

const STAFF_ALLOWED_PAGES = new Set([
    "dashboard", "properties", "documents", "billing", "attendance", "payroll",
    "notifications", "profile", "settings",
]);

const DEVELOPER_ALLOWED_PAGES = new Set([
    "dashboard", "software-dev", "attendance", "payroll", "notifications", "profile", "settings",
]);

const ARCHITECTURE_ALLOWED_PAGES = new Set([
    "dashboard", "architecture", "attendance", "payroll", "notifications", "profile", "settings",
]);

function resolveNavPath(page: string, role?: string): string | null {
    if (page === "dashboard") {
        if (role === "developer") return "/software-dev";
        if (role === "architecture_staff") return "/architecture";
        return "/";
    }
    return NAV_PAGE_ROUTES[page] ?? null;
}

function isPageAllowedForRole(page: string, role?: string): boolean {
    if (isAdminRole(role)) return true;
    if (role === "staff") return STAFF_ALLOWED_PAGES.has(page);
    if (role === "developer") return DEVELOPER_ALLOWED_PAGES.has(page);
    if (role === "architecture_staff") return ARCHITECTURE_ALLOWED_PAGES.has(page);
    return false;
}

const CHAT_TOOLS: OpenRouterTool[] = [
    {
        type: "function",
        function: {
            name: "search_properties",
            description: "Search for properties in the real estate system by name, address, owner, or status",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search by property name, address, or owner name" },
                    status: { type: "string", enum: ["draft", "submitted", "approved", "rejected", "completed", "cancelled"], description: "Filter by approval status" },
                    limit: { type: "number", description: "Maximum results (max 10)", default: 5 },
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_property_detail",
            description: "Get full details and workflow progress for a specific property by its ID",
            parameters: {
                type: "object",
                properties: {
                    propertyId: { type: "number", description: "The property ID" },
                },
                required: ["propertyId"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_pending_approvals",
            description: "Get properties that are pending admin review/approval",
            parameters: {
                type: "object",
                properties: {
                    limit: { type: "number", description: "Maximum results", default: 10 },
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_system_stats",
            description: "Get current system statistics like property counts, user counts, attendance, and payroll totals",
            parameters: {
                type: "object",
                properties: {
                    statType: {
                        type: "string",
                        enum: ["properties", "users", "attendance", "payroll", "all"],
                        description: "Type of statistics to retrieve",
                    },
                },
                required: ["statType"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_user_info",
            description: "Get information about the currently logged-in user (name, role, permissions)",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_attendance_summary",
            description: "Get attendance summary for a staff member for the current or a specific month",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "number", description: "User ID (defaults to current user)" },
                    month: { type: "string", description: "Month in YYYY-MM format (defaults to current month)" },
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_payroll_info",
            description: "Get payroll information for a staff member for a specific month",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "number", description: "User ID (defaults to current user)" },
                    month: { type: "string", description: "Month in YYYY-MM format (defaults to current month)" },
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_users_list",
            description: "List all staff/users in the system (admin only)",
            parameters: {
                type: "object",
                properties: {
                    role: { type: "string", enum: ["admin", "staff", "developer", "architecture_staff"], description: "Filter by role" },
                    limit: { type: "number", description: "Maximum results", default: 20 },
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "navigate_to_page",
            description: "Suggest navigation to a specific page in the application",
            parameters: {
                type: "object",
                properties: {
                    page: {
                        type: "string",
                        enum: [
                            "dashboard", "properties", "property-types", "documents", "billing",
                            "approvals", "users", "attendance", "payroll", "reports",
                            "notifications", "activity-logs", "profile", "settings",
                            "software-dev", "architecture",
                        ],
                        description: "The page to navigate to",
                    },
                    reason: { type: "string", description: "Why this navigation is helpful" },
                },
                required: ["page"],
            },
        },
    },
];

// ─── Tool Handler ───────────────────────────────────────────────────

async function executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    ctx: { unifiedUser?: { id: number; name: string; role: string } },
): Promise<string> {
    const db = getDb();

    switch (toolName) {
        case "get_user_info": {
            return JSON.stringify({
                id: ctx.unifiedUser?.id,
                name: ctx.unifiedUser?.name,
                role: ctx.unifiedUser?.role,
                message: `You are logged in as ${ctx.unifiedUser?.name} with role ${ctx.unifiedUser?.role}.`,
            });
        }

        case "search_properties": {
            try {
                const { query, status, limit = 5 } = args as {
                    query?: string;
                    status?: string;
                    limit?: number;
                };
                const { properties } = await import("../db/schema");
                const conditions = [];

                // Real-estate staff (staff + admin) can search ALL properties
                if (ctx.unifiedUser?.role && !isAdminRole(ctx.unifiedUser.role) && ctx.unifiedUser.role !== "staff") {
                    return JSON.stringify({ error: "Access denied" });
                }

                if (status) {
                    conditions.push(sql`${properties.approvalStatus} = ${status}`);
                }
                if (query) {
                    const q = `%${query as string}%`;
                    conditions.push(
                        or(
                            like(properties.propertyName, q),
                            like(properties.address, q),
                            like(properties.ownerName, q),
                        ),
                    );
                }
                const results = await db.select({
                    id: properties.id,
                    propertyName: properties.propertyName,
                    address: properties.address,
                    approvalStatus: properties.approvalStatus,
                    sellingPrice: properties.sellingPrice,
                    ownerName: properties.ownerName,
                    currentStep: properties.currentStep,
                }).from(properties)
                    .where(conditions.length > 0 ? and(...conditions) : undefined)
                    .limit(Math.min(limit as number, 10));

                return JSON.stringify({
                    count: results.length,
                    properties: results.map((p) => ({
                        id: p.id,
                        name: p.propertyName,
                        address: p.address,
                        status: p.approvalStatus,
                        price: p.sellingPrice,
                        owner: p.ownerName,
                        step: p.currentStep,
                    })),
                });
            } catch (err) {
                return JSON.stringify({ error: "Failed to search properties", details: String(err) });
            }
        }

        case "get_property_detail": {
            try {
                const { propertyId } = args as { propertyId: number };
                const { properties } = await import("../db/schema");
                const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
                if (!property) return JSON.stringify({ error: "Property not found" });

                const isAdmin = isAdminRole(ctx.unifiedUser?.role);
                // Real-estate staff (staff + admin) can view details of ALL properties
                if (!isAdmin && ctx.unifiedUser?.role !== "staff") {
                    return JSON.stringify({ error: "Access denied" });
                }

                // Real-estate staff (staff + admin) see the full data of all properties;
                // admin-only internal notes stay restricted to admins.
                return JSON.stringify({
                    id: property.id,
                    name: property.propertyName,
                    address: property.address,
                    owner: property.ownerName,
                    ownerCID: property.ownerCID,
                    ownerPhone: property.ownerPhone,
                    buyer: property.buyerName,
                    buyerCID: property.buyerCID,
                    sellingPrice: property.sellingPrice,
                    fee: property.realEstateFee,
                    status: property.approvalStatus,
                    workflowStatus: property.workflowStatus,
                    currentStep: property.currentStep,
                    isSold: property.isSold,
                    listedBy: property.listedById,
                    adminNotes: isAdmin ? property.adminNotes : null,
                    rejectionComments: property.rejectionComments,
                    completedAt: property.completedAt,
                    createdAt: property.createdAt,
                });
            } catch (err) {
                return JSON.stringify({ error: "Failed to get property detail", details: String(err) });
            }
        }

        case "get_pending_approvals": {
            // SECURITY: Admin-only tool
            if (ctx.unifiedUser?.role !== "admin") {
                return JSON.stringify({ error: "Access denied. Only admins can view pending approvals." });
            }
            try {
                const { limit = 10 } = args as { limit?: number };
                const { properties } = await import("../db/schema");
                const results = await db.select({
                    id: properties.id,
                    propertyName: properties.propertyName,
                    address: properties.address,
                    approvalStatus: properties.approvalStatus,
                    currentStep: properties.currentStep,
                    ownerName: properties.ownerName,
                }).from(properties)
                    .where(eq(properties.approvalStatus, "pending_review"))
                    .limit(Math.min(limit as number, 20));
                return JSON.stringify({
                    count: results.length,
                    properties: results,
                });
            } catch (err) {
                return JSON.stringify({ error: "Failed to get pending approvals", details: String(err) });
            }
        }

        case "get_system_stats": {
            // SECURITY: Admin-only tool
            if (ctx.unifiedUser?.role !== "admin") {
                return JSON.stringify({ error: "Access denied. Only admins can view system statistics." });
            }
            try {
                const { statType } = args as { statType: string };
                const { properties, localUsers, attendance, payroll } = await import("../db/schema");
                const stats: Record<string, unknown> = {};

                if (statType === "all" || statType === "properties") {
                    const totalResult = await db.select({ count: count() }).from(properties);
                    const byStatusResult = await db.select({ status: properties.approvalStatus, count: count() }).from(properties).groupBy(properties.approvalStatus);
                    const byStatus: Record<string, number> = {};
                    for (const s of byStatusResult) {
                        byStatus[s.status] = s.count;
                    }
                    stats.properties = { total: totalResult[0]?.count || 0, byStatus };
                }

                if (statType === "all" || statType === "users") {
                    const totalResult = await db.select({ count: count() }).from(localUsers);
                    const byRoleResult = await db.select({ role: localUsers.role, count: count() }).from(localUsers).groupBy(localUsers.role);
                    const byRole: Record<string, number> = {};
                    for (const r of byRoleResult) {
                        byRole[r.role] = r.count;
                    }
                    stats.users = { total: totalResult[0]?.count || 0, byRole };
                }

                if (statType === "all" || statType === "attendance") {
                    const totalResult = await db.select({ count: count() }).from(attendance);
                    stats.attendance = { totalRecords: totalResult[0]?.count || 0 };
                }

                if (statType === "all" || statType === "payroll") {
                    const totalResult = await db.select({ count: count() }).from(payroll);
                    stats.payroll = { totalRecords: totalResult[0]?.count || 0 };
                }

                return JSON.stringify(stats);
            } catch (err) {
                return JSON.stringify({ error: "Failed to get stats", details: String(err) });
            }
        }

        case "get_attendance_summary": {
            try {
                const { userId, month } = args as { userId?: number; month?: string };
                const { attendance } = await import("../db/schema");
                const targetMonth = month || new Date().toISOString().slice(0, 7);
                const targetUserId = userId || ctx.unifiedUser?.id;
                if (!targetUserId) return JSON.stringify({ error: "User ID not found" });

                const accessError = assertOwnUserData(ctx, targetUserId as number);
                if (accessError) return JSON.stringify({ error: accessError });

                // attendance.date is stored as string (YYYY-MM-DD), use string comparison
                const startDateStr = `${targetMonth}-01`;
                const endDateStr = new Date(Number(targetMonth.split("-")[0]), Number(targetMonth.split("-")[1]), 1).toISOString().slice(0, 10);

                const records = await db.select().from(attendance)
                    .where(
                        and(
                            eq(attendance.userId, targetUserId as number),
                            sql`${attendance.date} >= ${startDateStr}`,
                            sql`${attendance.date} < ${endDateStr}`,
                        ),
                    )
                    .orderBy(attendance.date);

                const byStatus: Record<string, number> = {};
                for (const r of records) {
                    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
                }

                return JSON.stringify({
                    userId: targetUserId,
                    month: targetMonth,
                    total: records.length,
                    byStatus,
                    records: records.map(r => ({
                        date: r.date,
                        checkIn: r.checkIn,
                        checkOut: r.checkOut,
                        status: r.status,
                    })),
                });
            } catch (err) {
                return JSON.stringify({ error: "Failed to get attendance summary", details: String(err) });
            }
        }

        case "get_payroll_info": {
            try {
                const { userId, month } = args as { userId?: number; month?: string };
                const { payroll } = await import("../db/schema");
                const targetUserId = userId || ctx.unifiedUser?.id;
                if (!targetUserId) return JSON.stringify({ error: "User ID not found" });

                const accessError = assertOwnUserData(ctx, targetUserId as number);
                if (accessError) return JSON.stringify({ error: accessError });

                const records = await db.select().from(payroll)
                    .where(eq(payroll.userId, targetUserId as number))
                    .orderBy(payroll.month)
                    .limit(12);

                let filtered = records;
                if (month) {
                    filtered = records.filter(r => String(r.month).startsWith(month));
                }

                return JSON.stringify({
                    userId: targetUserId,
                    count: filtered.length,
                    records: filtered.map(r => ({
                        month: r.month,
                        baseSalary: r.baseSalary,
                        bonus: r.bonus,
                        deduction: r.deduction,
                        netSalary: r.netSalary,
                        pfDeduction: r.pfDeduction,
                        paymentStatus: r.paymentStatus,
                        paidAt: r.paidAt,
                    })),
                });
            } catch (err) {
                return JSON.stringify({ error: "Failed to get payroll info", details: String(err) });
            }
        }

        case "get_users_list": {
            // SECURITY: Admin-only tool
            if (ctx.unifiedUser?.role !== "admin") {
                return JSON.stringify({ error: "Access denied. Only admins can list users." });
            }
            try {
                const { role: roleFilter, limit = 20 } = args as { role?: string; limit?: number };
                const { localUsers } = await import("../db/schema");
                const query = db.select({
                    id: localUsers.id,
                    fullName: localUsers.fullName,
                    email: localUsers.email,
                    role: localUsers.role,
                    status: localUsers.status,
                    phone: localUsers.phone,
                    employeeId: localUsers.employeeId,
                }).from(localUsers);

                const results = roleFilter
                    ? await query.where(eq(localUsers.role, roleFilter as "admin" | "staff" | "developer" | "architecture_staff")).limit(Math.min(limit as number, 50))
                    : await query.limit(Math.min(limit as number, 50));

                return JSON.stringify({ count: results.length, users: results });
            } catch (err) {
                return JSON.stringify({ error: "Failed to get users list", details: String(err) });
            }
        }

        case "navigate_to_page": {
            const { page, reason } = args as { page: string; reason?: string };
            const role = ctx.unifiedUser?.role;

            if (!isPageAllowedForRole(page, role)) {
                return JSON.stringify({
                    error: `Access denied. The page "${page}" is not available for your role.`,
                });
            }

            const path = resolveNavPath(page, role);
            if (!path) {
                return JSON.stringify({ error: `Unknown page: ${page}` });
            }

            return JSON.stringify({
                action: "navigate",
                page: path,
                label: page.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                reason: reason || `Navigating to ${page}`,
            });
        }

        default:
            return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
}

// ─── Router ─────────────────────────────────────────────────────────

export const chatbotRouter = createRouter({
    // ── List user's conversations ───────────────────────────────────
    conversations: authedQuery.query(async (opts) => {
        const db = getDb();
        const userId = opts.ctx.unifiedUser!.id;

        const conversations = await db
            .select()
            .from(chatConversations)
            .where(
                and(
                    eq(chatConversations.userId, userId),
                    eq(chatConversations.isArchived, false),
                ),
            )
            .orderBy(desc(chatConversations.updatedAt))
            .limit(50);

        return conversations;
    }),

    // ── Get single conversation with messages ───────────────────────
    conversation: authedQuery.input(conversationIdSchema).query(async (opts) => {
        const db = getDb();
        const userId = opts.ctx.unifiedUser!.id;
        const { conversationId } = opts.input;

        const [conv] = await db
            .select()
            .from(chatConversations)
            .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
            .limit(1);

        if (!conv) return null;

        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.conversationId, conversationId))
            .orderBy(chatMessages.createdAt)
            .limit(200);

        return { ...conv, messages };
    }),

    // ── Update conversation (title, archive) ────────────────────────
    updateConversation: authedQuery.input(updateConversationSchema).mutation(async (opts) => {
        const db = getDb();
        const userId = opts.ctx.unifiedUser!.id;
        const { conversationId, ...updates } = opts.input;

        await db
            .update(chatConversations)
            .set(updates)
            .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));

        return { success: true };
    }),

    // ── Delete conversation ─────────────────────────────────────────
    deleteConversation: authedQuery.input(conversationIdSchema).mutation(async (opts) => {
        const db = getDb();
        const userId = opts.ctx.unifiedUser!.id;
        const { conversationId } = opts.input;

        await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
        await db.delete(chatConversations).where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));

        return { success: true };
    }),

    // ── Send message (non-streaming fallback) ───────────────────────
    sendMessage: chatRateLimitedQuery.input(sendMessageSchema).mutation(async (opts) => {
        const db = getDb();
        const userId = opts.ctx.unifiedUser!.id;
        const { conversationId, message, model } = opts.input;
        const selectedModel = model || DEFAULT_MODEL;

        if (!env.openrouterApiKey?.trim()) {
            throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "AI assistant is not configured. Please ask an administrator to set OPENROUTER_API_KEY.",
            });
        }

        // Create or get conversation
        let convId = conversationId;
        if (!convId) {
            const title = message.slice(0, 80) + (message.length > 80 ? "..." : "");
            const result = await db
                .insert(chatConversations)
                .values({
                    userId,
                    title,
                    model: selectedModel || "auto",
                    systemPrompt: buildSystemPrompt({
                        userName: opts.ctx.unifiedUser?.name,
                        userRole: opts.ctx.unifiedUser?.role,
                    }),
                } as InsertChatConversation);
            convId = Number(result[0].insertId);
        } else {
            const [conv] = await db
                .select()
                .from(chatConversations)
                .where(and(eq(chatConversations.id, convId), eq(chatConversations.userId, userId)))
                .limit(1);
            if (!conv) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
            }
        }

        // Save user message
        await db.insert(chatMessages).values({
            conversationId: convId,
            role: "user",
            content: message,
        } as InsertChatMessage);

        // Get conversation history
        const history = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.conversationId, convId))
            .orderBy(chatMessages.createdAt)
            .limit(50);

        const [conv] = await db
            .select()
            .from(chatConversations)
            .where(eq(chatConversations.id, convId))
            .limit(1);

        // Build messages array
        const messages: OpenRouterMessage[] = [];

        if (conv?.systemPrompt) {
            messages.push({ role: "system", content: conv.systemPrompt });
        } else {
            messages.push({
                role: "system",
                content: buildSystemPrompt({
                    userName: opts.ctx.unifiedUser?.name,
                    userRole: opts.ctx.unifiedUser?.role,
                }),
            });
        }

        for (const msg of history) {
            // Parse toolCalls if stored as string (Drizzle JSON field quirk)
            let parsedToolCalls: OpenRouterMessage["tool_calls"] | undefined;
            if (msg.toolCalls) {
                if (typeof msg.toolCalls === "string") {
                    try {
                        parsedToolCalls = JSON.parse(msg.toolCalls) as OpenRouterMessage["tool_calls"];
                    } catch {
                        parsedToolCalls = undefined;
                    }
                } else {
                    parsedToolCalls = msg.toolCalls as OpenRouterMessage["tool_calls"];
                }
            }

            messages.push({
                role: msg.role as OpenRouterMessage["role"],
                content: msg.content,
                tool_calls: parsedToolCalls,
                tool_call_id: msg.toolCallId || undefined,
                name: msg.toolName || undefined,
            });
        }

        // Call OpenRouter
        const client = getOpenRouterClient();
        let fullResponse = "";
        let totalTokens = 0;

        try {
            // First attempt with tools
            // SECURITY: Filter tools by role so AI cannot call admin tools for staff
            const allowedTools = getAllowedTools(opts.ctx.unifiedUser?.role);
            logger.info("Chatbot calling OpenRouter", { model: selectedModel, messageCount: messages.length, role: opts.ctx.unifiedUser?.role, toolCount: allowedTools.length });
            const response = await client.complete({
                model: selectedModel,
                messages,
                tools: allowedTools,
                tool_choice: "auto",
                temperature: 0.7,
                max_tokens: 2000,
            });
            logger.info("Chatbot OpenRouter response", { hasChoices: !!response.choices, choiceCount: response.choices?.length });

            if (!response.choices || response.choices.length === 0) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No response from AI model" });
            }

            const choice = response.choices[0];
            totalTokens = response.usage?.total_tokens || 0;

            if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                // Save assistant message with tool calls
                await db.insert(chatMessages).values({
                    conversationId: convId,
                    role: "assistant",
                    content: choice.message.content || "",
                    toolCalls: choice.message.tool_calls,
                    tokensUsed: response.usage?.completion_tokens,
                });

                // Add assistant message to history ONCE before processing tools
                messages.push({
                    role: "assistant",
                    content: choice.message.content,
                    tool_calls: choice.message.tool_calls,
                });

                // Execute tool calls
                for (const tc of choice.message.tool_calls) {
                    let args: Record<string, unknown> = {};
                    try {
                        args = JSON.parse(tc.function.arguments);
                    } catch { /* empty args */ }

                    const result = await executeToolCall(tc.function.name, args, opts.ctx);

                    // Save tool result
                    await db.insert(chatMessages).values({
                        conversationId: convId,
                        role: "tool",
                        content: result,
                        toolCallId: tc.id,
                        toolName: tc.function.name,
                    } as InsertChatMessage);

                    // Add tool result to messages for final response
                    messages.push({
                        role: "tool",
                        content: result,
                        tool_call_id: tc.id,
                    });
                }

                // Get final response after tool calls
                const finalResponse = await client.complete({
                    model: selectedModel,
                    messages,
                    temperature: 0.7,
                    max_tokens: 2000,
                });

                if (!finalResponse.choices || finalResponse.choices.length === 0) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No response from AI model" });
                }

                fullResponse = finalResponse.choices[0].message.content || "";
                totalTokens += finalResponse.usage?.total_tokens || 0;
            } else {
                fullResponse = choice.message.content || "";
            }

            // Save assistant response
            await db.insert(chatMessages).values({
                conversationId: convId,
                role: "assistant",
                content: fullResponse,
                tokensUsed: totalTokens,
            } as InsertChatMessage);

            // Update conversation timestamp
            await db
                .update(chatConversations)
                .set({ updatedAt: new Date() })
                .where(eq(chatConversations.id, convId));

            return {
                conversationId: convId,
                message: fullResponse,
                tokensUsed: totalTokens,
            };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            const errorStack = err instanceof Error ? err.stack : "";
            logger.error("Chatbot message processing failed", { error: errorMsg, stack: errorStack, conversationId: convId });

            // Friendly error messages for common issues
            let friendlyMessage = "I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.";
            if (errorMsg.includes("429") || errorMsg.includes("Rate limit")) {
                friendlyMessage = "The AI service is currently at its daily usage limit. Please try again tomorrow.";
            } else if (errorMsg.includes("401")) {
                friendlyMessage = "The AI service authentication failed. Please contact the developer (Keshab) to check the OpenRouter API key.";
            } else if (errorMsg.includes("500") || errorMsg.includes("Provider returned error")) {
                friendlyMessage = "The AI service is temporarily unavailable. Please try again in a few moments.";
            }

            // Save error as assistant message
            await db.insert(chatMessages).values({
                conversationId: convId,
                role: "assistant",
                content: friendlyMessage,
            });

            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: friendlyMessage,
            });
        }
    }),
});

export type ChatbotRouter = typeof chatbotRouter;