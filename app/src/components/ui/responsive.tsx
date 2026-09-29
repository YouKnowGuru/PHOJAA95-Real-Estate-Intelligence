import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

interface ResponsiveCardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ResponsiveCard({ children, className, noPadding = false }: ResponsiveCardProps) {
  return (
    <Card className={cn(
      "border-border/50 bg-white/80 backdrop-blur-sm transition-all duration-300",
      "dark:bg-slate-800/80 dark:border-border/30",
      "hover:shadow-lg hover:shadow-primary/5",
      className
    )}>
      {noPadding ? children : <CardContent className="p-4 sm:p-6">{children}</CardContent>}
    </Card>
  );
}

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("space-y-4 sm:space-y-6", className)}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
      className
    )}>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 mt-2 sm:mt-0">{children}</div>}
    </div>
  );
}

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export function ResponsiveGrid({ 
  children, 
  className, 
  cols = { default: 1, sm: 2, lg: 3, xl: 4 } 
}: ResponsiveGridProps) {
  const gridClass = cn(
    "grid gap-3 sm:gap-4 lg:gap-6",
    cols.default === 1 && "grid-cols-1",
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
    !cols.sm && "sm:grid-cols-2",
    !cols.lg && "lg:grid-cols-3",
    !cols.xl && "xl:grid-cols-4",
    className
  );
  
  return <div className={gridClass}>{children}</div>;
}

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn(
      "relative overflow-x-auto",
      "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    )}>
      <div className={cn(
        "min-w-full inline-block align-middle",
        "[&_::-webkit-scrollbar]:h-2",
        "[&_::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
        "[&_::-webkit-scrollbar-thumb]:rounded-full"
      )}>
        <div className={cn("overflow-hidden border rounded-lg", className)}>
          <table className="min-w-full divide-y divide-border">
            {children}
          </table>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  className?: string;
}

export function StatCard({ title, value, icon, trend, trendUp, subtitle, className }: StatCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden border-border/50 bg-white/80 backdrop-blur-sm",
      "dark:bg-slate-800/80 dark:border-border/30",
      "hover:shadow-md transition-all duration-200",
      className
    )}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-xs font-medium",
            trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}>
            {trendUp ? "↑" : "↓"} {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-8 sm:py-12 text-center",
      className
    )}>
      {icon && <div className="mb-4 text-muted-foreground/50">{icon}</div>}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface LoadingSkeletonProps {
  count?: number;
  className?: string;
  variant?: "card" | "text" | "table";
}

export function LoadingSkeleton({ count = 3, className, variant = "card" }: LoadingSkeletonProps) {
  if (variant === "table") {
    return (
      <div className={cn("space-y-2", className)}>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }
  
  if (variant === "text") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
      </div>
    );
  }
  
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
