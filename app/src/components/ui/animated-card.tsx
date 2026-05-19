import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
  onClick?: () => void;
}

export function AnimatedCard({ 
  children, 
  className, 
  delay = 0, 
  hover = true,
  onClick 
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={hover ? { 
        y: -4,
        transition: { duration: 0.2 }
      } : undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-white/90 backdrop-blur-sm",
        "dark:bg-slate-800/90 dark:border-border/30",
        hover && "cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-primary/5",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Gradient overlay on hover */}
      {hover && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 transition-opacity duration-300 hover:opacity-100"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}

interface AnimatedCardContentProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function AnimatedCardContent({ 
  children, 
  className, 
  noPadding = false 
}: AnimatedCardContentProps) {
  return (
    <div className={cn(
      !noPadding && "p-4 sm:p-5 lg:p-6",
      className
    )}>
      {children}
    </div>
  );
}

interface AnimatedCardTitleProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedCardTitle({ 
  children, 
  className 
}: AnimatedCardTitleProps) {
  return (
    <h3 className={cn(
      "text-lg font-semibold tracking-tight text-foreground",
      className
    )}>
      {children}
    </h3>
  );
}

interface AnimatedCardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedCardDescription({ 
  children, 
  className 
}: AnimatedCardDescriptionProps) {
  return (
    <p className={cn(
      "text-sm text-muted-foreground",
      className
    )}>
      {children}
    </p>
  );
}

interface AnimatedCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedCardFooter({ 
  children, 
  className 
}: AnimatedCardFooterProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 border-t border-border/50 p-4",
      className
    )}>
      {children}
    </div>
  );
}

// Skeleton loader for cards
export function AnimatedCardSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "rounded-xl border border-border/50 bg-white/50 dark:bg-slate-800/50",
        "animate-pulse",
        className
      )}
    >
      <div className="p-4 sm:p-5 lg:p-6 space-y-4">
        <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
        <div className="h-8 w-2/3 bg-muted rounded animate-pulse" />
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
      </div>
    </motion.div>
  );
}

// Stats card with icon
interface AnimatedStatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  delay?: number;
  className?: string;
}

export function AnimatedStatCard({
  title,
  value,
  icon,
  trend,
  trendUp,
  subtitle,
  delay = 0,
  className
}: AnimatedStatCardProps) {
  return (
    <AnimatedCard delay={delay} className={className}>
      <AnimatedCardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium uppercase tracking-wider text-muted-foreground truncate">
              {title}
            </p>
            <motion.p 
              className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.2, duration: 0.3 }}
            >
              {value}
            </motion.p>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
                {subtitle}
              </p>
            )}
            {trend && (
              <motion.div 
                className={cn(
                  "flex items-center gap-1 mt-2 text-xs sm:text-sm font-medium",
                  trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: delay + 0.3 }}
              >
                <span>{trendUp ? "↑" : "↓"}</span>
                <span>{trend}</span>
              </motion.div>
            )}
          </div>
          <motion.div 
            className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: delay + 0.1, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            {icon}
          </motion.div>
        </div>
      </AnimatedCardContent>
    </AnimatedCard>
  );
}

// List item with animation
interface AnimatedListItemProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

export function AnimatedListItem({ 
  children, 
  index = 0,
  className 
}: AnimatedListItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        delay: index * 0.05,
        duration: 0.3 
      }}
      className={cn("relative", className)}
    >
      {children}
    </motion.div>
  );
}
