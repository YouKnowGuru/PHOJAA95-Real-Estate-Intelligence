import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DEFAULT_SITE_TAGLINE } from "@contracts/constants";
import { Shield, Moon, Sun, Monitor, Lock, Globe, Building2, Save, Settings as SettingsIcon, User, Hash } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { trpc } from "@/lib/trpc";
import { CloudinaryUpload } from "@/components/CloudinaryUpload";
import { motion } from "framer-motion";

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Branding State
  const [siteName, setSiteName] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [siteTagline, setSiteTagline] = useState("");

  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();

  const { data: brandingData } = trpc.settings.getPublicSettings.useQuery();

  useEffect(() => {
    if (brandingData) {
      setSiteName(brandingData.site_name || "PHOJAA95");
      setSiteLogo(brandingData.site_logo || "");
      setSiteTagline(brandingData.site_tagline || DEFAULT_SITE_TAGLINE);
    }
  }, [brandingData]);

  const updateSetting = trpc.settings.updateSetting.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const handleBrandingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: "site_name", value: siteName }),
        updateSetting.mutateAsync({ key: "site_logo", value: siteLogo }),
        updateSetting.mutateAsync({ key: "site_tagline", value: siteTagline }),
      ]);
      toast.success("Branding settings updated");
      utils.settings.getPublicSettings.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update branding settings");
    }
  };

  const changePasswordMutation = trpc.localAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your preferences and security</p>
      </motion.div>

      <div className="grid gap-6 max-w-2xl">
        {/* Appearance */}
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4 text-emerald-500" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel of the application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === t
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-border hover:border-emerald-200 dark:hover:border-emerald-800"
                    }`}
                >
                  {t === "light" && <Sun className="h-5 w-5 text-amber-500" />}
                  {t === "dark" && <Moon className="h-5 w-5 text-indigo-500" />}
                  {t === "system" && <Monitor className="h-5 w-5 text-slate-500" />}
                  <span className="text-sm font-medium capitalize">{t}</span>
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-3">
              <Label className="text-sm font-medium">Color Theme</Label>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { name: "emerald", class: "bg-emerald-500" },
                  { name: "blue", class: "bg-blue-500" },
                  { name: "violet", class: "bg-violet-500" },
                  { name: "rose", class: "bg-rose-500" },
                  { name: "amber", class: "bg-amber-500" },
                ].map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColorTheme(c.name as any)}
                    className={`group relative flex h-12 flex-col items-center justify-center rounded-lg border-2 transition-all ${colorTheme === c.name
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border hover:border-primary/50"
                      }`}
                  >
                    <div className={`h-4 w-4 rounded-full ${c.class} shadow-sm transition-transform group-hover:scale-110`} />
                    <span className="mt-1 text-[10px] font-medium capitalize hidden sm:block">
                      {c.name}
                    </span>
                    {colorTheme === c.name && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Branding (Admin Only) */}
        {isAdmin && (
          <Card className="border-border/50 border-primary/20 bg-primary/5 shadow-lg shadow-primary/5 overflow-hidden">
            <div className="h-1 w-full bg-primary" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Site Branding
              </CardTitle>
              <CardDescription>Update the global site name and logo</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBrandingUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Site Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      className="pl-10"
                      placeholder="e.g. PHOJAA95"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Footer Tagline</Label>
                  <Input
                    value={siteTagline}
                    onChange={(e) => setSiteTagline(e.target.value)}
                    placeholder="© 2027 PHOJAA95 Ecosystem. Powered by Advanced Real Estate Intelligence."
                  />
                  <p className="text-[10px] text-muted-foreground italic">Shown in the login page footer on all screen sizes</p>
                </div>
                <div className="space-y-3">
                  <Label>Site Logo</Label>
                  <CloudinaryUpload
                    label=""
                    maxImages={1}
                    value={siteLogo ? [{ url: siteLogo }] : []}
                    onChange={(imgs) => setSiteLogo(imgs[0]?.url || "")}
                  />
                  <p className="text-[10px] text-muted-foreground italic">Upload a high-quality image for your site branding</p>
                </div>
                {siteLogo && (
                  <div className="mt-2 p-3 border rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center">
                    <img
                      src={siteLogo}
                      alt="Logo Preview"
                      className="h-12 object-contain"
                      onError={() => toast.error("Invalid logo URL")}
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={updateSetting.isPending}
                  className="bg-primary text-white w-full shadow-lg shadow-primary/20"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateSetting.isPending ? "Saving..." : "Save Branding Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Security */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1 w-full bg-primary" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-500" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              <Button type="submit" disabled={changePasswordMutation.isPending} className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20">
                {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1 w-full bg-primary" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between py-2.5 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">System Name</span>
              </div>
              <span className="text-sm font-medium">Phojaa95 Real Estate Management</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Version</span>
              </div>
              <span className="text-sm font-medium">2.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Role</span>
              </div>
              <span className="text-sm font-medium capitalize">{user?.role}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Auth Method</span>
              </div>
              <span className="text-sm font-medium capitalize">{user?.authType}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
