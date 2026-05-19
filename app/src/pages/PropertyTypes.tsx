import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Building2, Trash2, Edit3, Save, X, PackageOpen, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";

function SummaryCard({ title, value, color, iconBg, icon: Icon, delay = 0 }: { title: string; value: string | number; color: string; iconBg: string; icon: any; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      <motion.div whileHover={{ y: -4 }} className="group relative overflow-hidden border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
        <Card className="border-0 bg-transparent shadow-none">
          <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default function PropertyTypes() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<any>(null);

  const { data, isLoading } = trpc.propertyType.list.useQuery();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    requiresBuildingDocs: false,
  });

  const createMutation = trpc.propertyType.create.useMutation({
    onSuccess: () => {
      toast.success("Property type created");
      utils.propertyType.list.invalidate();
      setShowAdd(false);
      setFormData({ name: "", description: "", requiresBuildingDocs: false });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.propertyType.update.useMutation({
    onSuccess: () => {
      toast.success("Property type updated");
      utils.propertyType.list.invalidate();
      setShowEdit(null);
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      id: showEdit.id,
      name: showEdit.name,
      description: showEdit.description,
      requiresBuildingDocs: showEdit.requiresBuildingDocs,
    });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            Property Types
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage categories and requirements</p>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" />
            Add Type
          </Button>
        </motion.div>
      </motion.div>

      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total Types" value={data?.length || 0} color="bg-primary" iconBg="bg-primary/10 dark:bg-primary/20" icon={Layers} delay={0} />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-border/50 bg-white/70 dark:bg-slate-800/70 overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
            <CardContent className="py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-bold text-foreground">No property types found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Add your first property type to categorize listings and enforce document requirements.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <Card className="relative h-full border-border/50 bg-white/70 dark:bg-slate-800/70 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-primary/5">
                <div className={`absolute left-0 top-0 h-full w-1 ${type.requiresBuildingDocs ? "bg-amber-500" : "bg-primary"}`} />
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{type.name}</h3>
                        {type.requiresBuildingDocs && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            Requires Building Docs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground flex-1 mb-4 line-clamp-2">
                    {type.description || "No description provided."}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border/50">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => setShowEdit(type)}
                    >
                      <Edit3 className="h-3 w-3 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${type.name}?`)) {
                          deleteMutation.mutate({ id: type.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Property Type</DialogTitle>
            <DialogDescription>Create a new category for properties</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                placeholder="e.g. Apartment, Land, Commercial"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                placeholder="Brief description of this type"
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg border-border/50 bg-slate-50 dark:bg-slate-900">
              <div className="space-y-0.5">
                <Label>Require Building Documents</Label>
                <p className="text-xs text-muted-foreground">Does this type need structural drawings/docs?</p>
              </div>
              <Switch
                checked={formData.requiresBuildingDocs}
                onCheckedChange={(checked) => setFormData({ ...formData, requiresBuildingDocs: checked })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary text-white">
                <Save className="mr-2 h-4 w-4" /> {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Property Type</DialogTitle>
            <DialogDescription>Update property category details</DialogDescription>
          </DialogHeader>
          {showEdit && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input 
                  value={showEdit.name} 
                  onChange={(e) => setShowEdit({ ...showEdit, name: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  value={showEdit.description || ""} 
                  onChange={(e) => setShowEdit({ ...showEdit, description: e.target.value })} 
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg border-border/50 bg-slate-50 dark:bg-slate-900">
                <div className="space-y-0.5">
                  <Label>Require Building Documents</Label>
                  <p className="text-xs text-muted-foreground">Does this type need structural drawings/docs?</p>
                </div>
                <Switch
                  checked={showEdit.requiresBuildingDocs}
                  onCheckedChange={(checked) => setShowEdit({ ...showEdit, requiresBuildingDocs: checked })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEdit(null)}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="bg-primary text-white">
                  <Save className="mr-2 h-4 w-4" /> {updateMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
