import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploader } from "@/components/FileUploader";
import { PaymentProofPreview } from "./PaymentProofPreview";
import { softwareFormDialogClass } from "@/components/software-dev";
import { toast } from "sonner";

const emptyForm = {
  paymentType: "advance" as "advance" | "final" | "other",
  paymentDate: new Date().toISOString().split("T")[0],
  paymentMethod: "bank_transfer" as "cash" | "bank_transfer" | "mobile_banking" | "cheque" | "online_payment",
  amount: "",
  referenceNumber: "",
  notes: "",
  proofDocumentUrl: "",
};

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number | null;
  orderLabel?: string;
  paymentType?: "advance" | "final";
  defaultAmount?: string;
  onSuccess?: () => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  orderId,
  orderLabel,
  paymentType = "advance",
  defaultAmount = "",
  onSuccess,
}: RecordPaymentDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (open && orderId) {
      setForm({
        ...emptyForm,
        paymentType,
        paymentDate: new Date().toISOString().split("T")[0],
        amount: defaultAmount,
      });
    }
    if (!open) setForm(emptyForm);
  }, [open, orderId, paymentType, defaultAmount]);

  const createPayment = trpc.architecturePayment.create.useMutation({
    onSuccess: () => {
      toast.success("Payment submitted for admin verification");
      onOpenChange(false);
      utils.architecturePayment.list.invalidate();
      utils.architecturePayment.pendingVerifications.invalidate();
      utils.architectureOrder.list.invalidate();
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={softwareFormDialogClass}>
        <DialogHeader>
          <DialogTitle>
            Upload Payment Proof — {paymentType === "advance" ? "50% Advance" : "Final Payment"}
          </DialogTitle>
          {orderLabel && <p className="text-sm text-muted-foreground">{orderLabel}</p>}
          <p className="text-sm text-muted-foreground">
            Architecture staff uploads the bank/mobile payment screenshot here. Admin verifies it in the Payments tab.
          </p>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!orderId) return;
            if (!form.proofDocumentUrl) {
              toast.error("Please upload a payment proof screenshot");
              return;
            }
            createPayment.mutate({ orderId, ...form });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount (Nu.) *</Label>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Payment Date *</Label>
              <Input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Payment Method *</Label>
              <Select value={form.paymentMethod} onValueChange={(v: typeof form.paymentMethod) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="online_payment">Online Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reference Number</Label>
              <Input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Txn ID" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <Label className="text-base">Payment Screenshot *</Label>
            <p className="text-xs text-muted-foreground">Upload PNG/JPEG of bank or mobile banking confirmation.</p>
            <FileUploader
              folder="architecture"
              accept="image/*,.pdf"
              value={form.proofDocumentUrl}
              onChange={(url) => setForm({ ...form, proofDocumentUrl: url })}
            />
            {form.proofDocumentUrl && <PaymentProofPreview url={form.proofDocumentUrl} compact />}
          </div>
          <Button type="submit" className="w-full" disabled={createPayment.isPending || !form.proofDocumentUrl}>
            {createPayment.isPending ? "Submitting..." : "Submit for Admin Verification"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
