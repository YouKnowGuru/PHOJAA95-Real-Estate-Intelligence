import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { OniLoader } from "@/components/ui/oni-loader";
import { toast } from "sonner";
import { formatStatusLabel, getStatusVariant, SoftwareTabPanel } from "@/components/software-dev";
import { formatDisplayDate } from "@/lib/format-date";
import { TabSectionHeader } from "../TabSectionHeader";
import { PaymentProofPreview, RejectReasonDialog, RecordPaymentDialog } from "@/components/architecture";
import { CheckCircle, XCircle, CreditCard, Clock, User, Hash, Upload, AlertCircle } from "lucide-react";

export default function PaymentsTab({ isAdmin, isArchitectureStaff }: { isAdmin: boolean; isArchitectureStaff: boolean }) {
  const [rejectPaymentId, setRejectPaymentId] = useState<number | null>(null);
  const [recordPayment, setRecordPayment] = useState<{
    orderId: number;
    label: string;
    type: "advance" | "final";
    amount: string;
  } | null>(null);

  const { data: pendingVerifications, isLoading: pendingLoading, error: pendingError, refetch: refetchPending } =
    trpc.architecturePayment.pendingVerifications.useQuery(
      { page: 1, limit: 20 },
      { enabled: isAdmin }
    );

  const { data: allPayments, isLoading: listLoading, error: listError, refetch: refetchAll } =
    trpc.architecturePayment.list.useQuery({ page: 1, limit: 50 });

  const { data: ordersData } = trpc.architectureOrder.list.useQuery(
    { page: 1, limit: 50 },
    { enabled: isArchitectureStaff }
  );

  const verifyPayment = trpc.architecturePayment.verify.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.action === "verify" ? "Payment verified" : "Payment rejected");
      refetchPending();
      refetchAll();
      setRejectPaymentId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const payableOrders = (ordersData?.items || []).filter((o) =>
    o.status === "payment_pending" || (o.status === "completed" && o.paymentStatus !== "fully_paid")
  );

  if (listLoading && !allPayments) {
    return (
      <SoftwareTabPanel>
        <div className="flex h-64 items-center justify-center"><OniLoader size="lg" text="Loading payments" /></div>
      </SoftwareTabPanel>
    );
  }

  if (listError) {
    return (
      <SoftwareTabPanel>
        <AppleCard className="border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            Failed to load payments: {listError.message}
          </p>
        </AppleCard>
      </SoftwareTabPanel>
    );
  }

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Payments"
        description={
          isAdmin
            ? "Verify payment screenshots submitted by architecture staff."
            : "Upload payment proof screenshots here. Admin verifies them below in pending queue."
        }
      />

      {isArchitectureStaff && (
        <AppleCard hover={false} className="mb-6 border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Payment Proof</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                When a customer pays advance (50%) or final balance, upload the bank/mobile screenshot here.
              </p>
            </div>
          </div>
          {!payableOrders.length ? (
            <p className="mt-3 text-sm text-muted-foreground">No orders awaiting payment right now. Approve an order first (Orders tab).</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {payableOrders.map((o) => {
                const finalAmount = parseFloat(String(o.finalAmount || "0"));
                const remaining = o.remainingPayment != null
                  ? parseFloat(String(o.remainingPayment))
                  : Math.max(0, finalAmount - parseFloat(String(o.totalPaid || "0")));
                const isAdvance = o.status === "payment_pending";
                return (
                  <div key={o.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                    <div>
                      <p className="font-medium">{o.projectName}</p>
                      <p className="text-xs text-muted-foreground">{o.orderNumber}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isAdvance ? `Advance due: Nu. ${(finalAmount * 0.5).toFixed(2)}` : `Final due: Nu. ${remaining.toFixed(2)}`}
                    </p>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => setRecordPayment({
                        orderId: o.id,
                        label: `${o.projectName} (${o.orderNumber})`,
                        type: isAdvance ? "advance" : "final",
                        amount: isAdvance ? (finalAmount * 0.5).toFixed(2) : remaining.toFixed(2),
                      })}
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Screenshot
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </AppleCard>
      )}

      {isAdmin && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending Verification ({pendingVerifications?.items.length ?? 0})
            </h3>
          </div>
          {pendingLoading ? (
            <OniLoader text="Loading pending verifications" />
          ) : pendingError ? (
            <AppleCard className="border-red-200 p-4 text-sm text-red-600">{pendingError.message}</AppleCard>
          ) : !pendingVerifications?.items.length ? (
            <EmptyState
              title="No pending verifications"
              description="When architecture staff uploads a payment screenshot, it appears here for you to verify."
            />
          ) : (
            pendingVerifications.items.map(({ verification, payment, order, customer }) => (
              <AppleCard key={verification.id} className="overflow-hidden p-0">
                <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{order.projectName}</h3>
                        <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
                      </div>
                      <StatusBadge variant="warning">{formatStatusLabel(verification.status)}</StatusBadge>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" />{customer.fullName}</div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Hash className="h-4 w-4" />{payment.paymentNumber}</div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Nu. {payment.amount}</span>
                        <span className="text-muted-foreground">· {formatStatusLabel(payment.paymentType)}</span>
                      </div>
                      <div className="text-muted-foreground">{formatStatusLabel(payment.paymentMethod)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="gap-1" disabled={verifyPayment.isPending} onClick={() => verifyPayment.mutate({ paymentId: payment.id, action: "verify" })}>
                        <CheckCircle className="h-4 w-4" /> Verify
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" disabled={verifyPayment.isPending} onClick={() => setRejectPaymentId(payment.id)}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                  <div className="border-t bg-muted/20 p-5 lg:border-t-0 lg:border-l">
                    <PaymentProofPreview url={payment.proofDocumentUrl} fileName={payment.paymentNumber} />
                  </div>
                </div>
              </AppleCard>
            ))
          )}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">All Payments</h3>
        {!allPayments?.items.length ? (
          <EmptyState
            title="No payments yet"
            description={isArchitectureStaff ? "Upload a payment proof using the section above." : "Payments appear when staff submit proof from approved orders."}
          />
        ) : (
          allPayments.items.map((p) => (
            <AppleCard key={p.id} className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{p.paymentNumber}</p>
                    {p.verificationStatus && (
                      <StatusBadge variant={getStatusVariant(p.verificationStatus)}>{formatStatusLabel(p.verificationStatus)}</StatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{p.orderProjectName || "Order"} · {p.customerName || "Customer"}</p>
                  <p className="text-sm text-muted-foreground">{formatStatusLabel(p.paymentType)} · {formatStatusLabel(p.paymentMethod)} · {formatDisplayDate(p.paymentDate)}</p>
                  {p.verificationNotes && p.verificationStatus === "rejected" && (
                    <p className="text-sm text-red-600 dark:text-red-400">Rejected: {p.verificationNotes}</p>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <p className="text-lg font-bold text-primary">Nu. {p.amount}</p>
                  {p.proofDocumentUrl ? (
                    <PaymentProofPreview url={p.proofDocumentUrl} compact className="w-full max-w-xs lg:max-w-[220px]" />
                  ) : (
                    <span className="text-xs text-amber-600">No proof attached</span>
                  )}
                </div>
              </div>
            </AppleCard>
          ))
        )}
      </div>

      <RecordPaymentDialog
        open={recordPayment !== null}
        onOpenChange={(open) => !open && setRecordPayment(null)}
        orderId={recordPayment?.orderId ?? null}
        orderLabel={recordPayment?.label}
        paymentType={recordPayment?.type}
        defaultAmount={recordPayment?.amount ?? ""}
        onSuccess={() => refetchAll()}
      />

      <RejectReasonDialog
        open={rejectPaymentId !== null}
        onOpenChange={(open) => !open && setRejectPaymentId(null)}
        title="Reject Payment"
        description="Staff must upload a new payment proof after rejection."
        isPending={verifyPayment.isPending}
        onConfirm={(reason) => {
          if (rejectPaymentId) verifyPayment.mutate({ paymentId: rejectPaymentId, action: "reject", verificationNotes: reason });
        }}
      />
    </SoftwareTabPanel>
  );
}
