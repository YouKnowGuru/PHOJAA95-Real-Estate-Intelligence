import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Building2, Trash2, Edit3, PackageOpen } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PropertyTypes() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string; description: string } | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data, isLoading } = trpc.propertyType.list.useQuery();

  const createMutation = trpc.propertyType.create.useMutation({
    onSuccess: () => {
      toast.success("Property type created");
      utils.propertyType.list.invalidate();
      setShowAdd(false);
      setForm({ name: "", description: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.propertyType.update.useMutation({
    onSuccess: () => {
      toast.success("Property type updated");
      utils.propertyType.list.invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.propertyType.delete.useMutation({
    onSuccess: () => {
      toast.success("Property type deleted");
      utils.propertyType.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <AnimatedPage>
      <PageHeader
        title="Property Types"
        description="Manage property categories"
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <Button onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
            <Plus className="h-4 w-4" />
            Add Type
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No property types"
          description="Add your first property type to get started."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <AppleCard>
                <AppleCardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold">{type.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {type.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing({ id: type.id, name: type.name, description: type.description || "" })}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Delete property type "${type.name}"?`)) {
                            deleteMutation.mutate({ id: type.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </AppleCardContent>
              </AppleCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Property Type</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Property Type</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({ id: editing.id, name: editing.name, description: editing.description });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
