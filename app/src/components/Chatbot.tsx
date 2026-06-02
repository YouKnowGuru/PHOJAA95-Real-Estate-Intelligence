import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    MessageSquare,
    Send,
    Bot,
    User,
    Plus,
    Trash2,
    Sparkles,
    X,
    Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

interface Message {
    id: number;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolCalls?: unknown;
    toolCallId?: string | null;
    toolName?: string | null;
    createdAt: string;
}

interface Conversation {
    id: number;
    title: string;
    model: string;
    updatedAt: string;
}

// ─── Safe Markdown Renderer (no dangerouslySetInnerHTML) ────────────

function SafeMarkdown({ content }: { content: string }) {
    // Split content by code blocks first
    const segments: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", content: content.slice(lastIndex, match.index) });
        }
        segments.push({ type: "code", content: match[2].trim(), lang: match[1] || undefined });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
        segments.push({ type: "text", content: content.slice(lastIndex) });
    }

    return (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            {segments.map((seg, i) =>
                seg.type === "code" ? (
                    <pre
                        key={i}
                        className="bg-muted p-3 rounded-lg my-2 overflow-x-auto text-sm font-mono"
                    >
                        <code>{seg.content}</code>
                    </pre>
                ) : (
                    <MarkdownText key={i} content={seg.content} />
                )
            )}
        </div>
    );
}

function MarkdownText({ content }: { content: string }) {
    // Split by lines to handle block-level elements
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let listOrdered = false;

    const flushList = () => {
        if (listItems.length === 0) return;
        const ListTag = listOrdered ? "ol" : "ul";
        elements.push(
            <ListTag key={`list-${elements.length}`} className={listOrdered ? "list-decimal pl-4 my-1" : "list-disc pl-4 my-1"}>
                {listItems.map((item, i) => (
                    <li key={i}>{renderInlineMarkdown(item)}</li>
                ))}
            </ListTag>
        );
        listItems = [];
        listOrdered = false;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Headers
        if (trimmed.startsWith("# ")) {
            flushList();
            elements.push(<h1 key={i} className="text-xl font-bold mt-3 mb-1">{renderInlineMarkdown(trimmed.slice(2))}</h1>);
            continue;
        }
        if (trimmed.startsWith("## ")) {
            flushList();
            elements.push(<h2 key={i} className="text-lg font-semibold mt-3 mb-1">{renderInlineMarkdown(trimmed.slice(3))}</h2>);
            continue;
        }
        if (trimmed.startsWith("### ")) {
            flushList();
            elements.push(<h3 key={i} className="text-base font-semibold mt-3 mb-1">{renderInlineMarkdown(trimmed.slice(4))}</h3>);
            continue;
        }

        // Unordered list
        if (trimmed.startsWith("- ")) {
            listOrdered = false;
            listItems.push(trimmed.slice(2));
            continue;
        }

        // Ordered list
        if (/^\d+\.\s/.test(trimmed)) {
            listOrdered = true;
            listItems.push(trimmed.replace(/^\d+\.\s/, ""));
            continue;
        }

        // Empty line
        if (trimmed === "") {
            flushList();
            continue;
        }

        // Regular paragraph
        flushList();
        elements.push(<p key={i} className="my-1">{renderInlineMarkdown(trimmed)}</p>);
    }

    flushList();
    return <>{elements}</>;
}

