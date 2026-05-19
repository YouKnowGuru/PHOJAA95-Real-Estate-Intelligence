import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Building2, DollarSign, Award, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const formatCurrency = (val: string | number) => {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "Nu. 0";
  if (n >= 100000) return `Nu. ${(n / 100000).toFixed(2)}L`;
  return `Nu. ${n.toLocaleString()}`;
};

function SummaryCard({
  title,
  value,
  color,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  value: React.ReactNode;
  color: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      <motion.div whileHover={{ y: -4 }} className="group relative overflow-hidden border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
        <Card className="border-0 bg-transparent shadow-none">
          <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color} bg-opacity-10 dark:bg-opacity/20`}>
                <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear.toString());

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.adminStats.useQuery();
  const { data: typeStats, isLoading: typeLoading } = trpc.dashboard.propertyTypeStats.useQuery();
  const { data: staffPerf, isLoading: staffLoading } = trpc.dashboard.staffPerformance.useQuery({});
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
    const rows = staffPerf.map(s => [
      s.staffName,
      s.totalProperties,
      s.completedSales,
      s.pendingApprovals,
      s.totalRevenue
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `staff_performance_report_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive business insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
              <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV} className="bg-white/50">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* KPI Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          [...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <SummaryCard title="Total Properties" value={stats?.totalProperties || 0} color="bg-blue-500" icon={Building2} delay={0} />
            <SummaryCard title="Completed Sales" value={stats?.completedSales || 0} color="bg-emerald-500" icon={TrendingUp} delay={0.1} />
            <SummaryCard title="Total Staff" value={stats?.totalStaff || 0} color="bg-violet-500" icon={Users} delay={0.2} />
            <SummaryCard title="Total Revenue" value={formatCurrency(stats?.totalRevenue || "0")} color="bg-amber-500" icon={DollarSign} delay={0.3} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Monthly Sales Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Revenue Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `Nu. ${v.toLocaleString()}`} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-violet-500" />
            Staff Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/30">
                    <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Staff</th>
                    <th className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Completed</th>
                    <th className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending</th>
                    <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {staffPerf?.map((s) => (
                    <tr key={s.staffId} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-medium">{s.staffName}</td>
                      <td className="text-center py-2.5 px-3">{s.totalProperties}</td>
                      <td className="text-center py-2.5 px-3 text-emerald-600">{s.completedSales}</td>
                      <td className="text-center py-2.5 px-3 text-amber-600">{s.pendingApprovals}</td>
                      <td className="text-right py-2.5 px-3 font-semibold">
                        Nu. {parseFloat(s.totalRevenue).toLocaleString()}
                      </td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">No data</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Property Type Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Property Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {typeLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={typeStats || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="typeName"
                  >
                    {(typeStats || []).map((_, index: number) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Workflow Step Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            {workflowLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={workflowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="step" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="approved" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
