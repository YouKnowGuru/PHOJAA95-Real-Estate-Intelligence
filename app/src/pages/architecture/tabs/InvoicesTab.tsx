import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OniLoader } from "@/components/ui/oni-loader";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ArchitectureInvoiceViewDialog,
  downloadArchitectureInvoicePdf,
  printArchitectureInvoice,
  type ArchInvoiceRecord,
} from "@/components/architecture";
import {
  SoftwareTabPanel,
  TabSearchWrap,
  TabToolbar,
  formatStatusLabel,
  getStatusVariant,
  tabSelectClass,
} from "@/components/software-dev";
import { formatDisplayDate } from "@/lib/format-date";
import { TabSectionHeader } from "../TabSectionHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Eye, FileText, Printer, Search } from "lucide-react";

function fmtNu(val: string | number) {
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function listItemToRecord(item: {
  invoiceNumber: string;
  orderNumber?: string | null;
  issueDate: string | Date;
  dueDate?: string | Date | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  projectName?: string | null;
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  amountPaid: string | number;
  remainingAmount: string | number;
  paymentStatus: string;
}): ArchInvoiceRecord {
  return {
    invoiceNumber: item.invoiceNumber,
    orderNumber: item.orderNumber || undefined,
    issueDate: item.issueDate,
    dueDate: item.dueDate,
    customerName: item.customerName || "",
    customerEmail: item.customerEmail || undefined,
    customerPhone: item.customerPhone || undefined,
    projectName: item.projectName || "Architecture Service",
    subtotal: item.subtotal,
    taxAmount: item.taxAmount,
    discountAmount: item.discountAmount,
    totalAmount: item.totalAmount,
    amountPaid: item.amountPaid,
    remainingAmount: item.remainingAmount,
    paymentStatus: item.paymentStatus,
  };
}

export default function InvoicesTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewId, setViewId] = useState<number | null>(null);

  const { data: invoices, isLoading } = trpc.architectureInvoice.list.useQuery({ page: 1, limit: 100 });
  const { data: stats } = trpc.architectureInvoice.stats.useQuery();
  const { data: branding } = trpc.settings.getPublicSettings.useQuery(undefined, { staleTime: 0 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (invoices?.items ?? []).filter((inv) => {
      if (statusFilter !== "all" && inv.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      return [
        inv.invoiceNumber,
        inv.customerName,
        inv.projectName,
        inv.orderNumber,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [invoices?.items, search, statusFilter]);

  const handleDownload = async (item: (typeof filtered)[number]) => {
    if (!branding) return;
    try {
      await downloadArchitectureInvoicePdf(listItemToRecord(item), branding);
      toast.success("Invoice PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download");
    }
  };

  const handlePrint = async (item: (typeof filtered)[number]) => {
    if (!branding) return;
    try {
      await printArchitectureInvoice(listItemToRecord(item), branding);
      toast.success("Opening print dialog…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print");
    }
  };

  if (isLoading) {
    return (
      <SoftwareTabPanel>
        <div className="flex h-64 items-center justify-center"><OniLoader size="lg" text="Loading invoices" /></div>
      </SoftwareTabPanel>
    );
  }

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Invoices"
        description="Professional invoices auto-generated when orders are approved. Preview, print, or download PDF."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-2">
        <AppleCard hover={false} className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/10">
            <FileText className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{stats?.total ?? 0}</p>
          </div>
        </AppleCard>
        <AppleCard hover={false} className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
            <FileText className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fully Paid</p>
            <p className="text-lg font-bold">{stats?.paid ?? 0}</p>
          </div>
        </AppleCard>
        <AppleCard hover={false} className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
            <FileText className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Partial</p>
            <p className="text-lg font-bold">{stats?.partiallyPaid ?? 0}</p>
          </div>
        </AppleCard>
        <AppleCard hover={false} className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
            <FileText className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unpaid</p>
            <p className="text-lg font-bold">{stats?.unpaid ?? 0}</p>
          </div>
        </AppleCard>
      </div>

      <AppleCard hover={false} className="mb-4 p-4">
        <p className="text-sm text-muted-foreground">
          Invoices include line items, tax, discount, payment progress, and your <strong>site logo</strong> from Settings.
          Use <strong>View</strong> for a print-ready A4 preview before sending to customers.
        </p>
      </AppleCard>

      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice, customer, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </TabSearchWrap>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={tabSelectClass}><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partially_paid">Partially paid</SelectItem>
            <SelectItem value="fully_paid">Fully paid</SelectItem>
          </SelectContent>
        </Select>
      </TabToolbar>

      {!filtered.length ? (
        <EmptyState
          title="No invoices found"
          description={invoices?.items.length ? "Try a different search or filter." : "Invoices are created automatically when an order is approved."}
          icon={FileText}
        />
      ) : (
        <AppleCard hover={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Project</th>
                  <th className="px-4 py-3 text-left font-medium">Issued</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/30 hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{inv.customerName}</div>
                      {inv.customerEmail && <div className="text-xs text-muted-foreground">{inv.customerEmail}</div>}
                    </td>
                    <td className="px-4 py-3">{inv.projectName}</td>
                    <td className="px-4 py-3 text-xs">
                      {formatDisplayDate(inv.issueDate)}
                      {inv.dueDate && <div className="text-muted-foreground">Due {formatDisplayDate(inv.dueDate)}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">Nu. {fmtNu(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">Nu. {fmtNu(inv.remainingAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={getStatusVariant(inv.paymentStatus)}>
                        {formatStatusLabel(inv.paymentStatus)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setViewId(inv.id)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={!branding} onClick={() => handlePrint(inv)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={!branding} onClick={() => handleDownload(inv)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppleCard>
      )}

      <ArchitectureInvoiceViewDialog open={viewId !== null} onClose={() => setViewId(null)} invoiceId={viewId} />
    </SoftwareTabPanel>
  );
}
