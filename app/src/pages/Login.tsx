import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Eye, EyeOff, LogIn, Lock, Mail, Loader2, Sparkles, Shield, Zap, ArrowLeft, MailCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const { data: branding } = trpc.settings.getPublicSettings.useQuery();

  const navigate = useNavigate();

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: () => { navigate("/"); },
    onError: (err) => { setError(err.message); setLoading(false); },
  });

  const forgotMutation = trpc.localAuth.forgotPassword.useMutation({
    onSuccess: (data) => { setForgotSuccess(data.message || "Check your email for reset instructions"); setLoading(false); },
    onError: (err) => { setError(err.message); setLoading(false); },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    loginMutation.mutate({ ...loginData, rememberMe });
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setForgotSuccess("");
    setLoading(true);
    forgotMutation.mutate({ email: forgotEmail });
  };

  const features = [
    { icon: Shield, label: "Enterprise Security" },
    { icon: Zap, label: "Real-time Analytics" },
    { icon: Sparkles, label: "AI-Powered Insights" },
  ];

  const defaultTagline = "\u00A9 " + new Date().getFullYear() + " " + (branding?.site_name || "PHOJAA95") + " Ecosystem. Powered by Advanced Real Estate Intelligence.";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0a0f1e]">
      {/* Deep space background with subtle noise texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0a0f1e] to-[#0a0f1e]" />

      {/* Animated aurora orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: ["-20%", "10%", "-20%"], y: ["-10%", "5%", "-10%"], scale: [1, 1.15, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[30%] -left-[10%] w-[900px] h-[900px] rounded-full bg-gradient-to-br from-emerald-400/25 via-teal-500/15 to-cyan-500/10 blur-[180px]"
        />
        <motion.div
          animate={{ x: ["10%", "-15%", "10%"], y: ["5%", "-10%", "5%"], scale: [1.1, 0.95, 1.1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[30%] -right-[10%] w-[800px] h-[800px] rounded-full bg-gradient-to-tl from-blue-500/20 via-indigo-500/15 to-purple-500/10 blur-[180px]"
        />
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-emerald-300/10 via-teal-400/8 to-cyan-400/5 blur-[140px]"
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-6xl px-6 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        {/* Left: Branding */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex-1 text-center lg:text-left space-y-10"
        >
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.08, rotate: -5 }}
            transition={{ type: "spring", stiffness: 250, damping: 15 }}
            className="inline-flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-400/20 via-emerald-500/10 to-transparent border border-emerald-400/20 shadow-[0_0_60px_-15px_rgba(52,211,153,0.3)] p-6 backdrop-blur-sm"
          >
            {branding?.site_logo ? (
              <img src={branding.site_logo} alt={branding?.site_name} className="w-full h-full object-contain" />
            ) : (
              <Building2 className="h-14 w-14 text-emerald-400" />
            )}
          </motion.div>

          {/* Headline */}
          <div className="space-y-6">
            <h1 className="text-6xl lg:text-8xl font-black tracking-tighter leading-[0.9]">
              <span className="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent">
                {branding?.site_name || "PHOJAA95"}
              </span>
            </h1>
            <div className="space-y-3">
              <p className="text-xl lg:text-2xl font-bold text-emerald-400 tracking-wide">
                Real Estate Intelligence
              </p>
              <p className="text-base lg:text-lg text-slate-400/80 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                The most advanced property management ecosystem. Streamline portfolios, automate payroll, and unlock AI-driven insights — all from one unified dashboard.
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-3">
            {features.map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.12 }}
                whileHover={{ scale: 1.04, y: -3 }}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md hover:bg-white/[0.07] hover:border-white/[0.14] transition-all duration-300"
              >
                <Icon className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right: Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[440px]"
        >
          {/* Outer glow ring */}
          <div className="relative p-[1px] rounded-[2rem] bg-gradient-to-b from-white/[0.12] via-white/[0.04] to-transparent shadow-[0_0_80px_-20px_rgba(52,211,153,0.15)]">
            <Card className="relative border-0 bg-[#0f1525]/80 backdrop-blur-3xl rounded-[1.9rem] overflow-hidden shadow-2xl">
              {/* Inner top glow */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

              <CardHeader className="relative space-y-1.5 pb-7 pt-8 px-8">
                <CardTitle className="text-2xl font-bold tracking-tight text-white">
                  {view === "login" ? "Welcome Back" : "Reset Password"}
                </CardTitle>
                <CardDescription className="text-slate-400 text-sm">
                  {view === "login"
                    ? "Sign in to access your intelligent dashboard"
                    : "Enter your email to receive reset instructions"}
                </CardDescription>
              </CardHeader>

              <CardContent className="relative px-8 pb-8">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="mb-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20"
                    >
                      {error}
                    </motion.div>
                  )}

                  {forgotSuccess && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="mb-5 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 border border-emerald-500/20"
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
                    className="space-y-5"
                  >
                    {/* Email */}
                    <div className="space-y-2">
                      <Label className="text-slate-300 font-semibold text-[11px] uppercase tracking-widest ml-1">
                        Email Address
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                          <Mail className="h-[18px] w-[18px] text-slate-500" />
                        </div>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="admin@phojaa95.com"
                          value={loginData.email}
                          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                          className="h-12 border-white/[0.08] bg-white/[0.03] pl-11 pr-4 text-white placeholder:text-slate-600 rounded-xl focus:ring-1 focus:ring-emerald-400/40 focus:border-emerald-400/40 transition-all duration-300 text-[15px]"
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label className="text-slate-300 font-semibold text-[11px] uppercase tracking-widest">
                          Password
                        </Label>
                        <button
                          type="button"
                          onClick={() => { setView("forgot"); setError(""); setForgotSuccess(""); }}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                          <Lock className="h-[18px] w-[18px] text-slate-500" />
                        </div>
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          className="h-12 border-white/[0.08] bg-white/[0.03] pl-11 pr-12 text-white placeholder:text-slate-600 rounded-xl focus:ring-1 focus:ring-emerald-400/40 focus:border-emerald-400/40 transition-all duration-300 text-[15px]"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                        className="border-white/15 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 h-4 w-4"
                      />
                      <Label htmlFor="remember-me" className="text-xs font-medium text-slate-400 cursor-pointer select-none">
                        Remember me for 30 days
                      </Label>
                    </div>

                    {/* Submit */}
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-1">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 hover:from-emerald-400 hover:via-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 text-[15px] tracking-wide"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <LogIn className="mr-2 h-5 w-5" />
                            Sign In to Dashboard
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.form>
                ) : (
                  <motion.div
                    key="forgot-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    {forgotSuccess ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-5 py-4"
                      >
                        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <MailCheck className="h-8 w-8 text-emerald-400" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-white">Check Your Email</h3>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            We've sent password reset instructions to<br />
                            <span className="text-emerald-400 font-medium">{forgotEmail}</span>
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                          <p className="text-xs text-slate-500">
                            Didn't receive the email? Check your spam folder or try again in a few minutes.
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.form
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onSubmit={handleForgotPassword}
                        className="space-y-5"
                      >
                        <div className="space-y-2">
                          <Label className="text-slate-300 font-semibold text-[11px] uppercase tracking-widest ml-1">
                            Email Address
                          </Label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                              <Mail className="h-[18px] w-[18px] text-slate-500" />
                            </div>
                            <Input
                              type="email"
                              autoComplete="email"
                              placeholder="admin@phojaa95.com"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              className="h-12 border-white/[0.08] bg-white/[0.03] pl-11 pr-4 text-white placeholder:text-slate-600 rounded-xl focus:ring-1 focus:ring-emerald-400/40 focus:border-emerald-400/40 transition-all duration-300 text-[15px]"
                              required
                            />
                          </div>
                        </div>

                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-1">
                          <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 hover:from-emerald-400 hover:via-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 text-[15px] tracking-wide"
                          >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
                          </Button>
                        </motion.div>
                      </motion.form>
                    )}

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => { setView("login"); setError(""); setForgotSuccess(""); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Sign In
                      </button>
                    </div>
                  </motion.div>
                )}


              </CardContent>
            </Card>
          </div>

          {/* Footer Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center text-[11px] font-semibold text-slate-500/70 uppercase tracking-[0.2em]"
          >
            {branding?.site_tagline || defaultTagline}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
