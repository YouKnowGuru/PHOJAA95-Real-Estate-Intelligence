import * as React from "react";
import { cn } from "@/lib/utils";

const statusVariants = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/30",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30",
  error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30",
  neutral: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  primary: "bg-primary/10 text-primary border-primary/20",
};

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  variant?: keyof typeof statusVariants;
  dot?: boolean;
  pulse?: boolean;
}

export function StatusBadge({
  variant = "neutral",
  dot = false,
  pulse = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const variantClass = statusVariants[variant];
  
  const dotColors = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    neutral: "bg-slate-400",
    primary: "bg-primary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        variantClass,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotColors[variant],
            pulse && "status-pulse"
          )}
        />
      )}
      {children}
    </span>
  );
}
