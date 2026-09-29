import { Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/ui/kpi-card";
import { AppleCard, AppleCardHeader, AppleCardTitle, AppleCardDescription, AppleCardContent } from "@/components/ui/apple-card";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Activity,
  BarChart3,
  Code2,
  Briefcase,
  Package,
  Wallet,
  LogIn,
  LogOut,
  ArrowRight,
  ShoppingCart,
  PenTool,
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

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

function formatDevCurrency(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "Nu. 0";
  return `Nu.${n.toLocaleString()}`;
}

function DeveloperDashboard() {
  const { user } = useAuth();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
  const currentMonth = todayStr.substring(0, 7);
  const utils = trpc.useUtils();

  const { data: devStats, isLoading: devLoading } = trpc.softwareDashboard.developer.useQuery();
  const { data: attendanceData, isLoading: attendanceLoading } = trpc.attendance.myAttendance.useQuery({
    month: currentMonth,
    limit: 31,
  });
  const { data: payslips, isLoading: payrollLoading } = trpc.payroll.myPayroll.useQuery({ limit: 3 });
  const { data: myProjects } = trpc.softwareProject.list.useQuery(
    { developerId: user?.id, limit: 5, status: "in_progress" },
    { enabled: !!user?.id }
  );

  const checkInMutation = trpc.attendance.checkIn.useMutation({
    onSuccess: (data) => {
      toast.success(`Checked in — ${data.status}`);
      utils.attendance.myAttendance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const checkOutMutation = trpc.attendance.checkOut.useMutation({
    onSuccess: () => {
      toast.success("Checked out successfully");
      utils.attendance.myAttendance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const todayRecord = attendanceData?.records?.find((r) => String(r.date) === todayStr);
  const attStats = attendanceData?.stats ?? { present: 0, late: 0, absent: 0, halfDay: 0 };
  const latestPayslip = payslips?.[0];

  const projectStatusData =
    devStats?.projectStatus?.map((item: { status: string; count: number }) => ({
      name: item.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
      value: item.count,
    })) ?? [];

  const monthlySalesData =
    devStats?.monthlySales?.map((item: { month: string; total: string | number; count: number }) => ({
      month: String(item.month),
      revenue: Number(item.total || 0),
    })) ?? [];

  if (devLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Software development overview, attendance, and payslips"
        icon={<Code2 className="h-5 w-5" />}
      />

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/software-dev" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Software Dev</p>
                <p className="text-xs text-muted-foreground">Projects & sales</p>
              </div>
              <Code2 className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/software-dev#kanban" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Kanban Board</p>
                <p className="text-xs text-muted-foreground">Move projects</p>
              </div>
              <Briefcase className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/attendance" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Attendance</p>
                <p className="text-xs text-muted-foreground">Check in / out</p>
              </div>
              <Clock className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/software-dev#payroll" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">My Payslips</p>
                <p className="text-xs text-muted-foreground">Salary history</p>
              </div>
              <Wallet className="h-5 w-5 text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
          </AppleCard>
        </Link>
      </div>

      {/* Dev KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Active Projects" value={devStats?.activeProjects || 0} icon={Briefcase} subtitle="In progress" color="bg-amber-500" delay={0} />
        <KPICard title="Pending Approvals" value={(devStats?.pendingProjects || 0) + (devStats?.pendingSales || 0)} icon={Clock} subtitle="Projects & sales" color="bg-blue-500" delay={0.1} />
        <KPICard title="Total Revenue" value={formatDevCurrency(devStats?.totalRevenue || 0)} icon={DollarSign} subtitle="Completed sales" color="bg-emerald-500" delay={0.2} />
        <KPICard title="Products" value={devStats?.totalProducts || 0} icon={Package} subtitle="In catalog" color="bg-violet-500" delay={0.3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Attendance today */}
        <AnimatedSection delay={0.2}>
          <AppleCard className="h-full">
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Today&apos;s Attendance
              </AppleCardTitle>
              <AppleCardDescription>{todayStr}</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent className="space-y-4">
              {attendanceLoading ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : todayRecord ? (
                <div className="rounded-xl border border-border/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={todayRecord.status === "late" ? "destructive" : "default"} className="capitalize">
                      {todayRecord.status?.replace("_", " ")}
                    </Badge>
                  </div>
                  {todayRecord.checkIn && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Check in</span>
                      <span>{new Date(todayRecord.checkIn).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {todayRecord.checkOut && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Check out</span>
                      <span>{new Date(todayRecord.checkOut).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {!todayRecord.checkOut && (
                    <Button
                      className="w-full mt-2"
                      variant="outline"
                      onClick={() => checkOutMutation.mutate()}
                      disabled={checkOutMutation.isPending}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {checkOutMutation.isPending ? "Checking out..." : "Check Out"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">You haven&apos;t checked in yet today.</p>
                  <Button
                    className="w-full"
                    onClick={() => checkInMutation.mutate({})}
                    disabled={checkInMutation.isPending}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    {checkInMutation.isPending ? "Checking in..." : "Check In Now"}
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="font-bold text-lg">{attStats.present}</div>
                  <div className="text-muted-foreground">Present</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="font-bold text-lg">{attStats.late}</div>
                  <div className="text-muted-foreground">Late</div>
                </div>
              </div>
              <Link to="/attendance" className="inline-flex items-center text-sm text-primary hover:underline">
                View full attendance <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        {/* Latest payslip */}
        <AnimatedSection delay={0.25}>
          <AppleCard className="h-full">
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-500" />
                Latest Payslip
              </AppleCardTitle>
              <AppleCardDescription>Your most recent salary record</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              {payrollLoading ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : latestPayslip ? (
                <div className="rounded-xl border border-border/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{latestPayslip.month}</span>
                    <Badge variant={latestPayslip.paymentStatus === "paid" ? "default" : "secondary"}>
                      {latestPayslip.paymentStatus}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">{formatDevCurrency(latestPayslip.netSalary || 0)}</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>Base</span><span>Nu.{latestPayslip.baseSalary}</span></div>
                    {Number(latestPayslip.bonus) > 0 && (
                      <div className="flex justify-between"><span>Bonus</span><span>Nu.{latestPayslip.bonus}</span></div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">No payslips yet</div>
              )}
              <Link to="/software-dev#payroll" className="inline-flex items-center text-sm text-primary hover:underline mt-4">
                View all payslips <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        {/* My active projects */}
        <AnimatedSection delay={0.3}>
          <AppleCard className="h-full">
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-amber-500" />
                My Active Projects
              </AppleCardTitle>
              <AppleCardDescription>Assigned to you</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent className="space-y-2">
              {(myProjects?.items?.length ?? 0) === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">No active projects assigned</div>
              ) : (
                myProjects?.items?.map((project: { id: number; name: string; status: string; priority?: string }) => (
                  <div key={project.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/30 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{project.status?.replace(/_/g, " ")}</p>
                    </div>
                    {project.priority && (
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{project.priority}</Badge>
                    )}
                  </div>
                ))
              )}
              <Link to="/software-dev#projects" className="inline-flex items-center text-sm text-primary hover:underline">
                All projects <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatedSection delay={0.35}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Monthly Sales
              </AppleCardTitle>
              <AppleCardDescription>Revenue from software sales</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              {monthlySalesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlySalesData}>
                    <defs>
                      <linearGradient id="devColorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip formatter={(value: number) => [`Nu. ${value.toLocaleString()}`, "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#devColorRevenue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No sales data yet</div>
              )}
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        <AnimatedSection delay={0.4}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                Project Status
              </AppleCardTitle>
              <AppleCardDescription>All projects by workflow stage</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              {projectStatusData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                        {projectStatusData.map((_: unknown, index: number) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {projectStatusData.map((s: { name: string; value: number }, i: number) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {s.name} ({s.value})
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No project data yet</div>
              )}
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      </div>

      {/* Secondary KPIs row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Completed Projects" value={devStats?.completedProjects || 0} icon={CheckCircle2} color="bg-emerald-500" delay={0.45} />
        <KPICard title="Pending Sales" value={devStats?.pendingSales || 0} icon={ShoppingCart} color="bg-amber-500" delay={0.5} />
        <KPICard title="Outstanding" value={formatDevCurrency(devStats?.outstandingPayments || 0)} icon={DollarSign} color="bg-red-500" delay={0.55} />
        <KPICard title="Approved Sales" value={devStats?.approvedSales || 0} icon={TrendingUp} color="bg-blue-500" delay={0.6} />
      </div>
    </AnimatedPage>
  );
}

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
        description="Track all property listings and approvals"
        icon={<Building2 className="h-5 w-5" />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Properties"
          value={stats?.totalProperties || 0}
          icon={Building2}
          subtitle="All listings"
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

function ArchitectureStaffDashboard() {
  const { user } = useAuth();
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" }).substring(0, 7);
  const { data: stats, isLoading } = trpc.architectureDashboard.staff.useQuery();
  const { data: myProjects } = trpc.architectureProject.list.useQuery({ limit: 5, status: "in_progress" });
  const { data: myOrders } = trpc.architectureOrder.list.useQuery({ limit: 5, status: "in_progress" });
  const { data: payslips, isLoading: payrollLoading } = trpc.payroll.myPayroll.useQuery({ limit: 3 });
  const latestPayslip = payslips?.[0];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Architecture projects, customer orders, and design deliverables"
        icon={<PenTool className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <Link to="/architecture" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Architecture Module</p>
                <p className="text-xs text-muted-foreground">Projects, orders & files</p>
              </div>
              <PenTool className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/architecture#projects" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">My Projects</p>
                <p className="text-xs text-muted-foreground">{stats?.totalProjects ?? 0} total</p>
              </div>
              <Briefcase className="h-5 w-5 text-amber-500" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/architecture#orders" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">My Orders</p>
                <p className="text-xs text-muted-foreground">{stats?.inProgressOrders ?? 0} in progress</p>
              </div>
              <ShoppingCart className="h-5 w-5 text-green-600" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/attendance" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Attendance</p>
                <p className="text-xs text-muted-foreground">Check in / out</p>
              </div>
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/payroll" className="group">
          <AppleCard className="p-4 h-full transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">My Payslips</p>
                <p className="text-xs text-muted-foreground">Salary records</p>
              </div>
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
          </AppleCard>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard title="Total Projects" value={stats?.totalProjects ?? 0} icon={Briefcase} />
        <KPICard title="Pending Review" value={stats?.pendingProjects ?? 0} icon={AlertCircle} />
        <KPICard title="Active Orders" value={stats?.inProgressOrders ?? 0} icon={ShoppingCart} />
        <KPICard title="Revenue Collected" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={DollarSign} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AppleCard>
          <AppleCardHeader>
            <AppleCardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              Latest Payslip
            </AppleCardTitle>
            <AppleCardDescription>From the company payroll system</AppleCardDescription>
          </AppleCardHeader>
          <AppleCardContent>
            {payrollLoading ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : latestPayslip ? (
              <div className="rounded-xl border border-border/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{latestPayslip.month}</span>
                  <Badge variant={latestPayslip.paymentStatus === "paid" ? "default" : "secondary"}>
                    {latestPayslip.paymentStatus}
                  </Badge>
                </div>
                <div className="text-2xl font-bold">{formatDevCurrency(latestPayslip.netSalary || 0)}</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payslips yet for {currentMonth}.</p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/payroll">View payslips <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </AppleCardContent>
        </AppleCard>

        <AppleCard>
          <AppleCardHeader>
            <AppleCardTitle>Recent Projects</AppleCardTitle>
            <AppleCardDescription>Your latest architecture submissions</AppleCardDescription>
          </AppleCardHeader>
          <AppleCardContent>
            {!myProjects?.items.length ? (
              <p className="text-sm text-muted-foreground">No projects yet. Open Architecture to create one.</p>
            ) : (
              <div className="space-y-3">
                {myProjects.items.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{p.title}</span>
                    <Badge variant="secondary">{p.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/architecture#projects">View all projects <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </AppleCardContent>
        </AppleCard>

        <AppleCard>
          <AppleCardHeader>
            <AppleCardTitle>Active Orders</AppleCardTitle>
            <AppleCardDescription>Customer sales in development</AppleCardDescription>
          </AppleCardHeader>
          <AppleCardContent>
            {!myOrders?.items.length ? (
              <p className="text-sm text-muted-foreground">No active orders yet.</p>
            ) : (
              <div className="space-y-3">
                {myOrders.items.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{o.projectName}</span>
                    <Badge variant="secondary">{o.progressPercentage}%</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/architecture#orders">View all orders <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </AppleCardContent>
        </AppleCard>
      </div>
    </AnimatedPage>
  );
}

export default function Dashboard() {
  const { isAdmin, isDeveloper, isArchitectureStaff } = useAuth();
  if (isAdmin) return <AdminDashboard />;
  if (isDeveloper) return <DeveloperDashboard />;
  if (isArchitectureStaff) return <ArchitectureStaffDashboard />;
  return <StaffDashboard />;
}
