import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DEFAULT_SITE_TAGLINE } from "@contracts/constants";
import { Shield, Moon, Sun, Monitor, Lock, Globe, Building2, Save, Settings as SettingsIcon, User, Hash } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { trpc } from "@/lib/trpc";
import { CloudinaryUpload } from "@/components/CloudinaryUpload";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { AppleCard, AppleCardHeader, AppleCardTitle, AppleCardDescription, AppleCardContent } from "@/components/ui/apple-card";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [siteName, setSiteName] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [siteTagline, setSiteTagline] = useState("");

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

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: Sun, color: "text-amber-500" },
    { value: "dark" as const, label: "Dark", icon: Moon, color: "text-indigo-500" },
    { value: "system" as const, label: "System", icon: Monitor, color: "text-slate-500" },
  ];

  const colorOptions = [
    { name: "emerald", class: "bg-emerald-500", label: "Emerald" },
    { name: "blue", class: "bg-blue-500", label: "Blue" },
    { name: "violet", class: "bg-violet-500", label: "Violet" },
    { name: "rose", class: "bg-rose-500", label: "Rose" },
    { name: "amber", class: "bg-amber-500", label: "Amber" },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Settings"
        description="Manage your preferences and security"
        icon={<SettingsIcon className="h-5 w-5" />}
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Appearance */}
        <AnimatedSection delay={0.1}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                Appearance
              </AppleCardTitle>
              <AppleCardDescription>Customize the look and feel of the application</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                      theme === t.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-accent/50"
                    )}
                  >
                    <t.icon className={cn("h-5 w-5", t.color)} />
                    <span className="text-sm font-medium">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Color Theme</Label>
                <div className="grid grid-cols-5 gap-3">
                  {colorOptions.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColorTheme(c.name as any)}
                      className={cn(
                        "group relative flex h-14 flex-col items-center justify-center rounded-xl border-2 transition-all duration-200",
                        colorTheme === c.name
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className={cn("h-5 w-5 rounded-full shadow-sm transition-transform group-hover:scale-110", c.class)} />
                      <span className="mt-1 text-[10px] font-medium hidden sm:block">
                        {c.label}
                      </span>
                      {colorTheme === c.name && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center shadow-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        {/* Site Branding (Admin Only) */}
        {isAdmin && (
          <AnimatedSection delay={0.2}>
            <AppleCard className="border-primary/20">
              <AppleCardHeader>
                <AppleCardTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Site Branding
                </AppleCardTitle>
                <AppleCardDescription>Update the global site name and logo</AppleCardDescription>
              </AppleCardHeader>
              <AppleCardContent>
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
                    <div className="mt-2 p-3 border rounded-xl bg-background flex items-center justify-center">
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
                    className="w-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateSetting.isPending ? "Saving..." : "Save Branding Settings"}
                  </Button>
                </form>
              </AppleCardContent>
            </AppleCard>
          </AnimatedSection>
        )}

        {/* Security */}
        <AnimatedSection delay={0.3}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Change Password
              </AppleCardTitle>
              <AppleCardDescription>Update your account password</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
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
                <Button 
                  type="submit" 
                  disabled={changePasswordMutation.isPending} 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
                >
                  {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        {/* System Info */}
        <AnimatedSection delay={0.4}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                System Information
              </AppleCardTitle>
            </AppleCardHeader>
            <AppleCardContent className="space-y-0">
              {[
                { icon: Building2, label: "System Name", value: "Phojaa95 Real Estate Management" },
                { icon: Hash, label: "Version", value: "2.0.0" },
                { icon: User, label: "Role", value: user?.role || "-" },
                { icon: Lock, label: "Auth Method", value: user?.authType || "-" },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center justify-between py-3",
                    i < 3 && "border-b border-border/30"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      </div>
    </AnimatedPage>
  );
}
