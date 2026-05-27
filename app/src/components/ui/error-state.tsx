import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps extends React.ComponentProps<"div"> {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load the data. Please try again.",
  onRetry,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4",
        "rounded-2xl border border-red-200 dark:border-red-800/30 bg-red-50/50 dark:bg-red-900/10",
        className
      )}
      {...props}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/20 mb-5">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
        {title}
      </h3>
      <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-1.5 max-w-sm">
        {description}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-6 gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </motion.div>
  );
}
