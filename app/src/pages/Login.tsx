import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Eye, EyeOff, LogIn, Lock, Mail, Loader2, Sparkles, Shield, Zap, ArrowLeft, MailCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getHomeRouteForRole } from "@/lib/role-routing";
import { DEFAULT_SITE_TAGLINE } from "@contracts/constants";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  // Use mutation pending state instead of manual loading state
  const [view, setView] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const { data: branding } = trpc.settings.getPublicSettings.useQuery();

  const navigate = useNavigate();

  const utils = trpc.useUtils();

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      utils.localAuth.me.invalidate();
      utils.auth.me.invalidate();
      navigate(getHomeRouteForRole(data.user?.role));
    },
    onError: (err) => { setError(err.message); },
  });

  const forgotMutation = trpc.localAuth.forgotPassword.useMutation({
    onSuccess: (data) => { setForgotSuccess(data.message || "Check your email for reset instructions"); },
    onError: (err) => { setError(err.message); },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ ...loginData, rememberMe });
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setForgotSuccess("");
    forgotMutation.mutate({ email: forgotEmail });
  };

  const features = [
    { icon: Shield, label: "Enterprise Security" },
    { icon: Zap, label: "Real-time Analytics" },
    { icon: Sparkles, label: "AI-Powered Insights" },
  ];

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
      {/* Layered aurora + grid + shooting stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 grid-pattern" />
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
        {/* Running shooting stars */}
        <div className="shooting-star shooting-star-1" />
        <div className="shooting-star shooting-star-2" />
        <div className="shooting-star shooting-star-3" />
        <div className="shooting-star shooting-star-4" />
        <div className="shooting-star shooting-star-5" />
        <div className="shooting-star shooting-star-6" />
        <div className="shooting-star shooting-star-7" />
        <div className="shooting-star shooting-star-8" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-5xl px-4 sm:px-6 flex flex-col lg:flex-row items-center gap-10 lg:gap-20">
        {/* Branding side */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 w-full text-center lg:text-left space-y-6 lg:space-y-8"
        >
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 shadow-lg p-4"
          >
            {branding?.site_logo ? (
              <img src={branding.site_logo} alt={branding?.site_name} className="w-full h-full object-contain" />
            ) : (
              <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            )}
          </motion.div>

          {/* Headline */}
          <div className="space-y-3 lg:space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              {branding?.site_name || "PHOJAA95"}
            </h1>
            <p className="text-base sm:text-lg font-semibold text-primary tracking-wide">
              Real Estate Intelligence
            </p>
            <p className="hidden sm:block text-sm text-muted-foreground max-w-md mx-auto lg:mx-0 leading-relaxed">
              The most advanced property management ecosystem. Streamline portfolios, automate payroll, and unlock insights — all from one unified dashboard.
            </p>
          </div>

          {/* Feature pills */}
          <div className="hidden sm:flex flex-wrap justify-center lg:justify-start gap-2">
            {features.map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border/40"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px] shrink-0"
        >
          <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-xl shadow-apple-md overflow-hidden">
            {/* Top accent — animated gradient sheen */}
            <motion.div
              className="h-1 w-full bg-gradient-to-r from-primary via-chart-2 to-primary bg-[length:200%_100%]"
              animate={{ backgroundPosition: ["0% 0", "200% 0"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />

            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {view === "login" ? "Welcome Back" : "Reset Password"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {view === "login"
                    ? "Sign in to access your dashboard"
                    : "Enter your email to receive reset instructions"}
                </p>
              </div>

              {/* Alerts */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/40"
                  >
                    {error}
                  </motion.div>
                )}

                {forgotSuccess && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
                  >
                    {forgotSuccess}
                  </motion.div>
                )}
              </AnimatePresence>

              {view === "login" ? (
                <motion.form
                  key="login-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="admin@phojaa95.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        className="pl-10 bg-background/50 rounded-xl border-border/40"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => { setView("forgot"); setError(""); setForgotSuccess(""); }}
                        className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        className="pl-10 pr-10 bg-background/50 rounded-xl border-border/40"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember-me" className="text-xs text-muted-foreground cursor-pointer">
                      Remember me for 30 days
                    </Label>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={loginMutation.isPending || forgotMutation.isPending}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-sm"
                  >
                    {loginMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    )}
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="forgot-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {forgotSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-4 py-4"
                    >
                      <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center">
                        <MailCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-foreground">Check Your Email</h3>
                        <p className="text-sm text-muted-foreground">
                          We've sent password reset instructions to<br />
                          <span className="text-primary font-medium">{forgotEmail}</span>
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.form
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleForgotPassword}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Email Address
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="admin@phojaa95.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="pl-10 bg-background/50 rounded-xl border-border/40"
                            required
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loginMutation.isPending || forgotMutation.isPending}
                        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-sm"
                      >
                        {forgotMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
                      </Button>
                    </motion.form>
                  )}

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setView("login"); setError(""); setForgotSuccess(""); }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Sign In
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-border/30">
                <p className="text-center text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                  {branding?.site_tagline || DEFAULT_SITE_TAGLINE}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
