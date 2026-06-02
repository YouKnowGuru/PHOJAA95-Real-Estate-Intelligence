import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Plus, Wallet } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "cheque", label: "Cheque" },
  { value: "online_payment", label: "Online Payment" },
];

export default function SoftwarePayments() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);

  const { data: sales } = trpc.softwareSale.list.useQuery({ status: "approved", page: 1, limit: 100 });
  const { data, isLoading, refetch } = trpc.softwarePayment.list.useQuery({ page: 1, limit: 50 });
  const { data: stats } = trpc.softwarePayment.stats.useQuery();

  const createMutation = trpc.softwarePayment.create.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      setIsCreateOpen(false);
      setSelectedSale(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaleSelect = (saleId: string) => {
    const sale = sales?.items?.find((s: any) => s.id === Number(saleId));
    setSelectedSale(sale || null);
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      saleId: Number(formData.get("saleId")),
      paymentDate: formData.get("paymentDate") as string,
      paymentMethod: formData.get("paymentMethod") as any,
      referenceNumber: formData.get("referenceNumber") as string,
      amount: formData.get("amount") as string,
      notes: formData.get("notes") as string,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading payments..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Payments"
        description="Manage software development payments"
        icon={<CreditCard className="h-5 w-5" />}
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Sale *</label>
                  <Select name="saleId" required onValueChange={handleSaleSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sale" />
                    </SelectTrigger>
                    <SelectContent>
                      {sales?.items?.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.saleNumber} - Balance: Nu.{Number(s.outstandingBalance).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSale && (
                  <AppleCard className="bg-primary/5 border-primary/20">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grand Total:</span>
                        <span>Nu.{Number(selectedSale.grandTotal).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Paid:</span>
                        <span>Nu.{Number(selectedSale.totalPaid).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-muted-foreground">Outstanding:</span>
                        <span className="text-red-500">Nu.{Number(selectedSale.outstandingBalance).toLocaleString()}</span>
                      </div>
                    </div>
                  </AppleCard>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Date *</label>
                    <Input name="paymentDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method *</label>
                    <Select name="paymentMethod" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (Nu.) *</label>
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      defaultValue={selectedSale?.outstandingBalance}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reference Number</label>
                    <Input name="referenceNumber" placeholder="Transaction reference" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    name="notes"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Payment notes..."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <AppleCard className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Payments</p>
            <p className="text-2xl font-bold">{stats?.totalPayments || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{stats?.pendingPayments || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold">Nu.{(stats?.totalOutstanding || 0).toLocaleString()}</p>
          </div>
        </AppleCard>
      </div>

      {/* Payments Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Payment #</th>
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 px-4 font-medium">Method</th>
                  <th className="text-left py-3 px-4 font-medium">Amount</th>
                  <th className="text-left py-3 px-4 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((payment: any) => (
                  <tr key={payment.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-xs">{payment.paymentNumber}</td>
                    <td className="py-3 px-4">{payment.paymentDate}</td>
                    <td className="py-3 px-4 capitalize">{payment.paymentMethod.replace(/_/g, " ")}</td>
                    <td className="py-3 px-4 font-medium text-green-600">Nu.{Number(payment.amount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-muted-foreground">{payment.referenceNumber || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No payments found"
            description="Record your first payment to get started."
            icon={CreditCard}
          />
        )}
      </AppleCard>
    </AnimatedPage>
  );
}
