import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { UserCircle, Mail, Phone, MapPin, Building2, Save, ShieldCheck, Pencil } from "lucide-react";
import { CloudinaryUpload } from "@/components/CloudinaryUpload";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { AppleCard, AppleCardHeader, AppleCardTitle, AppleCardContent } from "@/components/ui/apple-card";

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
    pfPercentage: user?.pfPercentage || "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        phone: user.phone || "",
        address: user.address || "",
        pfNumber: user.pfNumber || "",
        employeeId: user.employeeId || "",
        profileImage: user.profileImage || "",
        pfPercentage: user.pfPercentage || "",
      });
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const infoItems = [
    { icon: Mail, label: "Email", value: user?.email, color: "text-blue-500" },
    { icon: Phone, label: "Phone", value: user?.phone, color: "text-emerald-500" },
    { icon: MapPin, label: "Address", value: user?.address, color: "text-amber-500" },
    { icon: ShieldCheck, label: "PF Number", value: user?.pfNumber ? `PF: ${user.pfNumber}` : null, color: "text-violet-500" },
    { icon: UserCircle, label: "Employee ID", value: user?.employeeId ? `Emp ID: ${user.employeeId}` : null, color: "text-primary" },
    { icon: Building2, label: "Auth", value: user?.authType ? `${user.authType} Login` : null, color: "text-slate-500" },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="My Profile"
        description="View and edit your profile information"
        icon={<UserCircle className="h-5 w-5" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <AnimatedSection delay={0.1}>
          <AppleCard className="h-full">
            <AppleCardContent className="p-6 flex flex-col items-center text-center">
              <div className="h-28 w-28 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 shadow-lg shadow-primary/20 overflow-hidden">
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
                {infoItems.filter(item => item.value).map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <item.icon className={item.color} />
                    <span className="text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        {/* Edit Form */}
        <AnimatedSection delay={0.2} className="lg:col-span-2">
          <AppleCard className="h-full">
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Profile
              </AppleCardTitle>
            </AppleCardHeader>
            <AppleCardContent>
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
                <div className="space-y-2">
                  <Label>PF Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pfPercentage}
                    onChange={(e) => setFormData({ ...formData, pfPercentage: e.target.value })}
                    placeholder="e.g. 10"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Identifiers used for official payslips and records</p>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                  disabled={updateMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      </div>
    </AnimatedPage>
  );
}