function renderInlineMarkdown(text: string): React.ReactNode {
    // Parse inline markdown: bold, italic, inline code
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const patterns = [
        { regex: /\*\*(.+?)\*\*/, type: "bold" as const },
        { regex: /\*(.+?)\*/, type: "italic" as const },
        { regex: /`([^`]+)`/, type: "code" as const },
    ];

    while (remaining.length > 0) {
        let earliestMatch: { index: number; match: RegExpMatchArray; type: string } | null = null;

        for (const p of patterns) {
            const m = remaining.match(p.regex);
            if (m && m.index !== undefined) {
                if (!earliestMatch || m.index < earliestMatch.index) {
                    earliestMatch = { index: m.index, match: m, type: p.type };
                }
            }
        }

        if (!earliestMatch) {
            parts.push(<span key={key++}>{remaining}</span>);
            break;
        }

        if (earliestMatch.index > 0) {
            parts.push(<span key={key++}>{remaining.slice(0, earliestMatch.index)}</span>);
        }

        const innerText = earliestMatch.match[1];
        if (earliestMatch.type === "bold") {
            parts.push(<strong key={key++} className="font-semibold">{innerText}</strong>);
        } else if (earliestMatch.type === "italic") {
            parts.push(<em key={key++} className="italic">{innerText}</em>);
        } else if (earliestMatch.type === "code") {
            parts.push(
                <code key={key++} className="bg-muted px-1 py-0.5 rounded text-sm font-mono break-all">
                    {innerText}
                </code>
            );
        }

        remaining = remaining.slice(earliestMatch.index + earliestMatch.match[0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Message Bubble ─────────────────────────────────────────────────

function MessageBubble({ message, isWaiting }: { message: Message; isWaiting?: boolean }) {
    const isUser = message.role === "user";
    const isTool = message.role === "tool";

    if (isTool) return null; // Hide tool messages from UI

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn("flex gap-2 sm:gap-3 mb-4 sm:mb-6", isUser && "flex-row-reverse")}
        >
            <div
                className={cn(
                    "flex h-9 w-9 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl shadow-md ring-2 ring-background",
                    isUser
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
                        : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white",
                )}
            >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
                className={cn(
                    "max-w-[85%] sm:max-w-[80%] rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed shadow-md overflow-hidden",
                    isUser
                        ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-sm"
                        : "bg-white dark:bg-slate-800/90 border border-border/30 rounded-tl-sm text-foreground",
                )}
            >
                {isWaiting && !message.content ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 py-2 px-1">
                        <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-violet-500" />
                        <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.15 }} className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-indigo-500" />
                        <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.3 }} className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-blue-500" />
                        <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.45 }} className="hidden sm:inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                    </div>
                ) : (
                    <SafeMarkdown content={message.content} />
                )}
            </div>
        </motion.div>
    );
}

// ─── Chat Input ─────────────────────────────────────────────────────

function ChatInput({
    onSend,
    isLoading,
}: {
    onSend: (message: string) => void;
    isLoading: boolean;
}) {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        onSend(trimmed);
        setInput("");
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'; // Reset height after send
            inputRef.current.focus();
        }
    }, [input, isLoading, onSend]);

    const adjustHeight = () => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [input]);

    return (
        <div className="p-2 sm:p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-border/50 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="relative flex items-end gap-1.5 sm:gap-2 max-w-3xl mx-auto">
                <div className="relative flex-1">
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask me anything..."
                        disabled={isLoading}
                        rows={1}
                        className="w-full min-h-[52px] max-h-[120px] sm:max-h-[150px] rounded-xl sm:rounded-2xl border-border/50 bg-white dark:bg-slate-950 pr-12 shadow-sm focus-visible:ring-primary focus-visible:border-primary transition-all resize-none py-3 sm:py-3.5 overflow-y-auto text-sm sm:text-base"
                    />
                </div>
                <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className={cn(
                        "absolute right-2 bottom-2 h-9 w-9 rounded-xl transition-all duration-300",
                        input.trim() ? "bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95" : "bg-muted text-muted-foreground"
                    )}
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-3.5 sm:h-4 w-3.5 sm:w-4 ml-0.5" />
                    )}
                </Button>
            </div>
        </div>
    );
}

// ─── Conversation Sidebar ───────────────────────────────────────────

function ConversationSidebar({
    conversations,
    activeId,
    onSelect,
    onNew,
    onDelete,
    isMobile,
    onCloseSidebar,
}: {
    conversations: Conversation[];
    activeId: number | null;
    onSelect: (id: number) => void;
    onNew: () => void;
    onDelete: (id: number) => void;
    isMobile: boolean;
    onCloseSidebar: () => void;
}) {
    return (
        <div className="flex h-full flex-col bg-gradient-to-b from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-950/80 border-r border-border/50 w-full">
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-3 sm:px-4">
                <h3 className="text-sm font-semibold tracking-tight truncate">Conversations</h3>
                <div className="flex gap-1 shrink-0">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary hover:scale-105 active:scale-95 transition-all" 
                        onClick={onNew}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    {isMobile && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-xl active:scale-95 transition-all" 
                            onClick={onCloseSidebar}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div className="space-y-1 px-2 sm:px-3 py-2">
                    <AnimatePresence>
                        {conversations.map((conv) => (
                            <motion.div
                                key={conv.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    onSelect(conv.id);
                                    if (isMobile) onCloseSidebar();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onSelect(conv.id);
                                        if (isMobile) onCloseSidebar();
                                    }
                                }}
                                className={cn(
                                    "grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 cursor-pointer border border-transparent min-h-[44px]",
                                    activeId === conv.id 
                                        ? "bg-white dark:bg-slate-800 border-border shadow-sm font-medium text-primary"
                                        : "hover:bg-white/60 dark:hover:bg-slate-800/60 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <MessageSquare className={cn("h-4 w-4 transition-colors", activeId === conv.id ? "text-primary" : "text-muted-foreground/70 hover:text-muted-foreground")} />
                                <span className="truncate text-sm w-full">{conv.title}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive hover:scale-105 active:scale-95 transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(conv.id);
                                    }}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {conversations.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
                                <Bot className="h-6 w-6 text-muted-foreground/60" />
                            </div>
                            <p className="text-center text-sm text-muted-foreground font-medium">
                                No conversations yet
                            </p>
                            <p className="text-center text-xs text-muted-foreground/60 mt-1">
                                Start a new chat to begin
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function getChatSuggestions(role?: string) {
    if (role === "developer") {
        return [
            { text: "What's my role and access?", icon: "👤" },
            { text: "How do I submit a product for approval?", icon: "📦" },
            { text: "Open the software development module", icon: "💻" },
            { text: "Show my payroll info", icon: "💰" },
        ];
    }
    if (role === "architecture_staff") {
        return [
            { text: "What's my role and access?", icon: "👤" },
            { text: "How do I create an architecture order?", icon: "📐" },
            { text: "Open architecture management", icon: "🏛️" },
            { text: "Show my payroll info", icon: "💰" },
        ];
    }
    if (role === "admin") {
        return [
            { text: "Show pending approvals", icon: "📋" },
            { text: "System statistics overview", icon: "📊" },
            { text: "Open software development", icon: "💻" },
            { text: "Open architecture management", icon: "🏛️" },
        ];
    }
    return [
        { text: "Show me property stats", icon: "📊" },
        { text: "How do I add a new property?", icon: "🏠" },
        { text: "What's my role?", icon: "👤" },
        { text: "Show my payroll info", icon: "💰" },
    ];
}

function getWelcomeDescription(role?: string) {
    if (role === "developer") {
        return "Ask about products, projects, sales, payments, payroll, or how to use the Software Development module.";
    }
    if (role === "architecture_staff") {
        return "Ask about portfolio projects, customers, orders, payments, or Architecture Management workflows.";
    }
    if (role === "admin") {
        return "Ask about properties, approvals, architecture, software dev, reports, or any system feature.";
    }
    return "Ask me about properties, system features, reports, or anything related to the PHOJAA95 platform.";
}

// ─── Main Chatbot Panel ─────────────────────────────────────────────

export default function ChatbotPanel({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { user } = useAuth();
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const [isWaitingReply, setIsWaitingReply] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const suggestions = useMemo(() => getChatSuggestions(user?.role), [user?.role]);
    const welcomeDescription = useMemo(() => getWelcomeDescription(user?.role), [user?.role]);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const mobile = window.innerWidth < 768;
                setIsMobile(mobile);
                if (!mobile && open) {
                    setShowSidebar(true);
                } else if (mobile) {
                    setShowSidebar(false);
                }
            }, 150);
        };
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => { window.removeEventListener("resize", handleResize); clearTimeout(timeout); };
    }, [open]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Queries
    const { data: conversations, refetch: refetchConversations } =
        trpc.chatbot.conversations.useQuery(undefined, { enabled: open });

    const { data: activeConversation, refetch: refetchConversation } =
        trpc.chatbot.conversation.useQuery(
            { conversationId: activeConversationId! },
            { enabled: !!activeConversationId && open },
        );

    // Mutations
    const sendMessage = trpc.chatbot.sendMessage.useMutation({
        onSuccess: (data) => {
            setIsWaitingReply(false);
            if (!activeConversationId && data.conversationId) {
                setActiveConversationId(data.conversationId);
            }
            if (activeConversationId || data.conversationId) {
                refetchConversation();
            }
            refetchConversations();
        },
        onError: (err) => {
            setIsWaitingReply(false);
            toast.error(err.message || "Failed to send message");
            if (activeConversationId) refetchConversation();
        },
    });

    const deleteConversation = trpc.chatbot.deleteConversation.useMutation({
        onSuccess: (_data, { conversationId }) => {
            setActiveConversationId((current) => (current === conversationId ? null : current));
            refetchConversations();
        },
    });

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversation?.messages, isWaitingReply]);

    // Handlers
    const handleSend = useCallback(
        (message: string) => {
            setIsWaitingReply(true);
            sendMessage.mutate({
                conversationId: activeConversationId ?? undefined,
                message,
            });
        },
        [activeConversationId, sendMessage],
    );

    const handleNewChat = useCallback(() => {
        setActiveConversationId(null);
        setIsWaitingReply(false);
    }, []);

    const handleSelectConversation = useCallback((id: number) => {
        setActiveConversationId(id);
        setIsWaitingReply(false);
    }, []);

    const messages: Message[] = (activeConversation?.messages || []).map((m) => ({
        ...m,
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    }));

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex h-[100dvh] w-full max-w-full flex-col p-0 md:max-w-[720px] lg:max-w-[800px] shadow-2xl border-l-0 md:border-l border-border/50 bg-background/95 backdrop-blur-3xl overflow-hidden"
            >
                <SheetTitle className="sr-only">PHOJAA95 AI Assistant</SheetTitle>
                <SheetDescription className="sr-only">
                    Chat with the AI assistant to get help with properties, system features, and more.
                </SheetDescription>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/50 px-3 sm:px-4 py-3 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-indigo-500/5 dark:from-violet-500/10 dark:via-purple-500/10 dark:to-indigo-500/10 backdrop-blur-md z-10 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-9 w-9 rounded-xl transition-all hover:scale-105", showSidebar ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                            onClick={() => setShowSidebar(!showSidebar)}
                        >
                            <MenuIcon className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="relative flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-lg shadow-indigo-500/25 overflow-hidden ring-2 ring-white/20 dark:ring-white/10">
                                <motion.div 
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" 
                                    animate={{ x: ["-100%", "100%"] }} 
                                    transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} 
                                />
                                <Sparkles className="h-4 sm:h-5 w-4 sm:w-5 text-white relative z-10" />
                            </div>
                            <div className="hidden sm:block">
                                <h3 className="text-base font-bold bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                    PHOJAA95 AI
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Online • Ready to assist
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all hover:scale-105"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden relative bg-slate-50/30 dark:bg-slate-900/30 w-full max-w-full">
                    {/* Sidebar */}
                    <AnimatePresence>
                        {showSidebar && (
                            <>
                                {isMobile && (
                                    <motion.div 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }} 
                                        className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm"
                                        onClick={() => setShowSidebar(false)}
                                    />
                                )}
                                <motion.div 
                                    initial={{ x: "-100%", opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: "-100%", opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className={cn(
                                        "shrink-0 z-30 h-full overflow-hidden",
                                        isMobile 
                                            ? "absolute left-0 top-0 bg-background/95 backdrop-blur-xl w-[260px] shadow-2xl"
                                            : "relative border-r border-border/50 w-56 sm:w-64 md:w-72 lg:w-80 shadow-none"
                                    )}
                                >
                                    <ConversationSidebar
                                        conversations={(conversations || []).map((c) => ({
                                            ...c,
                                            updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
                                        }))}
                                        activeId={activeConversationId}
                                        onSelect={handleSelectConversation}
                                        onNew={handleNewChat}
                                        onDelete={(id) => deleteConversation.mutate({ conversationId: id })}
                                        isMobile={isMobile}
                                        onCloseSidebar={() => setShowSidebar(false)}
                                    />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Chat Area */}
                    <div className="flex flex-1 flex-col relative w-full h-full overflow-hidden">
                        <ScrollArea className="flex-1 h-0">
                            <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full max-w-full">
                                {messages.length === 0 && !isWaitingReply && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center justify-center py-12 sm:py-20 text-center mx-auto max-w-sm px-4"
                                    >
                                        <div className="mb-6 relative">
                                            <div className="absolute inset-0 bg-violet-500/30 blur-3xl rounded-full" />
                                            <div className="relative flex h-16 sm:h-20 w-16 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 shadow-xl">
                                                <Sparkles className="h-8 sm:h-10 w-8 sm:w-10 text-violet-600 dark:text-violet-400" />
                                            </div>
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                            How can I help you today?
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-6 sm:mb-8 max-w-xs">
                                            {welcomeDescription}
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
                                            {suggestions.map((suggestion, idx) => (
                                                <motion.div
                                                    key={suggestion.text}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                >
                                                    <Button
                                                        variant="outline"
                                                        className="justify-start text-left h-auto py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group w-full"
                                                        onClick={() => handleSend(suggestion.text)}
                                                    >
                                                        <span className="mr-2 text-base group-hover:scale-110 transition-transform">{suggestion.icon}</span>
                                                        <span className="text-xs sm:text-sm font-medium whitespace-normal leading-tight">{suggestion.text}</span>
                                                    </Button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {messages.map((msg) => (
                                    <MessageBubble key={msg.id} message={msg} />
                                ))}

                                {isWaitingReply && (
                                    <MessageBubble
                                        message={{
                                            id: -1,
                                            role: "assistant",
                                            content: "",
                                            createdAt: new Date().toISOString(),
                                        }}
                                        isWaiting
                                    />
                                )}

                                <div ref={messagesEndRef} className="h-4" />
                            </div>
                        </ScrollArea>

                        <ChatInput onSend={handleSend} isLoading={isWaitingReply || sendMessage.isPending} />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ─── SVG Helper ───────────────────────────────────────────────────────
function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
    )
}

// ─── Floating Chat Button ───────────────────────────────────────────

export function ChatbotFAB() {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Floating Action Button */}
            <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setOpen(true)}
                className={cn(
                    "fixed right-3 sm:right-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex items-center justify-center",
                    "h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16",
                    "rounded-2xl sm:rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700",
                    "text-white shadow-xl shadow-indigo-500/30 ring-4 ring-white/10",
                    "transition-all duration-300 group overflow-hidden",
                    open && "hidden",
                )}
            >
                <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" 
                    animate={{ x: ["-100%", "100%"] }} 
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }} 
                />
                <motion.div
                    animate={{ rotate: [0, -8, 8, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
                    className="relative z-10"
                >
                    <Sparkles className="h-5 sm:h-6 w-5 sm:w-6 md:h-7 md:w-7" />
                </motion.div>
                
                {/* Notification dot */}
                <span className="absolute right-2 sm:right-3 top-2 sm:top-3 flex h-2.5 sm:h-3.5 w-2.5 sm:w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 bg-emerald-500 ring-2 ring-indigo-700"></span>
                </span>
            </motion.button>

            <ChatbotPanel open={open} onOpenChange={setOpen} />
        </>
    );
}