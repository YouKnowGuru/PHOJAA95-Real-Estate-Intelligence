import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Mail
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SummaryCard({
  title,
  value,
  color,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  value: React.ReactNode;
  color: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      <motion.div whileHover={{ y: -4 }} className="group relative overflow-hidden border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
        <Card className="border-0 bg-transparent shadow-none">
          <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color} bg-opacity-10 dark:bg-opacity/20`}>
                <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" />
            Notifications Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your alerts and stay updated</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || !data?.unreadCount}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
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
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Notifications"
          value={String(data?.items.length ?? 0)}
          color="bg-primary"
          icon={Bell}
          delay={0}
        />
        <SummaryCard
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
          <Card className="border-border/50">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab("all")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                      activeTab === "all" ? "bg-white dark:bg-slate-800 shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setActiveTab("unread")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
                      activeTab === "unread" ? "bg-white dark:bg-slate-800 shadow-sm" : "text-muted-foreground"
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Showing last 50 alerts
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {(!data?.items || data.items.length === 0) && !isLoading ? (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4">
                    <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
                      <CardContent className="py-20 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                          <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-lg font-bold text-foreground">No notifications found</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                          You're all caught up! New alerts will appear here when they arrive.
                        </p>
                      </CardContent>
                    </Card>
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
                              "p-4 group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors relative cursor-pointer border-l-2",
                              !notif.isRead ? "border-l-primary bg-primary/5" : "border-l-transparent"
                            )}
                            onClick={() => {
                              if (!notif.isRead) {
                                markReadMutation.mutate({ id: notif.id });
                              }

                              // Navigation logic
                              if (notif.entityType === "property" && notif.entityId) {
                                navigate(`/properties/${notif.entityId}`);
                              } else if (notif.entityType === "payroll") {
                                navigate("/payroll");
                              } else if (notif.type === "approval") {
                                navigate("/approvals");
                              } else if (notif.entityType === "attendance") {
                                navigate("/attendance");
                              }
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
                                  <h4 className={cn("text-sm font-semibold truncate", !notif.isRead && "text-primary")}>
                                    {notif.title}
                                  </h4>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                                    {notif.createdAt && formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                  {notif.message}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  <Badge variant="secondary" className={cn("text-[10px] border-0", typeColors[notif.type])}>
                                    {notif.type}
                                  </Badge>
                                  {!notif.isRead && (
                                    <Button 
                                      variant="link" 
                                      size="sm" 
                                      className="h-auto p-0 text-[10px] font-bold uppercase tracking-wider"
                                      onClick={() => markReadMutation.mutate({ id: notif.id })}
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
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Tools */}
        <div className="space-y-6">
          {/* Admin Broadcast Card */}
          {isAdmin && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="border-primary/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-white to-primary/5 dark:from-slate-800 dark:to-primary/10 overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
                  <Megaphone className="h-20 w-20" />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    System Broadcast
                  </CardTitle>
                  <CardDescription>Send an alert to all active staff members</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBroadcast} className="space-y-4 relative">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold tracking-wider">Title</Label>
                      <Input 
                        placeholder="Subject of the broadcast" 
                        value={broadcastForm.title}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                        className="bg-white/50 dark:bg-slate-900/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold tracking-wider">Alert Type</Label>
                      <Select 
                        value={broadcastForm.type} 
                        onValueChange={(val) => setBroadcastForm({ ...broadcastForm, type: val as typeof broadcastForm.type })}
                      >
                        <SelectTrigger className="bg-white/50 dark:bg-slate-900/50">
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
                        className="w-full min-h-[100px] rounded-lg border border-border bg-white/50 dark:bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Type your message here..."
                        value={broadcastForm.message}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-primary text-white shadow-lg shadow-primary/20"
                      disabled={broadcastMutation.isPending || !broadcastForm.title || !broadcastForm.message}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {broadcastMutation.isPending ? "Broadcasting..." : "Broadcast Message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Tips Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-500" />
                Notification Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Real-time alerts</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The system checks for new messages every 5 seconds. You'll hear a subtle sound whenever a new alert arrives.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Mark as Read</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clicking on a notification in this list automatically marks it as read. Read messages are moved to your history.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
