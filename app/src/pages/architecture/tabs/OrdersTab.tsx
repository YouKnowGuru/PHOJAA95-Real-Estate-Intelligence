import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { OrderDetailDialog, RejectReasonDialog, RecordPaymentDialog } from "@/components/architecture";
import {
  formatStatusLabel, getStatusVariant, SoftwareTabPanel, SoftwarePagination,
  softwareFormDialogClass, TabToolbar, TabSearchWrap, tabSelectClass, confirmEntityDelete,
} from "@/components/software-dev";
import { DEV_STAGES } from "../constants";
import { TabSectionHeader } from "../TabSectionHeader";
import { Plus, Search, Eye, CreditCard, Trash2 } from "lucide-react";

type PaymentDialogState = {
  orderId: number;
  label: string;
  type: "advance" | "final";
  amount: string;
} | null;

export default function OrdersTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogState>(null);
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [orderForm, setOrderForm] = useState({
    customerId: "", categoryId: "", projectName: "", projectType: "",
    description: "", extraFeatures: "", estimatedCompletionDate: "",
    totalPrice: "", taxAmount: "0", discountAmount: "0", finalAmount: "",
  });

  const { data: categories } = trpc.architectureCategory.list.useQuery({});
  const { data: customers } = trpc.architectureCustomer.list.useQuery({ limit: 100 });
  const { data: orders, refetch } = trpc.architectureOrder.list.useQuery({
    search: search || undefined, page, limit: 12,
  });

  const createOrder = trpc.architectureOrder.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Order created. 50% advance: Nu. ${data.advancePayment}`);
      setShowOrderForm(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const submitOrder = trpc.architectureOrder.submitForApproval.useMutation({
    onSuccess: () => { toast.success("Order submitted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const approveOrder = trpc.architectureOrder.approve.useMutation({
    onSuccess: () => { toast.success("Order updated"); refetch(); setRejectOrderId(null); utils.architectureInvoice.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateProgress = trpc.architectureOrder.updateProgress.useMutation({
    onSuccess: () => { toast.success("Progress updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteOrder = trpc.architectureOrder.delete.useMutation({
    onSuccess: () => { toast.success("Order deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const openPaymentDialog = (order: NonNullable<typeof orders>["items"][number], type: "advance" | "final") => {
    const finalAmount = parseFloat(String(order.finalAmount || "0"));
    const remaining = order.remainingPayment != null
      ? parseFloat(String(order.remainingPayment))
      : Math.max(0, finalAmount - parseFloat(String(order.totalPaid || "0")));

    setPaymentDialog({
      orderId: order.id,
      label: `${order.projectName} (${order.orderNumber})`,
      type,
      amount: type === "advance" ? (finalAmount * 0.5).toFixed(2) : remaining.toFixed(2),
    });
  };

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Architecture Orders"
        description="Sales orders with 50% advance. Staff uploads payment proof in Payments tab or via Record Advance here."
        actions={canManage ? (
          <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
            <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New Order</Button></DialogTrigger>
            <DialogContent className={softwareFormDialogClass}>
              <DialogHeader><DialogTitle>Create Architecture Order</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                createOrder.mutate({
                  customerId: Number(orderForm.customerId),
                  categoryId: Number(orderForm.categoryId),
                  projectName: orderForm.projectName,
                  projectType: orderForm.projectType || undefined,
                  description: orderForm.description || undefined,
                  extraFeatures: orderForm.extraFeatures || undefined,
                  estimatedCompletionDate: orderForm.estimatedCompletionDate || undefined,
                  totalPrice: orderForm.totalPrice,
                  taxAmount: orderForm.taxAmount,
                  discountAmount: orderForm.discountAmount,
                  finalAmount: orderForm.finalAmount,
                });
              }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Customer *</Label>
                    <Select value={orderForm.customerId} onValueChange={(v) => setOrderForm({ ...orderForm, customerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{(customers?.items || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Category *</Label>
                    <Select value={orderForm.categoryId} onValueChange={(v) => setOrderForm({ ...orderForm, categoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>{(categories || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Project Name *</Label><Input value={orderForm.projectName} onChange={(e) => setOrderForm({ ...orderForm, projectName: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Description</Label><Textarea value={orderForm.description} onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Total Price *</Label><Input type="number" step="0.01" value={orderForm.totalPrice} onChange={(e) => {
                    const total = e.target.value;
                    const tax = parseFloat(orderForm.taxAmount || "0");
                    const disc = parseFloat(orderForm.discountAmount || "0");
                    setOrderForm({ ...orderForm, totalPrice: total, finalAmount: (parseFloat(total || "0") + tax - disc).toFixed(2) });
                  }} required /></div>
                  <div className="space-y-1"><Label>Final Amount</Label><Input value={orderForm.finalAmount} readOnly /></div>
                </div>
                <Button type="submit" disabled={createOrder.isPending || !orderForm.customerId || !orderForm.categoryId}>Create Order</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <TabToolbar>
        <TabSearchWrap>
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </TabSearchWrap>
      </TabToolbar>

      {!orders?.items.length ? (
        <EmptyState title="No orders" description={canManage ? "Create an architecture sales order for a customer." : "No orders to review yet."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.items.map((o) => (
            <AppleCard key={o.id} className="flex flex-col p-4 transition-shadow hover:shadow-md">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-semibold">{o.projectName}</h3>
                  <p className="text-sm text-muted-foreground">{o.orderNumber}</p>
                </div>
                <StatusBadge variant={getStatusVariant(o.status)}>{formatStatusLabel(o.status)}</StatusBadge>
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <p>Customer: {o.customerName || "—"}</p>
                <p className="font-medium text-foreground">Nu. {o.finalAmount}</p>
                <p>Payment: {formatStatusLabel(o.paymentStatus)}</p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${o.progressPercentage || 0}%` }} />
                  </div>
                  <span className="text-xs">{o.progressPercentage}%</span>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button size="sm" variant="secondary" className="gap-1" onClick={() => setViewOrderId(o.id)}>
                  <Eye className="h-3.5 w-3.5" /> View Details
                </Button>
                {canManage && ["draft", "rejected"].includes(o.status) && (
                  <Button size="sm" variant="outline" onClick={() => submitOrder.mutate({ id: o.id })}>Submit</Button>
                )}
                {isAdmin && o.status === "pending_approval" && (
                  <>
                    <Button size="sm" onClick={() => approveOrder.mutate({ id: o.id, action: "approve" })}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectOrderId(o.id)}>Reject</Button>
                  </>
                )}
                {canManage && o.status === "payment_pending" && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openPaymentDialog(o, "advance")}>
                    <CreditCard className="h-3.5 w-3.5" /> Upload Advance Proof
                  </Button>
                )}
                {(canManage || isAdmin) && ["in_progress", "approved", "payment_pending"].includes(o.status) && (
                  <Dialog>
                    <DialogTrigger asChild><Button size="sm" variant="outline">Progress</Button></DialogTrigger>
                    <DialogContent className={softwareFormDialogClass}>
                      <DialogHeader><DialogTitle>Update Progress — {o.projectName}</DialogTitle></DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        updateProgress.mutate({
                          id: o.id,
                          developmentStage: (form.elements.namedItem("stage") as HTMLSelectElement).value as any,
                          progressPercentage: Number((form.elements.namedItem("pct") as HTMLInputElement).value),
                          notes: (form.elements.namedItem("notes") as HTMLTextAreaElement).value,
                        });
                      }} className="space-y-3">
                        <div className="space-y-1">
                          <Label>Stage</Label>
                          <select name="stage" className={tabSelectClass} defaultValue={o.developmentStage}>
                            {DEV_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1"><Label>Progress %</Label><Input name="pct" type="number" min={0} max={100} defaultValue={o.progressPercentage} /></div>
                        <div className="space-y-1"><Label>Notes</Label><Textarea name="notes" /></div>
                        <Button type="submit">Save Progress</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
                {canManage && o.status === "completed" && o.paymentStatus !== "fully_paid" && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openPaymentDialog(o, "final")}>
                    <CreditCard className="h-3.5 w-3.5" /> Upload Final Proof
                  </Button>
                )}
                {(isAdmin || canManage) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirmEntityDelete(o, "sale")) deleteOrder.mutate({ id: o.id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </AppleCard>
          ))}
        </div>
      )}
      {orders && <SoftwarePagination page={page} totalPages={orders.totalPages} onPageChange={setPage} />}

      <RecordPaymentDialog
        open={paymentDialog !== null}
        onOpenChange={(open) => !open && setPaymentDialog(null)}
        orderId={paymentDialog?.orderId ?? null}
        orderLabel={paymentDialog?.label}
        paymentType={paymentDialog?.type}
        defaultAmount={paymentDialog?.amount ?? ""}
        onSuccess={() => refetch()}
      />

      <OrderDetailDialog orderId={viewOrderId} open={viewOrderId !== null} onOpenChange={(open) => !open && setViewOrderId(null)} />

      <RejectReasonDialog
        open={rejectOrderId !== null}
        onOpenChange={(open) => !open && setRejectOrderId(null)}
        title="Reject Order"
        isPending={approveOrder.isPending}
        onConfirm={(reason) => {
          if (rejectOrderId) approveOrder.mutate({ id: rejectOrderId, action: "reject", reason });
        }}
      />
    </SoftwareTabPanel>
  );
}
