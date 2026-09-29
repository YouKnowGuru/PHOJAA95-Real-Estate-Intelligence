import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, Building2, DollarSign, Award, Download } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { AppleCard, AppleCardHeader, AppleCardTitle, AppleCardDescription, AppleCardContent } from "@/components/ui/apple-card";
import { KPICard } from "@/components/ui/kpi-card";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const formatCurrency = (val: string | number) => {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "Nu. 0";
  if (n >= 100000) return `Nu. ${(n / 100000).toFixed(2)}L`;
  return `Nu. ${n.toLocaleString()}`;
};

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear.toString());

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.adminStats.useQuery();
  const { data: typeStats, isLoading: typeLoading } = trpc.dashboard.propertyTypeStats.useQuery();
  const { data: staffPerf, isLoading: staffLoading } = trpc.dashboard.staffPerformance.useQuery();
  const { data: workflowStats, isLoading: workflowLoading } = trpc.dashboard.workflowStats.useQuery();
  const { data: realMonthlyData, isLoading: monthlyLoading } = trpc.dashboard.monthlySales.useQuery({ year });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlyData = realMonthlyData?.map(d => {
    const monthIdx = parseInt(d.month.split("-")[1]) - 1;
    return {
      month: monthNames[monthIdx] || d.month,
      sales: d.count,
      revenue: parseFloat(d.revenue)
    };
  }) || [];

  const workflowData = workflowStats?.map((s) => ({
    step: `Step ${s.step}`,
    approved: s.approved,
    pending: s.pending,
    rejected: s.rejected,
  })) || [];

  const handleExportCSV = () => {
    if (!staffPerf) return;

    const headers = ["Staff Name", "Total Properties", "Completed Sales", "Pending Approvals", "Total Revenue (Nu)"];
    const rows = staffPerf.map((s) => [
      s.staffName,
      s.totalProperties,
      s.completedSales,
      s.pendingApprovals,
      s.totalRevenue,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `staff_performance_${year}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = statsLoading || typeLoading || staffLoading || workflowLoading || monthlyLoading;

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageHeader title="Reports" description="Analytics and performance insights" icon={<BarChart3 className="h-5 w-5" />} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Reports"
        description="Analytics and performance insights"
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Properties" value={stats?.totalProperties || 0} icon={Building2} color="bg-blue-500" delay={0} />
        <KPICard title="Completed Sales" value={stats?.completedSales || 0} icon={Award} color="bg-emerald-500" delay={0.1} />
        <KPICard title="Total Revenue" value={formatCurrency(stats?.totalRevenue || "0")} icon={DollarSign} color="bg-violet-500" delay={0.2} />
        <KPICard title="Active Staff" value={stats?.totalStaff || 0} icon={Users} color="bg-primary" delay={0.3} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatedSection delay={0.3}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Monthly Sales & Revenue
              </AppleCardTitle>
              <AppleCardDescription>Sales performance over {year}</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                    }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>

        <AnimatedSection delay={0.4}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet-500" />
                Property Types
              </AppleCardTitle>
              <AppleCardDescription>Distribution by property type</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeStats || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="typeName"
                  >
                    {(typeStats || []).map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {(typeStats || []).map((s, i) => (
                  <div key={s.typeName} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{s.typeName}</span>
                  </div>
                ))}
              </div>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      </div>

      {/* Workflow Stats */}
      <AnimatedSection delay={0.5}>
        <AppleCard>
          <AppleCardHeader>
            <AppleCardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-500" />
              Workflow Performance
            </AppleCardTitle>
            <AppleCardDescription>Step-by-step approval breakdown</AppleCardDescription>
          </AppleCardHeader>
          <AppleCardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={workflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="step" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="approved" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {[
                { label: "Approved", color: "#10b981" },
                { label: "Pending", color: "#f59e0b" },
                { label: "Rejected", color: "#ef4444" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </AppleCardContent>
        </AppleCard>
      </AnimatedSection>

      {/* Staff Performance */}
      {staffPerf && staffPerf.length > 0 && (
        <AnimatedSection delay={0.6}>
          <AppleCard>
            <AppleCardHeader>
              <AppleCardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Staff Performance
              </AppleCardTitle>
              <AppleCardDescription>Top performers by revenue</AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Staff</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Properties</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Sales</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Pending</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerf.map((s, i) => (
                      <motion.tr
                        key={s.staffId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium">{s.staffName}</td>
                        <td className="text-center py-3 px-4">{s.totalProperties}</td>
                        <td className="text-center py-3 px-4 text-emerald-600 font-medium">{s.completedSales}</td>
                        <td className="text-center py-3 px-4 text-amber-600">{s.pendingApprovals}</td>
                        <td className="text-right py-3 px-4 font-semibold">{formatCurrency(s.totalRevenue)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppleCardContent>
          </AppleCard>
        </AnimatedSection>
      )}
    </AnimatedPage>
  );
}
