import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface SkeletonCardProps extends React.ComponentProps<"div"> {
  rows?: number;
}

export function SkeletonCard({ rows = 3, className, ...props }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card p-5 space-y-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl w-full" />
      ))}
    </div>
  );
}
