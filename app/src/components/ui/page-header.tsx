import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  delay?: number;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  delay = 0,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-inset ring-primary/15 shrink-0">
              {icon}
              <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md opacity-40 -z-10" aria-hidden />
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 truncate ml-0 sm:ml-[46px]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {actions}
        </div>
      )}
    </motion.div>
  );
}
