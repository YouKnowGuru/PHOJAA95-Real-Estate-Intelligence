import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = PackageOpen,
  title = "No items found",
  description = "There are no items to display at the moment.",
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4",
        "rounded-2xl border border-dashed border-border/60 bg-muted/20",
        className
      )}
      {...props}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-5">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
