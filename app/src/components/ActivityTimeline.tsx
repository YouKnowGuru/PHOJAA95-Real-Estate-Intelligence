import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ScrollArea } from "./ui/scroll-area";

interface Activity {
  id: number;
  userId?: number;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}

interface ActivityTimelineProps {
  activities: Activity[];
  maxHeight?: string;
  className?: string;
}

const actionConfig: Record<string, { label: string; color: string; icon: string }> = {
  PROPERTY_CREATED: { label: "Property Created", color: "bg-blue-500", icon: "🏠" },
  PROPERTY_UPDATED: { label: "Property Updated", color: "bg-blue-500", icon: "✏️" },
  PROPERTY_DELETED: { label: "Property Deleted", color: "bg-red-500", icon: "🗑️" },
  STEP_SUBMITTED: { label: "Step Submitted", color: "bg-yellow-500", icon: "📤" },
  STEP_APPROVED: { label: "Step Approved", color: "bg-green-500", icon: "✅" },
  STEP_REJECTED: { label: "Step Rejected", color: "bg-red-500", icon: "❌" },
  LOGIN: { label: "Logged In", color: "bg-purple-500", icon: "🔐" },
  LOGOUT: { label: "Logged Out", color: "bg-purple-500", icon: "🚪" },
  PROFILE_UPDATED: { label: "Profile Updated", color: "bg-blue-500", icon: "👤" },
  PASSWORD_CHANGED: { label: "Password Changed", color: "bg-orange-500", icon: "🔑" },
  ATTENDANCE_CHECK_IN: { label: "Checked In", color: "bg-green-500", icon: "⏰" },
  ATTENDANCE_CHECK_OUT: { label: "Checked Out", color: "bg-green-500", icon: "🏁" },
  PAYROLL_CREATED: { label: "Payroll Created", color: "bg-primary", icon: "💰" },
  USER_CREATED: { label: "User Created", color: "bg-indigo-500", icon: "👥" },
  USER_UPDATED: { label: "User Updated", color: "bg-indigo-500", icon: "👤" },
};

export function ActivityTimeline({ activities, maxHeight = "400px", className }: ActivityTimelineProps) {
  const getConfig = (action: string) => {
    return actionConfig[action] || { label: action, color: "bg-gray-500", icon: "📋" };
  };

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className={className} style={{ maxHeight }}>
      <div className="space-y-4 p-4">
        {activities.map((activity, index) => {
          const config = getConfig(activity.action);
          const isLast = index === activities.length - 1;

          return (
            <div key={activity.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm", config.color, "text-white")}>
                  {config.icon}
                </div>
                {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
              </div>

              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  {activity.userName && (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-[10px]">
                        {activity.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <p className="text-sm font-medium">{config.label}</p>
                </div>

                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-1 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    {Object.entries(activity.metadata).map(([key, value]) => (
                      <span key={key} className="mr-3">
                        <span className="font-medium">{key}:</span> {String(value)}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-1">
                  {activity.createdAt && format(new Date(activity.createdAt), "MMM d, yyyy h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
