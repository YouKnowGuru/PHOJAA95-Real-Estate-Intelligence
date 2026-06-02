import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Wide scrollable form / detail dialogs */
export const softwareFormDialogClass =
  "w-[min(100vw-1rem,42rem)] max-w-none max-h-[min(92dvh,900px)] overflow-y-auto overscroll-contain p-4 sm:p-6";

/** Compact confirmation dialogs */
export const softwareDialogSmClass =
  "w-[min(100vw-1rem,28rem)] max-w-none max-h-[min(92dvh,900px)] overflow-y-auto overscroll-contain p-4 sm:p-6";

/** Medium dialogs (verify, invoice status) */
export const softwareDialogMdClass =
  "w-[min(100vw-1rem,32rem)] max-w-none max-h-[min(92dvh,900px)] overflow-y-auto overscroll-contain p-4 sm:p-6";

export interface SoftwareTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function SoftwareTabNav({
  tabs,
  activeTab,
  onSelect,
}: {
  tabs: SoftwareTabItem[];
  activeTab: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="software-dev-tabs-wrap mb-6 -mx-1 px-1">
      <div className="software-dev-tabs flex gap-1 rounded-xl bg-muted/50 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "software-dev-tab flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className={cn(isActive ? "inline" : "hidden min-[480px]:inline")}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SoftwarePagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 min-w-[5.5rem]"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground px-1">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 min-w-[5.5rem]"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        Next
      </Button>
    </div>
  );
}

export function SoftwareTabPanel({
  children,
  className,
  show = true,
}: {
  children: React.ReactNode;
  className?: string;
  show?: boolean;
}) {
  if (!show) return null;
  return <div className={cn("software-dev-panel space-y-4 min-w-0", className)}>{children}</div>;
}

export function SoftwareLoading({ text }: { text: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center py-12">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
