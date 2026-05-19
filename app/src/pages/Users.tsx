import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, UserCircle, Lock, Unlock, Edit3, Trash2, PackageOpen, Users as UsersIcon, Shield } from "lucide-react";
import { motion } from "framer-motion";

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

export default function Users() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data, isLoading } = trpc.user.list.useQuery({
    search: search || undefined,
    page: 1,
    limit: 50,
  });

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "staff" as "staff" | "admin",
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <UsersIcon className="h-7 w-7 text-primary" />
            Staff Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage staff accounts and permissions</p>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" />
            Add Staff
          </Button>
        </motion.div>
      </motion.div>

      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total Staff" value={totalStaff} color="bg-primary" iconBg="bg-primary/10 dark:bg-primary/20" icon={UsersIcon} delay={0} />
          <SummaryCard title="Admins" value={totalAdmins} color="bg-indigo-500" iconBg="bg-indigo-500/10 dark:bg-indigo-500/20" icon={Shield} delay={0.1} />
          <SummaryCard title="Locked Accounts" value={totalLocked} color="bg-red-500" iconBg="bg-red-500/10 dark:bg-red-500/20" icon={Lock} delay={0.2} />
        </div>
      )}

      <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50 bg-white/70 dark:bg-slate-800/70 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                    <div className="flex gap-3">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
            <CardContent className="py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-bold text-foreground">No staff members found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Add your first staff member to get started with team management.</p>
            </CardContent>
          </Card>
        </motion.div>
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
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <Card className="relative border-border/50 bg-white/70 dark:bg-slate-800/70 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-primary/5">
                  <div className={`absolute left-0 top-0 h-full w-1 ${accentColor}`} />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                        <UserCircle className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{user.fullName}</h3>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                            {user.role}
                          </Badge>
                          <Badge
                            variant={user.status === "active" ? "outline" : user.status === "locked" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {user.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="flex gap-3 mt-1">
                          {user.phone && <p className="text-[10px] text-muted-foreground">📞 {user.phone}</p>}
                          {user.pfNumber && <p className="text-[10px] text-primary font-medium">🆔 PF: {user.pfNumber}</p>}
                          {user.employeeId && <p className="text-[10px] text-indigo-600 font-medium">👤 ID: {user.employeeId}</p>}
                          {parseFloat(user.pfPercentage || "0") > 0 && (
                            <p className="text-[10px] text-emerald-600 font-medium">💰 PF %: {user.pfPercentage}%</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowEdit(user)}
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowResetPassword(user.id)}
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          Reset PW
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
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
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
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v: "staff" | "admin") => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>Update staff account details</DialogDescription>
          </DialogHeader>
          {showEdit && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              updateMutation.mutate({
                id: showEdit.id,
                fullName: formData.get("fullName") as string,
                phone: formData.get("phone") as string,
                pfPercentage: formData.get("pfPercentage") as string,
                employeeId: formData.get("employeeId") as string,
                role: formData.get("role") as "staff" | "admin",
                status: formData.get("status") as "active" | "inactive" | "locked",
              });
            }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input name="fullName" defaultValue={showEdit.fullName} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input name="phone" defaultValue={showEdit.phone || ""} />
                  </div>
                </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input name="employeeId" defaultValue={showEdit.employeeId || ""} placeholder="e.g. EMP001" />
                </div>
                <div className="space-y-2">
                  <Label>PF Percentage (%)</Label>
                  <Input name="pfPercentage" type="number" step="0.01" defaultValue={showEdit.pfPercentage || "0"} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select name="role" defaultValue={showEdit.role}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select name="status" defaultValue={showEdit.status}>
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
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showResetPassword} onOpenChange={() => setShowResetPassword(null)}>
        <DialogContent className="sm:max-w-md">
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
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => {
                    if (!newPassword || newPassword.length < 6) {
                      toast.error("Password must be at least 6 characters");
                      return;
                    }
                    resetPasswordMutation.mutate({ id: showResetPassword!, newPassword });
                  }}
                  disabled={resetPasswordMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20"
                >
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </motion.div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
