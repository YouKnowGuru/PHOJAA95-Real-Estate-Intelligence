import { useState, useEffect } from "react";
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, FileCheck, X } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router";
import { getNotificationPath } from "@/lib/notification-nav";
import { motion, AnimatePresence } from "framer-motion";

const notificationIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  approval: FileCheck,
};

// Simple notification sound using Web Audio API
const playNotificationSound = async () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    
    // Resume context if suspended (browser autoplay policy)
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Higher frequency and longer duration for better audibility
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1500, audioContext.currentTime + 0.1);
    oscillator.type = "sine";
    
    // Louder volume
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log("Audio not supported", e);
  }
};

export function NotificationBell({ className }: { className?: string }) {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [lastUnreadCount, setLastUnreadCount] = useState(0);

  // Poll for unread count every 5 seconds for real-time updates
  const { data: unreadData } = trpc.notification.getUnreadCount.useQuery(
    undefined,
    {
      refetchInterval: 5000, // Poll every 5 seconds
    }
  );

  // Play sound when new notification arrives
  useEffect(() => {
    const currentCount = unreadData?.count || 0;
    // Play sound when count increases (including first notification)
    if (currentCount > lastUnreadCount && currentCount > 0) {
      playNotificationSound();
    }
    setLastUnreadCount(currentCount);
  }, [unreadData?.count, lastUnreadCount]);

  // Fetch only unread notifications so seen/read ones automatically disappear
  const { data, isLoading, refetch } = trpc.notification.list.useQuery(
    { limit: 15, unreadOnly: true },
    { 
      enabled: open,
      refetchInterval: open ? 5000 : false, // Poll every 5 seconds when open
    }
  );

  // Refetch when popover opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  const unreadCount = unreadData?.count ?? data?.unreadCount ?? 0;

  // When popover closes after user opened and saw the notifications,
  // automatically mark all seen notifications as read so they disappear!
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && open) {
      if ((data?.items && data.items.length > 0) || unreadCount > 0) {
        markAllRead.mutate();
      }
    }
    setOpen(newOpen);
  };

  // Play sound on click for testing
  const handleBellClick = () => {
    playNotificationSound();
  };

  const notifications = data?.items || [];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative h-10 w-10", className)} onClick={handleBellClick}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm p-0 shadow-xl border-border/50" align="end">
        <div className="flex flex-wrap items-center justify-between p-3 border-b gap-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1 text-primary" />
              Clear all
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <p className="text-xs text-muted-foreground">Loading alerts...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                <Bell className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-0.5">No new unread notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              <AnimatePresence mode="popLayout">
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type] || Info;
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "p-3 hover:bg-muted/40 transition-colors cursor-pointer min-h-[44px] relative group",
                        "bg-primary/[0.04]"
                      )}
                      onClick={() => {
                        // Mark as seen immediately so it disappears
                        markRead.mutate({ id: notification.id });
                        
                        // Navigation logic
                        const path = getNotificationPath(notification);
                        if (path) navigate(path);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 p-2 rounded-full shrink-0",
                            notification.type === "success" && "bg-green-500/10 text-green-500",
                            notification.type === "error" && "bg-red-500/10 text-red-500",
                            notification.type === "warning" && "bg-yellow-500/10 text-yellow-500",
                            notification.type === "approval" && "bg-blue-500/10 text-blue-500",
                            notification.type === "info" && "bg-gray-500/10 text-gray-500"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {/* Quick Dismiss button to immediately make notification disappear */}
                        <button
                          type="button"
                          title="Dismiss notification"
                          className="absolute right-2 top-2 p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate({ id: notification.id });
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t bg-muted/10 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground" asChild onClick={() => setOpen(false)}>
            <Link to="/notifications">View notification history</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
