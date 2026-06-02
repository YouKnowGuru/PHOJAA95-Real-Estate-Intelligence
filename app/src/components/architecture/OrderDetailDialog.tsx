import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppleCard } from "@/components/ui/apple-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { OniLoader } from "@/components/ui/oni-loader";
import { formatStatusLabel, getStatusVariant, softwareFormDialogClass } from "@/components/software-dev";
import { formatDisplayDate } from "@/lib/format-date";
import { DEV_STAGES } from "@/pages/architecture/constants";
import { User, Calendar, CreditCard, TrendingUp } from "lucide-react";

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-border/40 py-2.5 last:border-0 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

interface OrderDetailDialogProps {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailDialog({ orderId, open, onOpenChange }: OrderDetailDialogProps) {
  const { data: order, isLoading } = trpc.architectureOrder.getById.useQuery(
    { id: orderId! },
    { enabled: open && orderId != null }
  );

  const stageLabel = DEV_STAGES.find((s) => s.value === order?.developmentStage)?.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${softwareFormDialogClass} max-w-2xl`}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {order?.projectName || "Order Details"}
            {order?.status && (
              <StatusBadge variant={getStatusVariant(order.status)}>{formatStatusLabel(order.status)}</StatusBadge>
            )}
          </DialogTitle>
          {order?.orderNumber && <p className="text-sm text-muted-foreground">{order.orderNumber}</p>}
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><OniLoader text="Loading order" /></div>
        ) : !order ? (
          <p className="text-sm text-muted-foreground">Order not found.</p>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <AppleCard hover={false} className="p-4">
              <DetailRow label="Customer" value={order.customer?.fullName} />
              <DetailRow label="Email" value={order.customer?.email} />
              <DetailRow label="Phone" value={order.customer?.phone} />
              <DetailRow label="Address" value={order.customer?.address} />
              <DetailRow label="Description" value={order.description} />
              <DetailRow label="Extra Features" value={order.extraFeatures} />
              <DetailRow label="Est. Completion" value={order.estimatedCompletionDate ? formatDisplayDate(order.estimatedCompletionDate) : undefined} />
              {order.rejectionReason && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  <span className="font-semibold">Rejection reason: </span>{order.rejectionReason}
                </div>
              )}
            </AppleCard>

            <AppleCard hover={false} className="p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4" /> Financial Summary</h4>
              <DetailRow label="Total Price" value={`Nu. ${order.totalPrice}`} />
              <DetailRow label="Tax" value={`Nu. ${order.taxAmount}`} />
              <DetailRow label="Discount" value={`Nu. ${order.discountAmount}`} />
              <DetailRow label="Final Amount" value={`Nu. ${order.finalAmount}`} />
              <DetailRow label="Advance (50%)" value={`Nu. ${order.advancePayment}`} />
              <DetailRow label="Paid So Far" value={`Nu. ${order.totalPaid}`} />
              <DetailRow label="Remaining" value={`Nu. ${order.remainingPayment}`} />
              <DetailRow label="Payment Status" value={formatStatusLabel(order.paymentStatus)} />
            </AppleCard>

            <AppleCard hover={false} className="p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4" /> Development Progress</h4>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${order.progressPercentage || 0}%` }} />
                </div>
                <span className="text-sm font-semibold">{order.progressPercentage || 0}%</span>
              </div>
              <DetailRow label="Current Stage" value={stageLabel || formatStatusLabel(order.developmentStage)} />
            </AppleCard>

            {!!order.progress?.length && (
              <AppleCard hover={false} className="p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Calendar className="h-4 w-4" /> Progress Timeline</h4>
                <div className="space-y-3">
                  {order.progress.map((entry) => (
                    <div key={entry.id} className="relative border-l-2 border-primary/30 pl-4">
                      <p className="text-sm font-medium">{formatStatusLabel(entry.stage)} — {entry.progressPercentage}%</p>
                      {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
                      <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </AppleCard>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
