import { useState, useEffect } from "react";
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, FileCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router";
import { getNotificationPath } from "@/lib/notification-nav";

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

  // Fetch full list when popover is opened
  const { data, isLoading, refetch } = trpc.notification.list.useQuery(
    { limit: 10, unreadOnly: false },
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

  // Play sound on click for testing
  const handleBellClick = () => {
    playNotificationSound();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative h-10 w-10", className)} onClick={handleBellClick}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm p-0" align="end">
        <div className="flex flex-wrap items-center justify-between p-3 border-b gap-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="h-8"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : data?.items?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {data?.items?.map((notification) => {
                const Icon = notificationIcons[notification.type] || Info;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 transition-colors cursor-pointer min-h-[44px]",
                      !notification.isRead && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (!notification.isRead) {
                        markRead.mutate({ id: notification.id });
                      }
                      
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
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", !notification.isRead && "font-semibold")}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-2 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Button variant="ghost" className="w-full" asChild onClick={() => setOpen(false)}>
            <Link to="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
