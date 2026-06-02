import { cn } from "@/lib/utils";

export function TabToolbar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {children}
    </div>
  );
}

export function TabSearchWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-md", className)}>
      {children}
    </div>
  );
}

/** Pass to SelectTrigger className */
export const tabSelectClass = "w-full min-h-10 sm:w-[160px]";

/** Pass to primary action Button — spans full width on mobile */
export const tabActionClass = "w-full min-h-10 sm:w-auto shrink-0 sm:col-start-auto sm:justify-self-end";
