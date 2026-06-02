import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, FileText, Printer, X } from "lucide-react";
import { OniLoader } from "@/components/ui/oni-loader";
import { formatDisplayDate } from "@/lib/format-date";
import { formatStatusLabel, getStatusVariant } from "@/components/software-dev";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveSiteLogoForCertificate } from "@/lib/site-branding";
import {
  buildArchitectureInvoiceHtml,
  downloadArchitectureInvoicePdf,
  printArchitectureInvoice,
  type ArchInvoiceRecord,
} from "./architecture-invoice-export";

interface ArchitectureInvoiceViewDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceId: number | null;
}

function mapDetailToRecord(detail: Record<string, unknown>): ArchInvoiceRecord {
  const customer = detail.customer as Record<string, unknown> | undefined;
  const order = detail.order as Record<string, unknown> | undefined;
  const items = (detail.items as Array<Record<string, unknown>> | undefined)?.map((item) => ({
    description: String(item.description ?? ""),
    quantity: Number(item.quantity ?? 1),
    unitPrice: String(item.unitPrice ?? "0"),
    totalPrice: String(item.totalPrice ?? "0"),
  }));

  return {
    id: Number(detail.id),
    invoiceNumber: String(detail.invoiceNumber ?? ""),
    orderNumber: order?.orderNumber ? String(order.orderNumber) : undefined,
    issueDate: detail.issueDate as string | Date,
    dueDate: detail.dueDate as string | Date | null | undefined,
    customerName: customer?.fullName ? String(customer.fullName) : String(detail.customerName ?? ""),
    customerEmail: customer?.email ? String(customer.email) : undefined,
    customerPhone: customer?.phone ? String(customer.phone) : undefined,
    customerAddress: customer?.address ? String(customer.address) : undefined,
    projectName: order?.projectName ? String(order.projectName) : String(detail.projectName ?? ""),
    subtotal: String(detail.subtotal ?? "0"),
    taxAmount: String(detail.taxAmount ?? "0"),
    discountAmount: String(detail.discountAmount ?? "0"),
    totalAmount: String(detail.totalAmount ?? "0"),
    amountPaid: String(detail.amountPaid ?? "0"),
    remainingAmount: String(detail.remainingAmount ?? "0"),
    paymentStatus: String(detail.paymentStatus ?? "unpaid"),
    status: detail.status ? String(detail.status) : undefined,
    items,
  };
}

export function ArchitectureInvoiceViewDialog({ open, onClose, invoiceId }: ArchitectureInvoiceViewDialogProps) {
  const { data: branding, isLoading: brandingLoading } = trpc.settings.getPublicSettings.useQuery(undefined, {
    enabled: open,
    staleTime: 0,
  });

  const { data: detail, isLoading: detailLoading } = trpc.architectureInvoice.getById.useQuery(
    { id: invoiceId! },
    { enabled: open && invoiceId !== null }
  );

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);

  useEffect(() => {
    if (!open || !branding?.site_logo?.trim()) {
      setLogoDataUrl(null);
      setLogoLoading(false);
      return;
    }
    let cancelled = false;
    setLogoLoading(true);
    resolveSiteLogoForCertificate(branding)
      .then((url) => { if (!cancelled) setLogoDataUrl(url); })
      .finally(() => { if (!cancelled) setLogoLoading(false); });
    return () => { cancelled = true; };
  }, [open, branding?.site_logo]);

  const invoice = detail ? mapDetailToRecord(detail as Record<string, unknown>) : null;
  const previewReady = !!invoice && !brandingLoading && !detailLoading && !logoLoading;
  const previewHtml = previewReady ? buildArchitectureInvoiceHtml(invoice, branding || {}, logoDataUrl) : "";

  const handlePrint = async () => {
    if (!invoice) return;
    try {
      await printArchitectureInvoice(invoice, branding || {});
      toast.success("Opening print dialog…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print");
    }
  };

  const handleDownload = async () => {
    if (!invoice) return;
    try {
      await downloadArchitectureInvoicePdf(invoice, branding || {});
      toast.success("Invoice PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[min(95dvh,920px)] w-[min(100vw-1rem,52rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
            <FileText className="h-5 w-5 shrink-0 text-teal-700" />
            Invoice {invoice?.invoiceNumber || ""}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/80 p-3 sm:p-4 dark:bg-slate-900/40">
          {!previewReady ? (
            <div className="flex aspect-[210/297] max-h-[60vh] items-center justify-center rounded-lg border bg-white">
              <OniLoader size="md" text="Loading invoice..." />
            </div>
          ) : (
            <div className="mx-auto max-w-[210mm] overflow-hidden rounded-lg border bg-white shadow-sm">
              <iframe
                key={`${invoice.invoiceNumber}-${logoDataUrl || "no-logo"}`}
                title="Architecture invoice preview"
                srcDoc={previewHtml}
                className="aspect-[210/297] w-full border-0 bg-white"
              />
            </div>
          )}

          {invoice && (
            <div className="mx-auto mt-3 grid max-w-[210mm] grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium truncate">{invoice.customerName}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="font-medium truncate">{invoice.projectName}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="font-medium">{invoice.dueDate ? formatDisplayDate(invoice.dueDate) : "—"}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge variant={getStatusVariant(invoice.paymentStatus)} className="mt-0.5">
                  {formatStatusLabel(invoice.paymentStatus)}
                </StatusBadge>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t bg-background p-3 sm:justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1">
            <X className="h-4 w-4" /> Close
          </Button>
          <Button variant="outline" size="sm" disabled={!previewReady} onClick={handlePrint} className="gap-1">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" disabled={!previewReady} onClick={handleDownload} className="gap-1">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ArchInvoiceRecord };
