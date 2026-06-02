import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OniLoader } from "@/components/ui/oni-loader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/format-date";
import { SoftwareInvoiceViewDialog } from "./SoftwareInvoiceViewDialog";
import { SoftwarePagination } from "./software-dev-layout";
import { TabSearchWrap, TabToolbar, tabSelectClass } from "./TabToolbar";
import { softwareDialogMdClass } from "./software-dev-layout";
import { formatStatusLabel, getStatusVariant } from "./utils";
import { downloadSoftwareInvoicePdf, printSoftwareInvoice, type SoftInvoiceRecord } from "./software-invoice-export";
import { Download, Eye, FileText, Printer, Search } from "lucide-react";

const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function fmtNu(val: string | number) {
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function listItemToRecord(item: {
  invoiceNumber: string;
  saleNumber?: string | null;
  issueDate: string | Date;
  dueDate?: string | Date | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  companyName?: string | null;
  productName?: string | null;
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  amountPaid: string | number;
  outstandingAmount: string | number;
  status: string;
}): SoftInvoiceRecord {
  return {
    invoiceNumber: item.invoiceNumber,
    saleNumber: item.saleNumber || undefined,
    issueDate: item.issueDate,
    dueDate: item.dueDate,
    customerName: item.customerName || "",
    customerEmail: item.customerEmail || undefined,
    customerPhone: item.customerPhone || undefined,
    companyName: item.companyName || undefined,
    productName: item.productName || undefined,
    subtotal: item.subtotal,
    taxAmount: item.taxAmount,
    discountAmount: item.discountAmount,
    totalAmount: item.totalAmount,
    amountPaid: item.amountPaid,
    outstandingAmount: item.outstandingAmount,
    status: item.status,
  };
}

export function SoftwareInvoicesTab({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<number | null>(null);
  const [statusInvoice, setStatusInvoice] = useState<{ id: number; invoiceNumber?: string } | null>(null);
  const [newStatus, setNewStatus] = useState<"sent" | "cancelled">("sent");

  const { data, isLoading, refetch } = trpc.softwareInvoice.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search.trim() || undefined,
    page,
    limit: 10,
  });
  const { data: stats } = trpc.softwareInvoice.stats.useQuery();
  const { data: branding } = trpc.settings.getPublicSettings.useQuery(undefined, { staleTime: 0 });

  const updateStatusMutation = trpc.softwareInvoice.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Invoice status updated");
      setStatusInvoice(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleDownload = async (item: NonNullable<typeof data>["items"][number]) => {
    if (!branding) return;
    try {
      await downloadSoftwareInvoicePdf(listItemToRecord(item), branding);
      toast.success("Invoice PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download");
    }
  };

  const handlePrint = async (item: NonNullable<typeof data>["items"][number]) => {
    if (!branding) return;
    try {
      await printSoftwareInvoice(listItemToRecord(item), branding);
      toast.success("Opening print dialog…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading invoices..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <AppleCard hover={false} className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/10">
            <FileText className="h-4 w-4 text-indigo-600" />
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
            <p className="text-xs text-muted-foreground">Paid</p>
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sent</p>
            <p className="text-lg font-bold">{stats?.pending ?? 0}</p>
          </div>
        </AppleCard>
        <AppleCard hover={false} className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
            <FileText className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-lg font-bold">{stats?.overdue ?? 0}</p>
          </div>
        </AppleCard>
      </div>

      <AppleCard hover={false} className="p-4">
        <p className="text-sm text-muted-foreground">
          Invoices are created when sales are approved. Preview the official A4 layout with your <strong>site logo</strong>,
          then print or download PDF. Admins can mark draft invoices as sent or cancel them.
        </p>
      </AppleCard>

      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoice, customer, product, sale..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </TabSearchWrap>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={tabSelectClass}><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {INVOICE_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TabToolbar>

      {!data?.items.length ? (
        <EmptyState title="No invoices" description="Invoices are created automatically when sales are approved." icon={FileText} />
      ) : (
        <AppleCard hover={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Issued</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border/30 hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono text-xs">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{invoice.customerName}</div>
                      {invoice.customerEmail && <div className="text-xs text-muted-foreground">{invoice.customerEmail}</div>}
                    </td>
                    <td className="px-4 py-3">{invoice.productName || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {formatDisplayDate(invoice.issueDate)}
                      {invoice.dueDate && <div className="text-muted-foreground">Due {formatDisplayDate(invoice.dueDate)}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">Nu. {fmtNu(invoice.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">Nu. {fmtNu(invoice.outstandingAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={getStatusVariant(invoice.status)}>{formatStatusLabel(invoice.status)}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setViewId(invoice.id)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" disabled={!branding} onClick={() => handlePrint(invoice)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" disabled={!branding} onClick={() => handleDownload(invoice)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && invoice.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => { setStatusInvoice(invoice); setNewStatus("sent"); }}
                          >
                            Mark Sent
                          </Button>
                        )}
                        {isAdmin && invoice.status !== "cancelled" && invoice.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-destructive hover:text-destructive"
                            onClick={() => { setStatusInvoice(invoice); setNewStatus("cancelled"); }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppleCard>
      )}

      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}

      <SoftwareInvoiceViewDialog open={viewId !== null} onClose={() => setViewId(null)} invoiceId={viewId} />

      <Dialog open={!!statusInvoice} onOpenChange={(open) => !open && setStatusInvoice(null)}>
        <DialogContent className={softwareDialogMdClass}>
          <DialogHeader><DialogTitle>Update Invoice Status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invoice {statusInvoice?.invoiceNumber || `#${statusInvoice?.id}`}
            </p>
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as "sent" | "cancelled")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusInvoice(null)}>Close</Button>
              <Button
                onClick={() => statusInvoice && updateStatusMutation.mutate({ id: statusInvoice.id, status: newStatus })}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
