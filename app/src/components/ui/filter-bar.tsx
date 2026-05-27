import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

interface FilterBarProps extends React.ComponentProps<"div"> {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  actions?: React.ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  hasActiveFilters,
  onClearFilters,
  actions,
  className,
  ...props
}: FilterBarProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-3 sm:p-4 space-y-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 bg-background/80"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {filters && (
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            className="h-10 w-10 shrink-0 sm:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        )}
        {actions && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {filters && (
        <div className={cn("flex flex-wrap items-center gap-2", !showFilters && "hidden sm:flex")}>
          {filters}
          {hasActiveFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      )}

      {actions && (
        <div className="flex sm:hidden items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
