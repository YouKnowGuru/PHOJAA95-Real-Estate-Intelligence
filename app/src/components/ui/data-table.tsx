import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DataTableProps<T> extends React.ComponentProps<"div"> {
  data: T[];
  columns: {
    key: string;
    header: React.ReactNode;
    cell: (item: T, index: number) => React.ReactNode;
    className?: string;
    headerClassName?: string;
  }[];
  keyExtractor: (item: T) => string | number;
  emptyState?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyState,
  loading,
  loadingRows = 5,
  className,
  ...props
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border/40 overflow-hidden", className)} {...props}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                      col.headerClassName
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-border/30">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={cn("py-3 px-4", col.className)}>
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className} {...props}>
        {emptyState || (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No data available
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border/40 overflow-hidden", className)} {...props}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <motion.tr
                key={keyExtractor(item)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border/30 hover:bg-muted/20 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("py-3 px-4 text-sm", col.className)}
                  >
                    {col.cell(item, index)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
