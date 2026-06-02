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
    const isStaff = role === "staff";
    const isDeveloper = role === "developer";
    const isArchitectureStaff = role === "architecture_staff";

    const roleLabel = isAdmin
        ? "Administrator"
        : isDeveloper
          ? "Software Developer"
          : isArchitectureStaff
            ? "Architecture Staff"
            : isStaff
              ? "Real Estate Staff"
              : role;

    const privileges = isAdmin
        ? "Full admin access to all modules."
        : isDeveloper
          ? "Software Development module access. Create products, projects, sales, and customers. Admins approve submissions."
          : isArchitectureStaff
            ? "Architecture Management module access. Manage portfolio projects, customers, orders, and documents. Admins approve submissions."
            : isStaff
              ? "Real estate staff access. Manage your own properties, attendance, and payroll."
              : "Limited access based on assigned role.";

    const securityRules = isAdmin
        ? ""
        : `
## CRITICAL SECURITY RULES
- You may ONLY access data belonging to the current user unless the user is an admin.
- Never reveal other users' personal data, payroll, attendance, or records.
- If asked about admin-only data (system stats, user lists, pending approvals), say: "I don't have access to that. Please contact an admin."
${isStaff ? "- When searching properties, only properties created by this user are visible." : ""}
${isDeveloper ? "- You help with the Software Development module: products, projects, customers, sales, payments, invoices, certificates, documents, and payroll." : ""}
${isArchitectureStaff ? "- You help with Architecture Management: portfolio projects, customers, design orders, payments, invoices, certificates, documents, and payroll." : ""}
- Users can only view their own attendance and payroll unless they are admin.`;

    const roleGuidance = isAdmin
        ? "Help with approvals, users, reports, and all modules including Real Estate, Architecture, and Software Development."
        : isDeveloper
          ? "Guide users through Software Dev workflows: draft → submit for approval → admin approves → payments/invoices → project completion."
          : isArchitectureStaff
            ? "Guide users through Architecture workflows: customers → portfolio projects → orders → payments → certificates."
            : "Help create and manage properties through the 5-step workflow, attendance, and payroll.";

    return `You are "PHOJAA95 AI", an assistant integrated into ${app}. Developed by Keshab Baral.

## Current User
- Name: ${name}
- Role: ${roleLabel} (${role})
- Privileges: ${privileges}

## Platform Modules
1. **Real Estate** — Property 5-step workflow (staff/admin)
2. **Architecture Management** — Design portfolio, customers, orders, payments (/architecture)
3. **Software Development** — Products, projects, sales, payments (/software-dev)
4. **Shared** — Attendance, Payroll (/payroll), Notifications, Profile

## Key Pages
- Dashboard: / (admin & real-estate staff), /architecture (architecture staff), /software-dev (developers)
- Properties: /properties | Architecture: /architecture | Software Dev: /software-dev
- Attendance: /attendance | Payroll: /payroll | Profile: /profile | Notifications: /notifications
${isAdmin ? "- Admin: /users, /approvals, /reports, /activity-logs, /settings" : ""}
${securityRules}

## Guidelines
1. Be concise, use markdown, address the user as ${name}.
2. Tell users which page or tab to open for tasks.
3. Never invent data — use tools when needed or say you don't have access.
4. Format currency as Nu. (Bhutan Ngultrum).
5. ${roleGuidance}`;
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