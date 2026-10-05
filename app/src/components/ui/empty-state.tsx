import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
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
        "group relative flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 overflow-hidden",
        "rounded-2xl border border-dashed border-border/60 bg-muted/20",
        className
      )}
      {...props}
    >
      {/* Decorative corner dots */}
      <span aria-hidden className="pointer-events-none absolute top-4 left-4 h-1.5 w-1.5 rounded-full bg-primary/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-4 right-4 h-1.5 w-1.5 rounded-full bg-primary/20" />
      <span aria-hidden className="pointer-events-none absolute top-4 right-8 h-1 w-1 rounded-full bg-primary/20" />
      <span aria-hidden className="pointer-events-none absolute bottom-4 left-8 h-1 w-1 rounded-full bg-primary/25" />

      {/* Gradient icon ring with float */}
      <div className="relative mb-5">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/20 blur-xl opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-inset ring-primary/20 animate-float">
          <Icon className="h-8 w-8 text-primary/70 transition-transform duration-300 group-hover:scale-110" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
