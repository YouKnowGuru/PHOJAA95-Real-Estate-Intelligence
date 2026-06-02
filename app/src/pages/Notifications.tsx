import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Bell,
  Trash2,
  CheckCheck,
  Send,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Megaphone,
  History,
  Clock,
  PackageOpen,
  Mail,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router";
import { getNotificationPath } from "@/lib/notification-nav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard, AppleCardContent, AppleCardHeader, AppleCardTitle, AppleCardDescription } from "@/components/ui/apple-card";
import { KPICard } from "@/components/ui/kpi-card";

const notificationIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  approval: CheckCircle,
};

const typeColors = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  approval: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

export default function NotificationsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  // Admin Broadcast State
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
    type: "info" as "info" | "success" | "warning" | "error" | "approval",
  });

  const { data, isLoading } = trpc.notification.list.useQuery(
    { unreadOnly: activeTab === "unread", limit: 50 }
  );

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("All marked as read");
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const clearHistoryMutation = trpc.notification.clearHistory.useMutation({
    onSuccess: () => {
      toast.success("Read history cleared");
      utils.notification.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const broadcastMutation = trpc.notification.broadcast.useMutation({
    onSuccess: (data) => {
      toast.success(`Message broadcasted to ${data.count} users`);
      setBroadcastForm({ title: "", message: "", type: "info" });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.message) return;
    broadcastMutation.mutate(broadcastForm);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Notifications Center"
        description="Manage your alerts and stay updated"
        icon={<Bell className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending || !data?.unreadCount}
              className="h-9 rounded-xl border-border/40"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 rounded-xl"
              onClick={() => {
                if (window.confirm("Clear all read notifications?")) {
                  clearHistoryMutation.mutate();
                }
              }}
              disabled={clearHistoryMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Read History
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Total Notifications"
          value={String(data?.items.length ?? 0)}
          color="bg-primary"
          icon={Bell}
          delay={0}
        />
        <KPICard
          title="Unread Count"
          value={String(data?.unreadCount ?? 0)}
          color="bg-amber-500"
          icon={Mail}
          delay={0.1}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notifications List */}
        <div className="lg:col-span-2 space-y-4">
          <AppleCard hover={false} className="overflow-hidden">
            {/* Tabs Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-border/30">
              <div className="flex bg-muted/60 p-1 rounded-xl self-start">
                <button
                  onClick={() => setActiveTab("all")}
                  className={cn(
                    "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    activeTab === "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab("unread")}
                  className={cn(
                    "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2",
                    activeTab === "unread" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                >
                  Unread
                  {data?.unreadCount ? (
                    <span className="h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
                      {data.unreadCount}
                    </span>
                  ) : null}
                </button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="h-3 w-3" />
                Showing last 50 alerts
              </p>
            </div>

            {/* List */}
            <div className="p-0">
              <ScrollArea className="max-h-[70vh] sm:h-[600px]">
                {(!data?.items || data.items.length === 0) && !isLoading ? (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4">
                    <div className="py-20 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                        <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-bold text-foreground">No notifications found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        You're all caught up! New alerts will appear here when they arrive.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="divide-y divide-border/30">
                    <AnimatePresence mode="popLayout">
                      {data?.items.map((notif, idx) => {
                        const Icon = notificationIcons[notif.type] || Info;
                        return (
                          <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: idx * 0.03 }}
                            className={cn(
                              "p-4 group hover:bg-muted/40 transition-colors relative cursor-pointer border-l-2",
                              !notif.isRead ? "border-l-primary bg-primary/[0.03]" : "border-l-transparent"
                            )}
                            onClick={() => {
                              if (!notif.isRead) {
                                markReadMutation.mutate({ id: notif.id });
                              }
                              const path = getNotificationPath(notif);
                              if (path) navigate(path);
                            }}
                          >
                            <div className="flex gap-4">
                              <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                notif.type === "success" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" :
                                notif.type === "error" ? "bg-red-50 text-red-600 dark:bg-red-900/30" :
                                notif.type === "warning" ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30" :
                                notif.type === "approval" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30" :
                                "bg-blue-50 text-blue-600 dark:bg-blue-900/30"
                              )}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className={cn("text-sm font-semibold truncate min-w-0", !notif.isRead && "text-primary")}>
                                    {notif.title}
                                  </h4>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5 shrink-0">
                                    {notif.createdAt && formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                  {notif.message}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                                  <Badge variant="secondary" className={cn("text-[10px] border-0", typeColors[notif.type])}>
                                    {notif.type}
                                  </Badge>
                                  {!notif.isRead && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="h-auto p-0 text-[10px] font-bold uppercase tracking-wider"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markReadMutation.mutate({ id: notif.id });
                                      }}
                                    >
                                      Mark as read
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>
            </div>
          </AppleCard>
        </div>

        {/* Sidebar Tools */}
        <div className="space-y-6">
          {/* Admin Broadcast Card */}
          {isAdmin && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <AppleCard className="overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 pointer-events-none">
                  <Megaphone className="h-20 w-20" />
                </div>
                <AppleCardHeader>
                  <AppleCardTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    System Broadcast
                  </AppleCardTitle>
                  <AppleCardDescription>Send an alert to all active staff members</AppleCardDescription>
                </AppleCardHeader>
                <AppleCardContent>
                  <form onSubmit={handleBroadcast} className="space-y-4 relative">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold tracking-wider">Title</Label>
                      <Input
                        placeholder="Subject of the broadcast"
                        value={broadcastForm.title}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                        className="bg-background/50 rounded-xl border-border/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold tracking-wider">Alert Type</Label>
                      <Select
                        value={broadcastForm.type}
                        onValueChange={(val) => setBroadcastForm({ ...broadcastForm, type: val as typeof broadcastForm.type })}
                      >
                        <SelectTrigger className="bg-background/50 rounded-xl border-border/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Information (Blue)</SelectItem>
                          <SelectItem value="warning">Warning (Amber)</SelectItem>
                          <SelectItem value="error">Critical Alert (Red)</SelectItem>
                          <SelectItem value="success">Update Success (Green)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold tracking-wider">Message</Label>
                      <textarea
                        className="w-full min-h-[100px] rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                        placeholder="Type your message here..."
                        value={broadcastForm.message}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-white shadow-sm rounded-xl"
                      disabled={broadcastMutation.isPending || !broadcastForm.title || !broadcastForm.message}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {broadcastMutation.isPending ? "Broadcasting..." : "Broadcast Message"}
                    </Button>
                  </form>
                </AppleCardContent>
              </AppleCard>
            </motion.div>
          )}

          {/* Tips Card */}
          <AppleCard hover={false} className="overflow-hidden">
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-emerald-500" />
                Notification Tips
              </AppleCardTitle>
            </AppleCardHeader>
            <AppleCardContent className="space-y-3">
              <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Real-time alerts</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The system checks for new messages every 5 seconds. You'll hear a subtle sound whenever a new alert arrives.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Mark as Read</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clicking on a notification in this list automatically marks it as read. Read messages are moved to your history.
                </p>
              </div>
            </AppleCardContent>
          </AppleCard>
        </div>
      </div>
    </div>
  );
}
