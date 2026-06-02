import { useParams } from "react-router";
import { trpc } from "@/lib/trpc";
import { OniLoader } from "@/components/ui/oni-loader";
import { AppleCard } from "@/components/ui/apple-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadArchitectureCertificatePdf, downloadArchitectureInvoicePdf } from "@/components/architecture/exports";
import { formatStatusLabel } from "@/components/software-dev";
import { formatDisplayDate } from "@/lib/format-date";
import { toast } from "sonner";
import { Building2, FileText, Award, CreditCard, Download } from "lucide-react";

export default function ArchitecturePortalPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = trpc.architecturePortal.getDashboard.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );
  const { data: branding } = trpc.settings.getPublicSettings.useQuery(undefined, { staleTime: Infinity });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <OniLoader size="lg" text="Loading your portal" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AppleCard className="p-8 text-center max-w-md">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold">Portal Access Invalid</h1>
          <p className="text-muted-foreground mt-2">This portal link is invalid or has expired. Please contact the company for a new link.</p>
        </AppleCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <AppleCard className="p-6">
          <h1 className="text-2xl font-bold">Customer Portal</h1>
          <p className="text-muted-foreground">Welcome, {data.customer.fullName}</p>
          <p className="text-sm text-muted-foreground">{data.customer.email} · {data.customer.phone}</p>
        </AppleCard>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Building2 className="h-5 w-5" /> Your Projects</h2>
          <div className="grid gap-4">
            {data.orders.map((order) => (
              <AppleCard key={order.id} className="p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{order.projectName}</h3>
                    <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{formatStatusLabel(order.status)}</Badge>
                    <Badge variant="outline">{formatStatusLabel(order.paymentStatus)}</Badge>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Stage:</span> {formatStatusLabel(order.developmentStage)}</div>
                  <div><span className="text-muted-foreground">Progress:</span> {order.progressPercentage}%</div>
                  <div><span className="text-muted-foreground">Total:</span> Nu. {order.finalAmount}</div>
                  <div><span className="text-muted-foreground">Remaining:</span> Nu. {order.remainingPayment}</div>
                </div>
              </AppleCard>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payment History</h2>
          <div className="grid gap-3">
            {data.payments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
            ) : data.payments.map((p) => (
              <AppleCard key={p.id} className="p-3 flex justify-between text-sm">
                <span>{p.paymentNumber} — {formatStatusLabel(p.paymentType)}</span>
                <span className="font-medium">Nu. {p.amount}</span>
              </AppleCard>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><FileText className="h-5 w-5" /> Invoices</h2>
          <div className="grid gap-3">
            {data.invoices.map((inv) => (
              <AppleCard key={inv.id} className="p-4 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <p className="font-medium">{inv.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    Nu. {inv.totalAmount} — {formatStatusLabel(inv.paymentStatus)}
                    {inv.issueDate ? ` · Issued ${formatDisplayDate(inv.issueDate)}` : ""}
                  </p>
                </div>
                {branding && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                    try {
                      await downloadArchitectureInvoicePdf({
                        invoiceNumber: inv.invoiceNumber,
                        issueDate: inv.issueDate,
                        dueDate: inv.dueDate ?? undefined,
                        customerName: data.customer.fullName,
                        customerEmail: data.customer.email,
                        customerPhone: data.customer.phone,
                        projectName: "Architecture Service",
                        subtotal: String(inv.subtotal),
                        totalAmount: String(inv.totalAmount),
                        amountPaid: String(inv.amountPaid),
                        remainingAmount: String(inv.remainingAmount),
                        taxAmount: String(inv.taxAmount),
                        discountAmount: String(inv.discountAmount),
                        paymentStatus: inv.paymentStatus,
                      }, branding);
                      toast.success("Invoice downloaded");
                    } catch {
                      toast.error("Failed to download invoice");
                    }
                  }}>
                    <Download className="h-4 w-4" /> Download
                  </Button>
                )}
              </AppleCard>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Award className="h-5 w-5" /> Certificates</h2>
          <div className="grid gap-3">
            {data.certificates.map((cert) => (
              <AppleCard key={cert.id} className="p-4 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <p className="font-medium">{cert.certificateNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {cert.projectName}
                    {cert.completionDate ? ` · ${formatDisplayDate(cert.completionDate)}` : ""}
                  </p>
                </div>
                {branding && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadArchitectureCertificatePdf(cert, branding)}>
                    <Download className="h-4 w-4" /> Download
                  </Button>
                )}
              </AppleCard>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
