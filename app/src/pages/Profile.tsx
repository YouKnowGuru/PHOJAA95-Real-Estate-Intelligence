import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { UserCircle, Mail, Phone, MapPin, Building2, Save, ShieldCheck, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { CloudinaryUpload } from "@/components/CloudinaryUpload";

export default function Profile() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const updateMutation = trpc.localAuth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.localAuth.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    address: user?.address || "",
    pfNumber: user?.pfNumber || "",
    employeeId: user?.employeeId || "",
    profileImage: user?.profileImage || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <UserCircle className="h-7 w-7 text-primary" />
          My Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">View and edit your profile information</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70 overflow-hidden shadow-lg shadow-primary/10">
            <div className="h-1 w-full bg-primary" />
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="h-28 w-28 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                {user?.avatar || user?.profileImage ? (
                  <img src={user.avatar || user.profileImage || ""} alt="" className="h-28 w-28 rounded-full object-cover" />
                ) : (
                  <UserCircle className="h-14 w-14 text-white" />
                )}
              </div>
              <h3 className="text-lg font-semibold">{user?.name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-primary font-medium mt-1 capitalize">{user?.role}</p>

              <Separator className="my-4" />

              <div className="w-full space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">{user?.email}</span>
                </div>
                {user?.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-emerald-500" />
                    <span className="text-muted-foreground">{user.phone}</span>
                  </div>
                )}
                {user?.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">{user.address}</span>
                  </div>
                )}
                {user?.pfNumber && (
                  <div className="flex items-center gap-3 text-sm">
                    <ShieldCheck className="h-4 w-4 text-violet-500" />
                    <span className="text-muted-foreground">PF: {user.pfNumber}</span>
                  </div>
                )}
                {user?.employeeId && (
                  <div className="flex items-center gap-3 text-sm">
                    <UserCircle className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Emp ID: {user.employeeId}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span className="text-muted-foreground capitalize">{user?.authType} Login</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="lg:col-span-2">
          <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <CloudinaryUpload
                    label=""
                    maxImages={1}
                    value={formData.profileImage ? [{ url: formData.profileImage }] : []}
                    onChange={(imgs) => setFormData({ ...formData, profileImage: imgs[0]?.url || "" })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Your phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Your address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input
                      value={formData.employeeId}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      placeholder="e.g. EMP001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PF Number</Label>
                    <Input
                      value={formData.pfNumber}
                      onChange={(e) => setFormData({ ...formData, pfNumber: e.target.value })}
                      placeholder="e.g. PF12345"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Identifiers used for official payslips and records</p>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20"
                  disabled={updateMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
