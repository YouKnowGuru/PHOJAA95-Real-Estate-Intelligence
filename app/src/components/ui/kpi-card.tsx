import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AppleCard, AppleCardContent } from "./apple-card";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  color?: string;
  delay?: number;
  className?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  subtitle,
  color = "bg-primary",
  delay = 0,
  className,
}: KPICardProps) {
  const textColor = color.replace("bg-", "text-");
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <AppleCard hover className="group overflow-hidden">
        <AppleCardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3 min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
              </p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {value}
                </h3>
                {trend && (
                  <span
                    className={cn(
                      "flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full",
                      trendUp
                        ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20"
                        : "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20"
                    )}
                  >
                    {trendUp ? "↑" : "↓"} {trend}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                color,
                "bg-opacity-10 dark:bg-opacity-20",
                "shadow-sm"
              )}
            >
              <Icon className={cn("h-5 w-5", textColor)} />
            </div>
          </div>
        </AppleCardContent>
      </AppleCard>
    </motion.div>
  );
}
