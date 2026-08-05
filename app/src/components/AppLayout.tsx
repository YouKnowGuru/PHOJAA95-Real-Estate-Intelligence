import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components";
import { ChatbotFAB } from "@/components/Chatbot";
import { toast } from "sonner";
import {
  Building2,
  LayoutDashboard,
  ClipboardList,
  Users,
  Clock,
  Wallet,
  ScrollText,
  BarChart3,
  Settings,
  UserCircle,
  LogOut,
  ShieldCheck,
  Home,
  Menu,
  X,
  Bell,
  Receipt,
  FolderOpen,
  ChevronRight,
  Code2,
  PenTool,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatStaffRoleLabel, getHomeRouteForRole } from "@/lib/role-routing";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Code2, label: "Software Development", href: "/software-dev" },
  { icon: PenTool, label: "Architecture", href: "/architecture" },
  { icon: Building2, label: "Properties", href: "/properties" },
  { icon: Building2, label: "Property Types", href: "/property-types" },
  { icon: FolderOpen, label: "Documents", href: "/documents" },
  { icon: ClipboardList, label: "Approvals", href: "/approvals" },
  { icon: Receipt, label: "Billing", href: "/billing" },
  { icon: Users, label: "Staff", href: "/users" },
  { icon: Clock, label: "Attendance", href: "/attendance" },
  { icon: Wallet, label: "Payroll", href: "/payroll" },
  { icon: ScrollText, label: "Activity", href: "/activity-logs" },
  { icon: BarChart3, label: "Reports", href: "/reports" },
  { icon: FileText, label: "Progress Reports", href: "/work-progress" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: UserCircle, label: "Profile", href: "/profile" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

const staffNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Building2, label: "My Properties", href: "/properties" },
  { icon: FolderOpen, label: "Documents", href: "/documents" },
  { icon: Receipt, label: "Billing", href: "/billing" },
  { icon: Clock, label: "Attendance", href: "/attendance" },
  { icon: Wallet, label: "Payroll", href: "/payroll" },
  { icon: FileText, label: "Progress Reports", href: "/work-progress" },
  { icon: UserCircle, label: "Profile", href: "/profile" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

const softwareDevNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/software-dev" },
  { icon: Code2, label: "Software Development", href: "/software-dev" },
  { icon: Clock, label: "Attendance", href: "/attendance" },
  { icon: Wallet, label: "Payroll", href: "/payroll" },
  { icon: FileText, label: "Progress Reports", href: "/work-progress" },
  { icon: UserCircle, label: "Profile", href: "/profile" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Settings, label: "Settings", href: "/settings" },
];


const architectureStaffNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/architecture" },
  { icon: PenTool, label: "Architecture", href: "/architecture" },
  { icon: Clock, label: "Attendance", href: "/attendance" },
  { icon: Wallet, label: "Payroll", href: "/payroll" },
  { icon: FileText, label: "Progress Reports", href: "/work-progress" },
  { icon: UserCircle, label: "Profile", href: "/profile" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

function isNavItemActive(pathname: string, hash: string, href: string): boolean {
  const [path, itemHash] = href.split("#");
  if (itemHash) {
    return pathname === path && hash.replace(/^#/, "") === itemHash;
  }
  return pathname === href;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin, isDeveloper, isArchitectureStaff, sessionExpiresAt, refreshSession } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [imgError, setImgError] = useState(false);
  const sessionWarnedRef = useRef(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Session expiration warning
  useEffect(() => {
    if (!sessionExpiresAt) return;

    const checkSession = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = sessionExpiresAt - now;

      if (remaining <= 300 && remaining > 0 && !sessionWarnedRef.current) {
        sessionWarnedRef.current = true;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        const timeStr = minutes > 0
          ? `${minutes} minute${minutes > 1 ? "s" : ""}`
          : `${seconds} second${seconds > 1 ? "s" : ""}`;

        const toastId = toast.warning(`Your session will expire in ${timeStr}.`, {
          duration: Infinity,
          action: {
            label: "Refresh Session",
            onClick: () => {
              refreshSession();
              sessionWarnedRef.current = false;
              toast.dismiss(toastId);
            },
          },
          onDismiss: () => {
            sessionWarnedRef.current = false;
          },
        });
      }

      if (remaining > 300) {
        sessionWarnedRef.current = false;
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt, refreshSession]);

  const navItems = isAdmin
    ? adminNavItems
    : isDeveloper
    ? softwareDevNavItems
    : isArchitectureStaff
    ? architectureStaffNavItems
    : staffNavItems;

  const { data: branding } = trpc.settings.getPublicSettings.useQuery(undefined, {
    staleTime: Infinity,
  });

  const siteName = branding?.site_name || "PHOJAA95";
  const siteLogo = branding?.site_logo;
  const isValidLogo = siteLogo && (siteLogo.startsWith("http") || siteLogo.startsWith("/"));

  const { data: notifData } = trpc.notification.getUnreadCount.useQuery(undefined, { refetchInterval: 30000, refetchIntervalInBackground: false });
  const { data: adminStats } = trpc.property.dashboardStats.useQuery(undefined, { enabled: isAdmin });
  const { data: staffStats } = trpc.property.staffDashboardStats.useQuery(undefined, { enabled: !isAdmin && !isDeveloper && !isArchitectureStaff });

  const unreadCount = notifData?.count || 0;
  const pendingApprovalsCount = isAdmin ? adminStats?.pendingApprovals : staffStats?.pendingApprovals;
  const rejectedCount = !isAdmin ? staffStats?.rejectedCount : 0;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isMobile ? (sidebarOpen ? 0 : -280) : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`
          fixed lg:relative z-50 h-full w-[280px] shrink-0
          border-r border-border/40 glass-strong
          flex flex-col
          ${isMobile ? "left-0 top-0" : ""}
        `}
      >
        {/* Logo */}
        <div className="border-b border-border/30 px-5 py-5">
          <Link to={getHomeRouteForRole(user?.role)} className="flex items-center gap-3">
            {isValidLogo ? (
              <img 
                src={siteLogo} 
                alt={siteName} 
                className="h-10 w-10 object-contain rounded-xl shadow-sm" 
                onError={(e) => { e.currentTarget.style.display = "none"; }} 
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
                <Building2 className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground truncate max-w-[150px]">
                {siteName}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Real Estate
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          <div className="space-y-0.5">
            {navItems.map((item, index) => {
              const isActive = isNavItemActive(location.pathname, location.hash, item.href);
              return (
                <motion.div
                  key={`${item.label}-${item.href}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.3 }}
                >
                  <Link
                    to={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl
                      text-sm font-medium transition-all duration-200
                      group relative
                      ${isActive
                        ? "bg-primary/10 text-primary dark:bg-primary/15"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }
                    `}
                  >
                    <item.icon className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    <span className="truncate">{item.label}</span>
                    {item.label === "Notifications" && unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px] rounded-full">
                        {unreadCount}
                      </Badge>
                    )}
                    {item.label === "Approvals" && (pendingApprovalsCount || 0) > 0 && (
                      <Badge className="ml-auto bg-amber-500 hover:bg-amber-600 text-white h-5 min-w-5 justify-center px-1 text-[10px] border-0 rounded-full">
                        {pendingApprovalsCount}
                      </Badge>
                    )}
                    {item.label === "My Properties" && (rejectedCount || 0) > 0 && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px] rounded-full">
                        {rejectedCount}
                      </Badge>
                    )}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className="border-t border-border/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 overflow-hidden">
              {!imgError && (user?.avatar || user?.profileImage) ? (
                <img
                  src={user.avatar || user.profileImage || ""}
                  alt={user?.name}
                  className="h-9 w-9 rounded-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <UserCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.name}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {formatStaffRoleLabel(user?.role)}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/30 glass px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 rounded-lg"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Breadcrumb */}
            <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <Home className="h-3.5 w-3.5" />
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-foreground">
                {navItems.find((n) => n.href === location.pathname)?.label || "Page"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-[1440px]"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* AI Chatbot */}
      <ChatbotFAB />
    </div>
  );
}

// Note: Uses the imported `cn` from @/lib/utils instead of a local redefinition
