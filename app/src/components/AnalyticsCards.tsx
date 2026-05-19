import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./ui/card";
import type { LucideIcon } from "lucide-react";

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconColor?: string;
}

export function AnalyticsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  iconColor = "text-primary",
}: AnalyticsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
              {trend && (
                <p className={cn("text-xs font-medium", trend.isPositive ? "text-green-500" : "text-red-500")}>
                  {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last month
                </p>
              )}
            </div>
            {Icon && (
              <div className={cn("p-3 rounded-lg bg-muted", iconColor)}>
                <Icon className="h-5 w-5" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
}

export function StatCard({ label, value, icon: Icon, variant = "default" }: StatCardProps) {
  const colors = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-500",
    warning: "bg-yellow-500/10 text-yellow-500",
    danger: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      {Icon && (
        <div className={cn("p-2 rounded-lg", colors[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}
