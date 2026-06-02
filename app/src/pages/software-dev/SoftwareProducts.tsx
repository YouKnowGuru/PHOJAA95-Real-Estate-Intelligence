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
  Package,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const PRODUCT_CATEGORIES = [
  { value: "website", label: "Website" },
  { value: "web_application", label: "Web Application" },
  { value: "android_application", label: "Android Application" },
  { value: "ios_application", label: "iOS Application" },
  { value: "desktop_software", label: "Desktop Software" },
  { value: "erp_system", label: "ERP System" },
  { value: "pos_system", label: "POS System" },
  { value: "crm_system", label: "CRM System" },
  { value: "ecommerce_platform", label: "E-commerce Platform" },
  { value: "saas_platform", label: "SaaS Platform" },
  { value: "api_service", label: "API Service" },
  { value: "custom_software", label: "Custom Software" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "pending_approval", label: "Pending Approval", color: "warning" },
  { value: "approved", label: "Approved", color: "info" },
  { value: "under_development", label: "Under Development", color: "primary" },
  { value: "testing", label: "Testing", color: "warning" },
  { value: "completed", label: "Completed", color: "success" },
  { value: "published", label: "Published", color: "success" },
  { value: "archived", label: "Archived", color: "secondary" },
  { value: "rejected", label: "Rejected", color: "destructive" },
] as const;

export default function SoftwareProducts() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<any>(null);

  const { data, isLoading, refetch } = trpc.softwareProduct.list.useQuery({
    search: search || undefined,
    category: category === "all" ? undefined : category,
    status: status === "all" ? undefined : status,
    page,
    limit: 10,
  });

  const createMutation = trpc.softwareProduct.create.useMutation({
    onSuccess: () => {
      toast.success("Product created successfully");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const submitMutation = trpc.softwareProduct.submitForApproval.useMutation({
    onSuccess: () => {
      toast.success("Product submitted for approval");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.softwareProduct.approve.useMutation({
    onSuccess: () => {
      toast.success("Product status updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.softwareProduct.delete.useMutation({
    onSuccess: () => {
      toast.success("Product deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get("name") as string,
      category: formData.get("category") as any,
      shortDescription: formData.get("shortDescription") as string,
      detailedDescription: formData.get("detailedDescription") as string,
      technologiesUsed: formData.get("technologiesUsed") as string,
      estimatedDuration: formData.get("estimatedDuration") as string,
      price: formData.get("price") as string,
      version: formData.get("version") as string,
      warrantyPeriod: Number(formData.get("warrantyPeriod") || 0),
      maintenancePeriod: Number(formData.get("maintenancePeriod") || 0),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading products..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Software Products"
        description="Manage your software products"
        icon={<Package className="h-5 w-5" />}
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Product</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Product Name</label>
                    <Input name="name" required placeholder="Enter product name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select name="category" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Short Description</label>
                  <Input name="shortDescription" placeholder="Brief description" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Detailed Description</label>
                  <textarea
                    name="detailedDescription"
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Detailed description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Technologies Used</label>
                    <Input name="technologiesUsed" placeholder="e.g. React, Node.js" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estimated Duration</label>
                    <Input name="estimatedDuration" placeholder="e.g. 3 months" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price (Nu.)</label>
                    <Input name="price" type="number" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Version</label>
                    <Input name="version" placeholder="1.0.0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Warranty (months)</label>
                    <Input name="warrantyPeriod" type="number" placeholder="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Maintenance Period (months)</label>
                  <Input name="maintenancePeriod" type="number" placeholder="0" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Product"}
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
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PRODUCT_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Products Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Code</th>
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Category</th>
                  <th className="text-left py-3 px-4 font-medium">Price</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product: any) => (
                  <tr key={product.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-xs">{product.productCode}</td>
                    <td className="py-3 px-4 font-medium">{product.name}</td>
                    <td className="py-3 px-4">
                      {PRODUCT_CATEGORIES.find((c) => c.value === product.category)?.label || product.category}
                    </td>
                    <td className="py-3 px-4">Nu.{Number(product.price).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <StatusBadge variant={getStatusVariant(product.status)}>{formatStatusLabel(product.status)}</StatusBadge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewProduct(product)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(product.status === "draft" || product.status === "rejected") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => submitMutation.mutate({ id: product.id })}
                            disabled={submitMutation.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && product.status === "pending_approval" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => approveMutation.mutate({ id: product.id, status: "approved" })}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const reason = prompt("Rejection reason:");
                                if (reason) approveMutation.mutate({ id: product.id, status: "rejected", reason });
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
                            if (confirm("Delete this product?")) deleteMutation.mutate({ id: product.id });
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
            title="No products found"
            description="Create your first software product to get started."
            icon={Package}
          />
        )}
      </AppleCard>

      {/* View Product Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={() => setViewProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Product Code:</span>
              <span className="font-mono">{viewProduct?.productCode}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Category:</span>
              <span>{PRODUCT_CATEGORIES.find((c) => c.value === viewProduct?.category)?.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Price:</span>
              <span>Nu.{Number(viewProduct?.price).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Version:</span>
              <span>{viewProduct?.version}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Status:</span>
              <StatusBadge variant={getStatusVariant(viewProduct?.status)}>{formatStatusLabel(viewProduct?.status)}</StatusBadge>
            </div>
            {viewProduct?.shortDescription && (
              <div className="pt-2 border-t border-border/30">
                <span className="text-muted-foreground block mb-1">Description:</span>
                <p>{viewProduct.shortDescription}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
