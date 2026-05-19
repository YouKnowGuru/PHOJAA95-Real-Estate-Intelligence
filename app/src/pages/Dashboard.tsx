import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  subtitle,
  color,
  delay = 0,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  subtitle: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <motion.div 
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.98 }}
        className="group relative overflow-hidden border-border/50 bg-white/70 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 dark:bg-slate-800/70 rounded-xl"
      >
        <Card className="border-0 bg-transparent shadow-none">
          <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {title}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    {value}
                  </h3>
                  {trend && (
                    <span
                      className={`flex items-center text-xs font-medium ${
                        trendUp ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {trendUp ? (
                        <ArrowUpRight className="mr-0.5 h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="mr-0.5 h-3 w-3" />
                      )}
                      {trend}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}
              >
                <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

const formatCurrency = (val: string | number) => {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "Nu. 0";
  if (n >= 100000) return `Nu. ${(n / 100000).toFixed(2)}L`;
  return `Nu. ${n.toLocaleString()}`;
};

function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.property.dashboardStats.useQuery();
  const { data: typeStats } = trpc.dashboard.propertyTypeStats.useQuery();
  const { data: recentActivity } = trpc.dashboard.recentActivity.useQuery({ limit: 8 });

  const { data: realMonthlyData } = trpc.dashboard.monthlySales.useQuery({ year: new Date().getFullYear().toString() });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = realMonthlyData?.map(d => {
    const monthIdx = parseInt(d.month.split("-")[1]) - 1;
    return {
      month: monthNames[monthIdx] || d.month,
      properties: d.count,
      revenue: parseFloat(d.revenue)
    };
  }) || [];

  const statusData = [
    { name: "Completed", value: stats?.completedSales || 0, color: "hsl(var(--primary))" },
    { name: "Pending", value: stats?.pendingApprovals || 0, color: "#f59e0b" },
    { name: "Rejected", value: stats?.rejectedCount || 0, color: "#ef4444" },
  ];

  if (statsLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your real estate operations
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Properties"
          value={stats?.totalProperties || 0}
          icon={Building2}
          subtitle="All property listings"
          color="bg-blue-500"
          delay={0}
        />
        <KPICard
          title="Pending Approvals"
          value={stats?.pendingApprovals || 0}
          icon={Clock}
          subtitle="Awaiting your review"
          color="bg-amber-500"
          delay={0.1}
        />
        <KPICard
          title="Completed Sales"
          value={stats?.completedSales || 0}
          icon={CheckCircle2}
          subtitle="Successfully closed"
          color="bg-primary"
          delay={0.2}
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || "0")}
          icon={DollarSign}
          subtitle="Commission earned"
          color="bg-violet-500"
          delay={0.3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue Trends
              </CardTitle>
              <CardDescription>Monthly commission revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`Nu. ${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                Status Distribution
              </CardTitle>
              <CardDescription>Property workflow status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs text-muted-foreground">{s.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Property Types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Property Type Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeStats || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis dataKey="typeName" type="category" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(recentActivity?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No recent activity
                </div>
              ) : recentActivity?.slice(0, 6).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg border border-border/30 p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      activity.action === "approved"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                        : activity.action === "rejected"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                    }`}
                  >
                    {activity.action === "approved" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : activity.action === "rejected" ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.propertyName || "Property"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Step {activity.step} {activity.action} by {activity.adminName || "Admin"}
                    </p>
                    {activity.comments && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {activity.comments}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {activity.action}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function StaffDashboard() {
  const { data: stats } = trpc.property.staffDashboardStats.useQuery();
  const { data: recentActivity } = trpc.dashboard.staffRecentActivity.useQuery({ limit: 5 });

  const progressData = [
    { label: "Completed", value: stats?.completedSales || 0, color: "bg-primary", total: stats?.totalProperties || 1 },
    { label: "Pending", value: stats?.pendingApprovals || 0, color: "bg-amber-500", total: stats?.totalProperties || 1 },
    { label: "Rejected", value: stats?.rejectedCount || 0, color: "bg-red-500", total: stats?.totalProperties || 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your property listings and approvals
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="My Properties"
          value={stats?.totalProperties || 0}
          icon={Building2}
          subtitle="Total listings"
          color="bg-blue-500"
          delay={0}
        />
        <KPICard
          title="Pending Approvals"
          value={stats?.pendingApprovals || 0}
          icon={Clock}
          subtitle="Awaiting admin review"
          color="bg-amber-500"
          delay={0.1}
        />
        <KPICard
          title="Completed Sales"
          value={stats?.completedSales || 0}
          icon={CheckCircle2}
          subtitle="Successfully closed"
          color="bg-emerald-500"
          delay={0.2}
        />
        <KPICard
          title="Rejected"
          value={stats?.rejectedCount || 0}
          icon={XCircle}
          subtitle="Need revision"
          color="bg-red-500"
          delay={0.3}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Property Progress</CardTitle>
            <CardDescription>Distribution of your property statuses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {progressData.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.value} of {item.total}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${item.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / item.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Staff Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Properties
            </CardTitle>
            <CardDescription>Your latest property updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(recentActivity?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No recent properties
                </div>
              ) : recentActivity?.map((activity) => (
                <div key={activity.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{activity.propertyName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Step {activity.step}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {activity.updatedAt ? new Date(activity.updatedAt).toLocaleDateString() : ""}
                    </span>
                    <Badge className="text-[10px]" variant={activity.status === "rejected" ? "destructive" : activity.status === "completed" ? "default" : "secondary"}>
                      {activity.status?.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <StaffDashboard />;
}
