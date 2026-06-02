import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getStatusVariant, formatStatusLabel } from "@/components/software-dev/utils";
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
import {
  ShoppingCart,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "pending_approval", label: "Pending Approval", color: "warning" },
  { value: "approved", label: "Approved", color: "info" },
  { value: "rejected", label: "Rejected", color: "destructive" },
  { value: "payment_pending", label: "Payment Pending", color: "warning" },
  { value: "partially_paid", label: "Partially Paid", color: "warning" },
  { value: "fully_paid", label: "Fully Paid", color: "success" },
  { value: "completed", label: "Completed", color: "success" },
] as const;

export default function SoftwareSales() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewSale, setViewSale] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [additionalFeatures, setAdditionalFeatures] = useState<any[]>([]);

  const { data: customers } = trpc.softwareCustomer.list.useQuery({ page: 1, limit: 100 });
  const { data: products } = trpc.softwareProduct.getSellable.useQuery();

  const { data, isLoading, refetch } = trpc.softwareSale.list.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    page,
    limit: 10,
  });

  const createMutation = trpc.softwareSale.create.useMutation({
    onSuccess: () => {
      toast.success("Sale created successfully");
      setIsCreateOpen(false);
      setSelectedProduct(null);
      setAdditionalFeatures([]);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const submitMutation = trpc.softwareSale.submitForApproval.useMutation({
    onSuccess: () => {
      toast.success("Sale submitted for approval");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.softwareSale.approve.useMutation({
    onSuccess: () => {
      toast.success("Sale status updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.softwareSale.delete.useMutation({
    onSuccess: () => {
      toast.success("Sale deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleProductSelect = (productId: string) => {
    const product = products?.find((p: any) => p.id === Number(productId));
    setSelectedProduct(product || null);
  };

  const calculateTotals = () => {
    const basePrice = parseFloat(selectedProduct?.price || "0");
    const featuresCost = additionalFeatures.reduce((sum, f) => sum + parseFloat(f.price || "0"), 0);
    const discount = 0;
    const tax = 0;
    const grandTotal = basePrice + featuresCost - discount + tax;
    return { basePrice, featuresCost, discount, tax, grandTotal };
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const totals = calculateTotals();

    createMutation.mutate({
      customerId: Number(formData.get("customerId")),
      productId: Number(formData.get("productId")),
      projectId: formData.get("projectId") ? Number(formData.get("projectId")) : undefined,
      basePrice: totals.basePrice.toFixed(2),
      additionalFeaturesCost: totals.featuresCost.toFixed(2),
      discountAmount: totals.discount.toFixed(2),
      taxAmount: totals.tax.toFixed(2),
      grandTotal: totals.grandTotal.toFixed(2),
      paymentType: formData.get("paymentType") as any,
      features: additionalFeatures.filter((f) => f.name && f.price),
    });
  };

  const addFeature = () => {
    setAdditionalFeatures([...additionalFeatures, { name: "", description: "", price: "" }]);
  };

  const updateFeature = (index: number, field: string, value: string) => {
    const updated = [...additionalFeatures];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalFeatures(updated);
  };

  const removeFeature = (index: number) => {
    setAdditionalFeatures(additionalFeatures.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading sales..." />
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <AnimatedPage>
      <PageHeader
        title="Software Sales"
        description="Manage your software sales"
        icon={<ShoppingCart className="h-5 w-5" />}
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Sale
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Sale</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Customer Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Customer *</label>
                  <Select name="customerId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.items?.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.fullName} {c.companyName ? `(${c.companyName})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Selection - CRITICAL: No manual typing */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Product *</label>
                  <Select name="productId" required onValueChange={handleProductSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product (auto-loads data)" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} - Nu.{Number(p.price).toLocaleString()} ({p.version})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-loaded Product Info */}
                {selectedProduct && (
                  <AppleCard className="bg-primary/5 border-primary/20">
                    <h4 className="font-medium text-sm mb-2">Product Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> {selectedProduct.name}</div>
                      <div><span className="text-muted-foreground">Category:</span> {selectedProduct.category}</div>
                      <div><span className="text-muted-foreground">Version:</span> {selectedProduct.version}</div>
                      <div><span className="text-muted-foreground">Base Price:</span> Nu.{Number(selectedProduct.price).toLocaleString()}</div>
                    </div>
                  </AppleCard>
                )}

                {/* Additional Features */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Additional Features</label>
                    <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Feature
                    </Button>
                  </div>
                  {additionalFeatures.map((feature, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2 items-end">
                      <Input
                        placeholder="Feature name"
                        value={feature.name}
                        onChange={(e) => updateFeature(index, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Description"
                        value={feature.description}
                        onChange={(e) => updateFeature(index, "description", e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Price"
                          value={feature.price}
                          onChange={(e) => updateFeature(index, "price", e.target.value)}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFeature(index)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Type</label>
                  <Select name="paymentType" defaultValue="full">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Payment</SelectItem>
                      <SelectItem value="advance_50">50% Advance Payment</SelectItem>
                      <SelectItem value="milestone">Custom Milestone Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pricing Summary */}
                <AppleCard className="bg-muted/50">
                  <h4 className="font-medium text-sm mb-3">Pricing Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Price:</span>
                      <span>Nu.{totals.basePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Additional Features:</span>
                      <span>Nu.{totals.featuresCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount:</span>
                      <span>Nu.{totals.discount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax:</span>
                      <span>Nu.{totals.tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base pt-2 border-t border-border/30">
                      <span>Grand Total:</span>
                      <span>Nu.{totals.grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </AppleCard>

                <Button type="submit" className="w-full" disabled={createMutation.isPending || !selectedProduct}>
                  {createMutation.isPending ? "Creating..." : "Create Sale"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sales..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sales Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Sale #</th>
                  <th className="text-left py-3 px-4 font-medium">Grand Total</th>
                  <th className="text-left py-3 px-4 font-medium">Paid</th>
                  <th className="text-left py-3 px-4 font-medium">Balance</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((sale: any) => (
                  <tr key={sale.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-xs">{sale.saleNumber}</td>
                    <td className="py-3 px-4 font-medium">Nu.{Number(sale.grandTotal).toLocaleString()}</td>
                    <td className="py-3 px-4 text-green-600">Nu.{Number(sale.totalPaid).toLocaleString()}</td>
                    <td className="py-3 px-4 text-red-500">Nu.{Number(sale.outstandingBalance).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <StatusBadge variant={getStatusVariant(sale.status)}>{formatStatusLabel(sale.status)}</StatusBadge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewSale(sale)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(sale.status === "draft" || sale.status === "rejected") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => submitMutation.mutate({ id: sale.id })}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && sale.status === "pending_approval" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => approveMutation.mutate({ id: sale.id, action: "approve" })}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const reason = prompt("Rejection reason:");
                                if (reason) approveMutation.mutate({ id: sale.id, action: "reject", reason });
                              }}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this sale?")) deleteMutation.mutate({ id: sale.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No sales found"
            description="Create your first sale to get started."
            icon={ShoppingCart}
          />
        )}
      </AppleCard>

      {/* View Sale Dialog */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sale {viewSale?.saleNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Grand Total:</span>
              <span className="font-semibold">Nu.{Number(viewSale?.grandTotal).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Total Paid:</span>
              <span className="text-green-600">Nu.{Number(viewSale?.totalPaid).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Outstanding:</span>
              <span className="text-red-500">Nu.{Number(viewSale?.outstandingBalance).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Payment Type:</span>
              <span className="capitalize">{viewSale?.paymentType?.replace(/_/g, " ")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Status:</span>
              <StatusBadge variant={getStatusVariant(viewSale?.status)}>{formatStatusLabel(viewSale?.status)}</StatusBadge>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
