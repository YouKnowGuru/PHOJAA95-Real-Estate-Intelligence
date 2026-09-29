import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SoftwareTabPanel, SoftwarePagination, softwareFormDialogClass, TabToolbar, TabSearchWrap, confirmEntityDelete } from "@/components/software-dev";
import { CustomerDetailDialog } from "@/components/architecture";
import { TabSectionHeader } from "../TabSectionHeader";
import { Plus, Search, Eye, Trash2 } from "lucide-react";

export default function CustomersTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [viewCustomerId, setViewCustomerId] = useState<number | null>(null);
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", alternatePhone: "",
    country: "", state: "", city: "", address: "", postalCode: "", mapLocation: "", notes: "",
  });

  const { data, refetch } = trpc.architectureCustomer.list.useQuery({
    search: search || undefined, page, limit: 12,
  });

  const createMutation = trpc.architectureCustomer.create.useMutation({
    onSuccess: (result) => {
      toast.success("Customer created");
      if (result.portalToken) {
        toast.info(`Portal: ${window.location.origin}/portal/architecture/${result.portalToken}`, { duration: 10000 });
      }
      setShowForm(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.architectureCustomer.delete.useMutation({
    onSuccess: () => { toast.success("Customer deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Customers"
        description="Manage architecture clients. Admin can view full details and delete records."
        actions={canManage ? (
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Customer</Button></DialogTrigger>
            <DialogContent className={softwareFormDialogClass}>
              <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Full Name *</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
                  <div className="space-y-1"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                  <div className="space-y-1"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
                  <div className="space-y-1"><Label>Alt. Phone</Label><Input value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                  <div className="space-y-1"><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                  <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="space-y-1"><Label>Postal Code</Label><Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
                <div className="space-y-1"><Label>Google Map Location</Label><Input value={form.mapLocation} onChange={(e) => setForm({ ...form, mapLocation: e.target.value })} /></div>
                <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" disabled={createMutation.isPending}>Create Customer</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <TabToolbar>
        <TabSearchWrap>
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </TabSearchWrap>
      </TabToolbar>

      {!data?.items.length ? (
        <EmptyState title="No customers" description={canManage ? "Add your first architecture customer." : "No customer records yet."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.items.map((c) => (
            <AppleCard key={c.id} className="flex flex-col p-4 transition-shadow hover:shadow-md">
              <h3 className="font-semibold">{c.fullName}</h3>
              <p className="text-sm text-muted-foreground">{c.customerId}</p>
              <div className="mt-2 space-y-1 text-sm flex-1">
                <p>{c.email}</p>
                <p>{c.phone}</p>
                {c.address && <p className="text-muted-foreground line-clamp-2">{c.address}</p>}
                {c.city && <p className="text-muted-foreground">{[c.city, c.state, c.country].filter(Boolean).join(", ")}</p>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="gap-1" onClick={() => setViewCustomerId(c.id)}>
                  <Eye className="h-3.5 w-3.5" /> View Details
                </Button>
                {(c as { portalToken?: string }).portalToken && (
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/portal/architecture/${(c as { portalToken?: string }).portalToken}`);
                    toast.success("Portal link copied");
                  }}>Copy Portal</Button>
                )}
                {(isAdmin || canManage) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirmEntityDelete(c, "customer")) deleteMutation.mutate({ id: c.id });
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
      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}

      <CustomerDetailDialog
        customerId={viewCustomerId}
        open={viewCustomerId !== null}
        onOpenChange={(open) => !open && setViewCustomerId(null)}
      />
    </SoftwareTabPanel>
  );
}
