import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatStatusLabel } from "@/components/software-dev/utils";

const CHART_COLORS = ["#0d9488", "#1e3a5f", "#d4a853", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"];

export function formatArchCurrency(val: string | number | null | undefined): string {
  const n = typeof val === "string" ? parseFloat(val) : Number(val ?? 0);
  if (Number.isNaN(n)) return "Nu. 0";
  if (n >= 100000) return `Nu. ${(n / 100000).toFixed(2)}L`;
  return `Nu. ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

type SummaryProps = {
  reportType: string;
  summary: Record<string, unknown>;
};

export function ArchitectureReportSummary({ reportType, summary }: SummaryProps) {
  if (!summary) return null;

  const statCards: { label: string; value: string | number }[] = [];
  const chartData: { label: string; value: number }[] = [];
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  switch (reportType) {
    case "sales":
      statCards.push(
        { label: "Total Orders", value: summary.totalOrders ?? 0 },
        { label: "Total Revenue", value: formatArchCurrency(summary.totalRevenue as number) },
        { label: "Collected", value: formatArchCurrency(summary.collected as number) },
        { label: "Outstanding", value: formatArchCurrency(summary.outstanding as number) },
      );
      (summary.ordersByPaymentStatus as Array<{ status: string; count: number }> | undefined)?.forEach((row) => {
        chartData.push({ label: formatStatusLabel(row.status), value: Number(row.count ?? 0) });
      });
      tableHeaders = ["Order #", "Project", "Amount", "Paid", "Status"];
      tableRows = ((summary.topOrders as Array<Record<string, unknown>>) ?? []).map((row) => [
        String(row.orderNumber ?? ""),
        String(row.projectName ?? ""),
        formatArchCurrency(row.finalAmount as string),
        formatArchCurrency(row.totalPaid as string),
        formatStatusLabel(String(row.paymentStatus ?? "")),
      ]);
      break;

    case "projects": {
      statCards.push({ label: "Total Projects", value: summary.totalProjects ?? 0 });
      const byStatus = summary.projectsByStatus as Array<{ status: string; count: number }> | undefined;
      byStatus?.forEach((row) => {
        chartData.push({ label: formatStatusLabel(row.status), value: Number(row.count ?? 0) });
      });
      break;
    }

    case "revenue":
      statCards.push(
        { label: "Total Billed", value: formatArchCurrency(summary.totalRevenue as number) },
        { label: "Collected", value: formatArchCurrency(summary.collectedRevenue as number) },
        { label: "Pending", value: formatArchCurrency(summary.pendingRevenue as number) },
      );
      (summary.revenueByMonth as Array<{ month: string; totalRevenue: number }> | undefined)?.forEach((row) => {
        chartData.push({ label: row.month, value: Number(row.totalRevenue ?? 0) });
      });
      break;

    case "staff_performance":
      (summary.staffPerformance as Array<{ staffName?: string | null; staffId?: number; ordersCount?: number; revenue?: number; collected?: number }> | undefined)?.forEach((row) => {
        chartData.push({
          label: row.staffName || `Staff #${row.staffId}`,
          value: Number(row.revenue ?? 0),
        });
      });
      tableHeaders = ["Staff", "Orders", "Revenue", "Collected"];
      tableRows = ((summary.staffPerformance as Array<Record<string, unknown>>) ?? []).map((row) => [
        String(row.staffName || `Staff #${row.staffId}`),
        String(row.ordersCount ?? 0),
        formatArchCurrency(row.revenue as string),
        formatArchCurrency(row.collected as string),
      ]);
      if (chartData.length > 0) {
        statCards.push(
          { label: "Staff Members", value: chartData.length },
          { label: "Top Revenue", value: formatArchCurrency(chartData[0]?.value ?? 0) },
        );
      }
      break;

    case "payment_collection":
      statCards.push(
        { label: "Total Payments", value: summary.totalPayments ?? 0 },
        { label: "Total Collected", value: formatArchCurrency(summary.totalCollected as number) },
      );
      (summary.verificationStats as Array<{ status: string; count: number }> | undefined)?.forEach((row) => {
        chartData.push({ label: formatStatusLabel(row.status), value: Number(row.count ?? 0) });
      });
      break;

    case "outstanding_balances":
      statCards.push(
        { label: "Outstanding Orders", value: summary.count ?? 0 },
        { label: "Total Outstanding", value: formatArchCurrency(summary.totalOutstanding as number) },
        { label: "Total Billed", value: formatArchCurrency(summary.totalBilled as number) },
      );
      tableHeaders = ["Order #", "Project", "Remaining", "Status"];
      tableRows = ((summary.outstandingOrders as Array<Record<string, unknown>>) ?? []).map((row) => [
        String(row.orderNumber ?? ""),
        String(row.projectName ?? ""),
        formatArchCurrency(row.remainingPayment as string),
        formatStatusLabel(String(row.paymentStatus ?? "")),
      ]);
      break;

    default:
      Object.entries(summary).forEach(([key, value]) => {
        if (typeof value === "number" || typeof value === "string") {
          statCards.push({ label: formatStatusLabel(key), value: value as string | number });
        }
      });
  }

  const usePieChart = reportType === "projects" || reportType === "payment_collection";

  return (
    <div className="space-y-6">
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.slice(0, 8).map((card) => (
            <div key={card.label} className="rounded-xl border bg-muted/30 p-4 text-center">
              <div className="text-xl font-bold tracking-tight">{card.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="w-full overflow-x-auto rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height={280} minWidth={280}>
            {usePieChart ? (
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="label">
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="label" interval={0} angle={chartData.length > 4 ? -20 : 0} textAnchor={chartData.length > 4 ? "end" : "middle"} height={chartData.length > 4 ? 60 : 30} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={56} />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [reportType === "staff_performance" || reportType === "revenue" ? formatArchCurrency(value) : value, ""]}
                />
                <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
          {usePieChart && (
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {chartData.map((item, i) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tableRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {tableHeaders.map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ArchitectureOverviewCharts({
  projectsByStatus,
  ordersByPaymentStatus,
  monthlyTrend,
  topCategories,
}: {
  projectsByStatus: Array<{ status: string; count: number }>;
  ordersByPaymentStatus: Array<{ status: string; count: number }>;
  monthlyTrend: Array<{ month: string; orderCount: number; revenue: number; collected: number }>;
  topCategories: Array<{ categoryName: string; orderCount: number; revenue: number }>;
}) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendData = monthlyTrend.map((d) => {
    const monthIdx = parseInt(d.month.split("-")[1], 10) - 1;
    return {
      label: monthNames[monthIdx] || d.month,
      orders: Number(d.orderCount ?? 0),
      revenue: Number(d.revenue ?? 0),
    };
  });

  const projectChart = projectsByStatus.map((r) => ({
    label: formatStatusLabel(r.status),
    value: Number(r.count ?? 0),
  }));

  const paymentChart = ordersByPaymentStatus.map((r) => ({
    label: formatStatusLabel(r.status),
    value: Number(r.count ?? 0),
  }));

  const categoryChart = topCategories.map((r) => ({
    label: r.categoryName,
    value: Number(r.revenue ?? 0),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Monthly Orders & Revenue" description="Architecture sales trend">
        <ResponsiveContainer width="100%" height={260} minWidth={260}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={40} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={48} />
            <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
            <Bar yAxisId="left" dataKey="orders" fill="#1e3a5f" name="Orders" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="revenue" fill="#0d9488" name="Revenue (Nu.)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Projects by Status" description="Portfolio pipeline">
        <MiniPie data={projectChart} />
      </ChartCard>

      <ChartCard title="Payment Status" description="All architecture orders">
        <MiniPie data={paymentChart} />
      </ChartCard>

      <ChartCard title="Top Categories" description="By revenue">
        <ResponsiveContainer width="100%" height={260} minWidth={260}>
          <BarChart data={categoryChart} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <RechartsTooltip formatter={(v: number) => formatArchCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
            <Bar dataKey="value" fill="#d4a853" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h4 className="font-semibold">{title}</h4>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function MiniPie({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>;
  }
  return (
    <>
      <ResponsiveContainer width="100%" height={220} minWidth={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="label">
            {data.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-2">
        {data.map((item, i) => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-[11px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
