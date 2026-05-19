import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrength } from "@/components/PasswordStrength";
import { Building2, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: branding } = trpc.settings.getPublicSettings.useQuery();

  const { data: tokenData, isLoading: verifyingToken, error: tokenError } = trpc.localAuth.verifyResetToken.useQuery(
    { token: token || "" },
    { enabled: !!token, retry: false }
  );

  const resetMutation = trpc.localAuth.resetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      navigate("/login");
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    },
  });

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing password reset token.");
    } else if (tokenError) {
      setError(tokenError.message || "Invalid or expired password reset token.");
    } else if (tokenData && !tokenData.valid) {
      setError("Invalid or expired password reset token.");
    }
  }, [token, tokenData, tokenError]);

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    resetMutation.mutate({ token, newPassword: password });
  };

  const isInvalid = !token || (tokenData && !tokenData.valid) || !!tokenError;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center mb-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 shadow-xl shadow-primary/20 p-3">
              {branding?.site_logo ? (
                <img src={branding.site_logo} alt={branding?.site_name} className="w-full h-full object-contain" />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>

          <Card className="border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-primary/5 rounded-3xl overflow-hidden">
            <CardHeader className="space-y-1 pb-6 border-b border-border/50 bg-slate-50/50 dark:bg-slate-800/50 text-center">
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Set New Password
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Please enter your new password below.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20 text-center"
                >
                  {error}
                </motion.div>
              )}

              {verifyingToken ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : isInvalid ? (
                <div className="text-center mt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/login")}
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-semibold ml-1">New Password</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                      </div>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-11 pr-11 text-slate-900 dark:text-white rounded-xl focus:ring-primary/20 transition-all shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <PasswordStrength password={password} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-semibold ml-1">Confirm New Password</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                      </div>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-11 pr-11 text-slate-900 dark:text-white rounded-xl focus:ring-primary/20 transition-all shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
