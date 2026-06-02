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
import { toast } from "sonner";
import {
  UserCheck,
  Search,
  Plus,
  Eye,
  Trash2,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

export default function SoftwareCustomers() {
  const [search, setSearch] = useState("");
  const [page] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<any>(null);

  const { data, isLoading, refetch } = trpc.softwareCustomer.list.useQuery({
    search: search || undefined,
    page,
    limit: 10,
  });

  const createMutation = trpc.softwareCustomer.create.useMutation({
    onSuccess: () => {
      toast.success("Customer created successfully");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.softwareCustomer.delete.useMutation({
    onSuccess: () => {
      toast.success("Customer deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      fullName: formData.get("fullName") as string,
      companyName: formData.get("companyName") as string,
      contactPerson: formData.get("contactPerson") as string,
      phone: formData.get("phone") as string,
      alternatePhone: formData.get("alternatePhone") as string,
      email: formData.get("email") as string,
      country: formData.get("country") as string,
      state: formData.get("state") as string,
      city: formData.get("city") as string,
      address: formData.get("address") as string,
      postalCode: formData.get("postalCode") as string,
      taxNumber: formData.get("taxNumber") as string,
      notes: formData.get("notes") as string,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading customers..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Software Customers"
        description="Manage your software development customers"
        icon={<UserCheck className="h-5 w-5" />}
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name *</label>
                    <Input name="fullName" required placeholder="Enter full name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company Name</label>
                    <Input name="companyName" placeholder="Enter company name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contact Person</label>
                    <Input name="contactPerson" placeholder="Enter contact person" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number *</label>
                    <Input name="phone" required placeholder="Enter phone number" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alternate Phone</label>
                    <Input name="alternatePhone" placeholder="Enter alternate phone" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address *</label>
                    <Input name="email" type="email" required placeholder="Enter email" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <Input name="country" placeholder="Country" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <Input name="state" placeholder="State" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input name="city" placeholder="City" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Address</label>
                  <textarea
                    name="address"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Enter full address..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Postal Code</label>
                    <Input name="postalCode" placeholder="Postal code" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax Number</label>
                    <Input name="taxNumber" placeholder="Tax number" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    name="notes"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Additional notes..."
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Customer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Customers Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Customer ID</th>
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Company</th>
                  <th className="text-left py-3 px-4 font-medium">Contact</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((customer: any) => (
                  <tr key={customer.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-xs">{customer.customerId}</td>
                    <td className="py-3 px-4 font-medium">{customer.fullName}</td>
                    <td className="py-3 px-4">{customer.companyName || "-"}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewCustomer(customer)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this customer?")) deleteMutation.mutate({ id: customer.id });
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
            title="No customers found"
            description="Create your first customer to get started."
            icon={UserCheck}
          />
        )}
      </AppleCard>

      {/* View Customer Dialog */}
      <Dialog open={!!viewCustomer} onOpenChange={() => setViewCustomer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewCustomer?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Customer ID:</span>
              <span className="font-mono">{viewCustomer?.customerId}</span>
            </div>
            {viewCustomer?.companyName && (
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Company:</span>
                <span>{viewCustomer.companyName}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Phone:</span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {viewCustomer?.phone}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Email:</span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {viewCustomer?.email}
              </span>
            </div>
            {(viewCustomer?.country || viewCustomer?.city) && (
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Location:</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[viewCustomer?.city, viewCustomer?.state, viewCustomer?.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {viewCustomer?.address && (
              <div className="pt-2 border-t border-border/30">
                <span className="text-muted-foreground block mb-1">Address:</span>
                <p>{viewCustomer.address}</p>
              </div>
            )}
            {viewCustomer?.notes && (
              <div className="pt-2 border-t border-border/30">
                <span className="text-muted-foreground block mb-1">Notes:</span>
                <p>{viewCustomer.notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
