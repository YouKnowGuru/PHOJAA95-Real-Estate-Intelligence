import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const resetMutation = trpc.localAuth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      toast.success("Password reset successfully");
      setTimeout(() => navigate("/login"), 3000);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!token) {
      toast.error("Invalid reset token");
      return;
    }
    resetMutation.mutate({ token, newPassword: password });
  };

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 mx-auto mb-5">
            <Lock className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Invalid Reset Link</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/login" className="inline-block mt-6">
            <Button variant="outline" className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mx-auto mb-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold">Password Reset</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your password has been reset successfully. Redirecting to login...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <AppleCard hover={false} className="overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/60" />
          <AppleCardContent className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Reset Password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your new password below.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="rounded-xl border-border/40 bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="rounded-xl border-border/40 bg-background/50"
                />
              </div>
              <Button
                type="submit"
                disabled={resetMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
              >
                {resetMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </form>

            <Link to="/login" className="inline-block mt-6 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </Link>
          </AppleCardContent>
        </AppleCard>
      </motion.div>
    </div>
  );
}
