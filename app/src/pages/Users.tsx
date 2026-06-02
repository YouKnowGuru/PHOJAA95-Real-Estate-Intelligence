import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, UserCircle, Lock, Unlock, Edit3, Trash2, PackageOpen, Users as UsersIcon, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { KPICard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export default function Users() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);
  
  const [showEdit, setShowEdit] = useState<NonNullable<typeof data>["items"][number] | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    employeeId: "",
    pfPercentage: "",
    role: "staff" as "staff" | "admin" | "developer" | "architecture_staff",
    status: "active" as "active" | "inactive" | "locked",
  });

  useEffect(() => {
    if (showEdit) {
      setEditForm({
        fullName: showEdit.fullName,
        phone: showEdit.phone || "",
        employeeId: showEdit.employeeId || "",
        pfPercentage: showEdit.pfPercentage || "0",
        role: showEdit.role,
        status: showEdit.status,
      });
    }
  }, [showEdit]);

  const { data, isLoading } = trpc.user.list.useQuery({
    search: debouncedSearch || undefined,
    page: 1,
    limit: 50,
  });

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "staff" as "staff" | "admin" | "developer" | "architecture_staff",
    phone: "",
    address: "",
    pfNumber: "",
    pfPercentage: "0",
    employeeId: "",
  });

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      toast.success("Staff member created");
      utils.user.list.invalidate();
      setShowAdd(false);
      setFormData({ fullName: "", email: "", password: "", role: "staff", phone: "", address: "", pfNumber: "", pfPercentage: "0", employeeId: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPasswordMutation = trpc.user.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully");
      setShowResetPassword(null);
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const unlockMutation = trpc.user.unlockAccount.useMutation({
    onSuccess: () => {
      toast.success("Account unlocked");
      utils.user.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success("Staff member deleted");
      utils.user.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      toast.success("Staff member updated");
      utils.user.list.invalidate();
      setShowEdit(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const totalStaff = data?.items?.length || 0;
  const totalAdmins = data?.items?.filter((u) => u.role === "admin").length || 0;
  const totalLocked = data?.items?.filter((u) => u.status === "locked").length || 0;

  return (
    <AnimatedPage>
      <PageHeader
        title="Staff Management"
        description="Manage staff accounts and permissions"
        icon={<UsersIcon className="h-5 w-5" />}
        actions={
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 gap-1.5">
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          </motion.div>
        }
      />

      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Total Staff" value={totalStaff} icon={UsersIcon} color="bg-primary" delay={0} />
          <KPICard title="Admins" value={totalAdmins} icon={Shield} color="bg-indigo-500" delay={0.1} />
          <KPICard title="Locked" value={totalLocked} icon={Lock} color="bg-red-500" delay={0.2} />
        </div>
      )}

      {/* Search */}
      <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search staff by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-background/80"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No staff members found"
          description="Add your first staff member to get started with team management."
        />
      ) : (
        <div className="space-y-3">
          {data?.items.map((user, index) => {
            const accentColor =
              user.role === "admin"
                ? "bg-primary"
                : user.status === "locked"
                ? "bg-red-500"
                : user.status === "inactive"
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.3 }}
                whileHover={{ y: -2 }}
              >
                <AppleCard hover={false} className="overflow-hidden">
                  <div className={`absolute left-0 top-0 h-full w-1 ${accentColor}`} />
                  <AppleCardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <UserCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{user.fullName}</h3>
                          <StatusBadge variant={user.role === "admin" ? "primary" : "neutral"}>
                            {user.role}
                          </StatusBadge>
                          <StatusBadge
                            variant={
                              user.status === "active"
                                ? "success"
                                : user.status === "locked"
                                ? "error"
                                : "warning"
                            }
                          >
                            {user.status}
                          </StatusBadge>
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          {user.phone && <p className="text-[10px] text-muted-foreground">{user.phone}</p>}
                          {user.pfNumber && <p className="text-[10px] text-primary font-medium">PF: {user.pfNumber}</p>}
                          {user.employeeId && <p className="text-[10px] text-indigo-600 font-medium">ID: {user.employeeId}</p>}
                          {parseFloat(user.pfPercentage || "0") > 0 && (
                            <p className="text-[10px] text-emerald-600 font-medium">PF %: {user.pfPercentage}%</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {user.status === "locked" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unlockMutation.mutate({ id: user.id })}
                            disabled={unlockMutation.isPending}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Unlock
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setShowEdit(user)}>
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowResetPassword(user.id)}>
                          <Lock className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                          onClick={() => {
                            if (confirm(`Are you sure you want to permanently delete ${user.fullName}?`)) {
                              deleteMutation.mutate({ id: user.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </AppleCardContent>
                </AppleCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => {
        if (!open) {
          setShowAdd(false);
          setFormData({ fullName: "", email: "", password: "", role: "staff", phone: "", address: "", pfNumber: "", pfPercentage: "0", employeeId: "" });
        }
      }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>Create a new staff account</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v: "staff" | "admin" | "developer" | "architecture_staff") => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="developer">Software Developer</SelectItem>
                  <SelectItem value="architecture_staff">Architecture Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} placeholder="e.g. EMP001" />
              </div>
              <div className="space-y-2">
                <Label>PF Number</Label>
                <Input value={formData.pfNumber} onChange={(e) => setFormData({ ...formData, pfNumber: e.target.value })} placeholder="e.g. PF12345" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>PF Percentage (%)</Label>
              <Input type="number" step="0.01" value={formData.pfPercentage} onChange={(e) => setFormData({ ...formData, pfPercentage: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>Update staff account details</DialogDescription>
          </DialogHeader>
          {showEdit && (
            <form onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: showEdit.id,
                fullName: editForm.fullName,
                phone: editForm.phone,
                pfPercentage: editForm.pfPercentage,
                employeeId: editForm.employeeId,
                role: editForm.role,
                status: editForm.status,
              });
            }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input value={editForm.employeeId} onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })} placeholder="e.g. EMP001" />
                </div>
                <div className="space-y-2">
                  <Label>PF Percentage (%)</Label>
                  <Input type="number" step="0.01" value={editForm.pfPercentage} onChange={(e) => setEditForm({ ...editForm, pfPercentage: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={(v: "staff" | "admin" | "developer" | "architecture_staff") => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="developer">Software Developer</SelectItem>
                      <SelectItem value="architecture_staff">Architecture Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v: "active" | "inactive" | "locked") => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="locked">Locked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showResetPassword} onOpenChange={(open) => {
        if (!open) {
          setShowResetPassword(null);
          setNewPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter a new password for this user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowResetPassword(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!newPassword || newPassword.length < 6) {
                    toast.error("Password must be at least 6 characters");
                    return;
                  }
                  resetPasswordMutation.mutate({ id: showResetPassword!, newPassword });
                }}
                disabled={resetPasswordMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
