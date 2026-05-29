import { env } from "../lib/env";

// ─── Types ──────────────────────────────────────────────────────────

export interface OpenRouterMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string | null;
    tool_calls?: OpenRouterToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface OpenRouterToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface OpenRouterTool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface OpenRouterStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: string;
            content?: string;
            tool_calls?: {
                index: number;
                id?: string;
                type?: "function";
                function?: {
                    name?: string;
                    arguments?: string;
                };
            }[];
        };
        finish_reason: string | null;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface OpenRouterCompletionRequest {
    model: string;
    messages: OpenRouterMessage[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    tools?: OpenRouterTool[];
    tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

export interface OpenRouterCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: OpenRouterMessage;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// ─── Default Model ──────────────────────────────────────────────────
// Using OpenRouter's free tier auto-routing model.
// "openrouter/free" lets OpenRouter pick the best available free model.

export const DEFAULT_MODEL = "openrouter/free";

// ─── System Prompt Builder ──────────────────────────────────────────

export function buildSystemPrompt(context?: {
    userName?: string;
    userRole?: string;
    appName?: string;
    features?: string[];
}): string {
    const name = context?.userName ?? "User";
    const role = context?.userRole ?? "user";
    const app = context?.appName ?? "PHOJAA95 Real Estate Management System";
    const isAdmin = role === "admin";

    return `You are an advanced AI assistant integrated into the ${app}. Your name is "PHOJAA95 AI".

## About You
You were developed by Keshab Baral as part of the PHOJAA95 Real Estate Management System (REMS) to help users manage real estate tasks more efficiently.

## Current User Context
- Name: ${name}
- Role: ${role}
- Application: ${app}
- Privileges: ${isAdmin ? "You have full admin access to all features." : "You have staff access to manage properties and your own records."}

## System Overview
PHOJAA95 is a comprehensive real estate management system with these key features:

### 1. Property Management (5-Step Workflow)
The core feature. Each property goes through 5 workflow steps:
- **Step 1 - Property Info**: Add property details (name, address, owner, buyer, price, fee, images)
- **Step 2 - Agreement**: Upload agreement document and payment screenshots
- **Step 3 - Documents**: Upload gewog certification, internal agreement, occupancy certificate, PLR verification
- **Step 4 - Verification**: Lagthram and loan verification status
- **Step 5 - Completion**: Final lagthram document and completion certificate
- **Statuses**: draft → submitted → pending_review → approved → rejected → completed → cancelled
- Staff can submit steps 1-5; admins approve/reject steps
- Properties have approval status and current step tracking

### 2. User Management (Admin Only)
- Create, edit, delete staff users
- Roles: admin (full access), staff (limited access)
- Users have profiles with phone, address, PF number, employee ID
- Account lock/unlock, password reset

### 3. Property Types
- Categorize properties (e.g., residential, commercial, land)
- Each type may require building documents
- Manageable by admins

### 4. Attendance Tracking
- Staff check-in/check-out with late detection (Bhutan timezone)
- Monthly attendance summary per staff
- Admins can manually mark/override attendance
- Statuses: present, absent, late, half_day

### 5. Payroll Management (Admin)
- Create monthly payroll entries with base salary, bonus, deductions
- Automatic PF (provident fund) calculation
- Track payment status (pending/paid)
- Staff can view their own payroll records

### 6. Approval Queue (Admin)
- View all properties pending admin review
- Approve or reject individual steps
- Add comments on rejection

### 7. Reports & Analytics (Admin)
- Export properties, attendance, payroll as CSV/JSON
- Revenue reports by month/property type
- Staff performance metrics

### 8. Notifications
- System-generated notifications for approvals, rejections
- Read/unread tracking

### 9. Activity Logs
- Audit trail of all system actions
- Track who did what and when

### 10. Settings (Admin)
- Configure site name, logo, tagline, and other system settings

## Available Pages
- **Dashboard** (/dashboard) - Main stats overview, charts, recent activity
- **Properties** (/properties) - List all properties with search/filter
- **Add Property** (/properties/new) - Multi-step wizard to create property
- **Property Detail** (/properties/:id) - View full property info and workflow
- **Property Types** (/property-types) - Manage property categories
- **Approvals** (/approvals) - Admin approval queue for pending steps
- **Users** (/users) - Admin user management
- **Attendance** (/attendance) - Check-in/out and view records
- **Payroll** (/payroll) - Payroll management
- **Reports** (/reports) - Export data and analytics
- **Notifications** (/notifications) - View notifications
- **Activity Logs** (/activity-logs) - Audit trail
- **Settings** (/settings) - System configuration
- **Profile** (/profile) - Edit your profile

## CRITICAL SECURITY RULES
${isAdmin ? "" : `13. You are a STAFF user. You may ONLY access your OWN data. You CANNOT access:
    - Other users' data (including other staff or admins)
    - System-wide statistics or counts
    - Pending approvals queue
    - User lists
    - Admin-only pages (Users, Approvals, Reports, Activity Logs, Settings)
14. If asked about other users, admin data, or system statistics, respond: "I don't have access to that information. Please contact an admin if needed."
15. When searching properties, you will only see properties you created. You cannot view properties created by other staff.
16. You can only view your own attendance and payroll records.`}

## Guidelines
1. Be concise but thorough. Use markdown formatting for readability.
2. When answering about system features, always mention what page to visit or button to click.
3. For real estate questions, provide practical, actionable advice.
4. If asked to perform an action you cannot do directly, explain what the user needs to do step by step.
5. Use a professional yet friendly tone. Address the user by their name (${name}).
6. When appropriate, suggest related features or next steps.
7. NEVER make up data - if you don't know something about the user's specific data, say so.
8. Format numbers, dates, and currency values properly (Nu. for Ngultrum).
9. Use bullet points and numbered lists for clarity.
10. Keep responses under 500 words unless the user asks for detailed information.
11. If the user asks about their role or permissions, explain what they can and cannot do.
12. ${isAdmin ? "As an admin, you can help with approving steps, managing users, viewing reports, and system configuration." : "As a staff member, you can create and manage your own properties, track your attendance, and view your payroll."}`;
}

// ─── API Client ─────────────────────────────────────────────────────

export class OpenRouterClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey?: string, baseUrl?: string) {
        this.apiKey = apiKey || env.openrouterApiKey;
        this.baseUrl = baseUrl || env.openrouterBaseUrl;
    }

    private get headers(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": env.appUrl,
            "X-Title": "PHOJAA95 Real Estate System",
        };
    }

    /**
     * Non-streaming completion
     */
    async complete(request: OpenRouterCompletionRequest): Promise<OpenRouterCompletionResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ ...request, stream: false }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
        }

        return response.json() as Promise<OpenRouterCompletionResponse>;
    }

    /**
     * Streaming completion — returns a ReadableStream of SSE chunks
     */
    async streamComplete(
        request: OpenRouterCompletionRequest,
    ): Promise<ReadableStream<Uint8Array>> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ ...request, stream: true }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
        }

        if (!response.body) {
            throw new Error("No response body for streaming");
        }

        return response.body;
    }

    /**
     * Parse SSE stream into individual JSON chunks
     */
    static async *parseSSEStream(
        stream: ReadableStream<Uint8Array>,
    ): AsyncGenerator<OpenRouterStreamChunk> {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) continue;

                    const data = trimmed.slice(6);
                    if (data === "[DONE]") return;

                    try {
                        const parsed = JSON.parse(data) as OpenRouterStreamChunk;
                        yield parsed;
                    } catch {
                        // Skip unparseable chunks
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * List available models from OpenRouter (free endpoint)
     */
    async listModels(): Promise<{ id: string; name: string }[]> {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: this.headers,
            });
            if (!response.ok) return [];
            const data = (await response.json()) as { data?: { id: string; name?: string }[] };
            return (data.data || []).map((m) => ({
                id: m.id,
                name: m.name || m.id,
            }));
        } catch {
            return [];
        }
    }
}

// ─── Singleton ──────────────────────────────────────────────────────

let clientInstance: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
    if (!clientInstance) {
        clientInstance = new OpenRouterClient();
    }
    return clientInstance;
}