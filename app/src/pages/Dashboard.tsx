import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/ui/kpi-card";
import { AppleCard, AppleCardHeader, AppleCardTitle, AppleCardDescription, AppleCardContent } from "@/components/ui/apple-card";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
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
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Dashboard"
        description="Overview of your real estate operations"
        icon={<Building2 className="h-5 w-5" />}
      />

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
          color="bg-emerald-500"
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
        <AnimatedSection delay={0.3} className="lg:col-span-2">
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue Trends
              </AppleCardTitle>
              <AppleCardDescription>Monthly commission revenue</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
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
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        {/* Status Distribution */}
        <AnimatedSection delay={0.4}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                Status Distribution
              </AppleCardTitle>
              <AppleCardDescription>Property workflow status</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
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
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs text-muted-foreground">{s.name}</span>
                  </div>
                ))}
              </div>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Property Types */}
        <AnimatedSection delay={0.5}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Property Type Analytics
              </AppleCardTitle>
            </AppleCardHeader>
            <AppleCardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeStats || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                  <YAxis dataKey="typeName" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" width={80} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        {/* Recent Activity */}
        <AnimatedSection delay={0.6}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" />
                Recent Activity
              </AppleCardTitle>
            </AppleCardHeader>
            <AppleCardContent className="space-y-3">
              {(recentActivity?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No recent activity
                </div>
              ) : recentActivity?.slice(0, 6).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-xl border border-border/30 p-3 transition-colors hover:bg-muted/30"
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
                  <Badge variant="outline" className="text-[10px] shrink-0 rounded-full">
                    {activity.action}
                  </Badge>
                </div>
              ))}
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      </div>
    </AnimatedPage>
  );
}

function StaffDashboard() {
  const { data: stats } = trpc.property.staffDashboardStats.useQuery();
  const { data: recentActivity } = trpc.dashboard.staffRecentActivity.useQuery({ limit: 5 });

  const progressData = [
    { label: "Completed", value: stats?.completedSales || 0, color: "bg-emerald-500", total: stats?.totalProperties || 1 },
    { label: "Pending", value: stats?.pendingApprovals || 0, color: "bg-amber-500", total: stats?.totalProperties || 1 },
    { label: "Rejected", value: stats?.rejectedCount || 0, color: "bg-red-500", total: stats?.totalProperties || 1 },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="My Dashboard"
        description="Track your property listings and approvals"
        icon={<Building2 className="h-5 w-5" />}
      />

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

      <AnimatedSection delay={0.4}>
        <AppleCard>
          <AppleCardHeader>
            <AppleCardTitle>Property Progress</AppleCardTitle>
            <AppleCardDescription>Distribution of your property statuses</AppleCardDescription>
          </AppleCardHeader>
          <AppleCardContent className="space-y-6">
            {progressData.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.value} of {item.total}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${item.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / item.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </AppleCardContent>
        </AppleCard>
      </AnimatedSection>

      <AnimatedSection delay={0.5}>
        <AppleCard>
          <AppleCardHeader>
            <AppleCardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Properties
            </AppleCardTitle>
            <AppleCardDescription>Your latest property updates</AppleCardDescription>
          </AppleCardHeader>
          <AppleCardContent>
            <div className="space-y-3">
              {(recentActivity?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No recent properties
                </div>
              ) : recentActivity?.map((activity) => (
                <div key={activity.id} className="flex flex-col gap-2 p-4 rounded-xl border border-border/30 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{activity.propertyName}</span>
                    <Badge variant="outline" className="text-[10px] rounded-full">
                      Step {activity.step}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {activity.updatedAt ? new Date(activity.updatedAt).toLocaleDateString() : ""}
                    </span>
                    <Badge className="text-[10px] rounded-full" variant={activity.status === "rejected" ? "destructive" : activity.status === "completed" ? "default" : "secondary"}>
                      {activity.status?.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </AppleCardContent>
        </AppleCard>
      </AnimatedSection>
    </AnimatedPage>
  );
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <StaffDashboard />;
}
