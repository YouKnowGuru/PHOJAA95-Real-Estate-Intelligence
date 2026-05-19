import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { STEP_BADGE_LABELS } from "@/constants/workflow";

type ApprovalStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

type WorkflowStatus = "pending" | "processing" | "approved" | "rejected" | "completed" | "cancelled";

interface ApprovalBadgeProps {
  status: ApprovalStatus | WorkflowStatus;
  variant?: "default" | "outline" | "secondary" | "destructive";
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon?: string }> = {
  draft: { label: "Draft", variant: "secondary", icon: "📝" },
  submitted: { label: "Submitted", variant: "outline", icon: "📤" },
  pending_review: { label: "Pending Review", variant: "secondary", icon: "⏳" },
  approved: { label: "Approved", variant: "default", icon: "✅" },
  rejected: { label: "Rejected", variant: "destructive", icon: "❌" },
  completed: { label: "Completed", variant: "default", icon: "🎉" },
  cancelled: { label: "Cancelled", variant: "destructive", icon: "🚫" },
  pending: { label: "Pending", variant: "secondary", icon: "⏰" },
  processing: { label: "Processing", variant: "outline", icon: "⚙️" },
};

export function ApprovalBadge({ status, variant = "default", className, showIcon = false }: ApprovalBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" };

  return (
    <Badge variant={variant === "destructive" ? "destructive" : variant === "outline" ? "outline" : "secondary"} className={className}>
      {showIcon && config.icon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}

interface StepBadgeProps {
  step: number;
  currentStep?: number;
  isActive?: boolean;
  isCompleted?: boolean;
}

export function StepBadge({ step, currentStep: _currentStep, isActive, isCompleted }: StepBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
        isCompleted && "bg-primary/10 text-primary",
        isActive && "bg-blue-500/10 text-blue-500",
        !isCompleted && !isActive && "bg-muted text-muted-foreground"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
          isCompleted && "bg-primary text-primary-foreground",
          isActive && "bg-blue-500 text-white",
          !isCompleted && !isActive && "bg-muted-foreground/30 text-muted-foreground"
        )}
      >
        {isCompleted ? "✓" : step}
      </div>
      <span className="hidden sm:inline">{STEP_BADGE_LABELS[step - 1] || `Step ${step}`}</span>
    </div>
  );
}
