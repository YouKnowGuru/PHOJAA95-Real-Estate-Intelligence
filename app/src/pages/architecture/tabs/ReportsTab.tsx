import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KPICard } from "@/components/ui/kpi-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { SoftwareTabPanel, softwareFormDialogClass, formatStatusLabel } from "@/components/software-dev";
import { TabSectionHeader } from "../TabSectionHeader";
import {
  ArchitectureOverviewCharts,
  ArchitectureReportSummary,
  formatArchCurrency,
} from "@/components/architecture/ArchitectureReportSummary";
import { exportArchitectureReport } from "@/components/architecture/architecture-report-export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Trash2,
  Users,
  Clock,
  DollarSign,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";

const REPORT_TYPES = [
  { value: "sales", label: "Sales Report" },
  { value: "projects", label: "Projects Report" },
  { value: "revenue", label: "Revenue Report" },
  { value: "staff_performance", label: "Staff Performance" },
  { value: "payment_collection", label: "Payment Collection" },
  { value: "outstanding_balances", label: "Outstanding Balances" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["value"];
type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly" | "custom";
type ExportFormat = "pdf" | "excel" | "csv";

type GeneratedReport = {
  id: number;
  reportName: string;
  reportType: string;
  dateFrom: string;
  dateTo: string;
  exportFormat: ExportFormat;
  summary: Record<string, unknown>;
  createdAt: string;
};

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

export default function ReportsTab({ isAdmin }: { isAdmin: boolean }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const defaults = useMemo(() => defaultDateRange(), []);

  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("monthly");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [reportData, setReportData] = useState<GeneratedReport | null>(null);
  const [reportHistory, setReportHistory] = useState<GeneratedReport[]>([]);
  const [viewReport, setViewReport] = useState<GeneratedReport | null>(null);

  const { data: overview, isLoading: overviewLoading } = trpc.architectureReport.overview.useQuery(
    { year },
    { enabled: isAdmin }
  );

  const generateMutation = trpc.architectureReport.generate.useMutation({
    onSuccess: (data) => {
      const report = data as GeneratedReport;
      setReportData(report);
      setReportHistory((prev) => [report, ...prev]);
      toast.success("Report generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateReport = () => {
    if (!reportName.trim()) {
      toast.error("Report name is required");
      return;
    }
    generateMutation.mutate({
      reportName: reportName.trim(),
      reportType,
      period: reportPeriod,
      dateFrom: reportPeriod === "custom" || dateFrom ? dateFrom : undefined,
      dateTo: reportPeriod === "custom" || dateTo ? dateTo : undefined,
      exportFormat,
    });
  };

  const handleExport = (report: GeneratedReport) => {
    exportArchitectureReport({
      reportName: report.reportName,
      reportType: report.reportType,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      exportFormat: report.exportFormat || "pdf",
      summary: report.summary || {},
    });
    toast.success(`Downloading ${(report.exportFormat || "pdf").toUpperCase()} report`);
  };

  const removeReportFromHistory = (id: number) => {
    setReportHistory((prev) => prev.filter((r) => r.id !== id));
    setReportData((current) => (current?.id === id ? null : current));
    setViewReport((current) => (current?.id === id ? null : current));
    toast.success("Report removed from session");
  };

  const clearReportHistory = () => {
    setReportHistory([]);
    setReportData(null);
    setViewReport(null);
    toast.success("Session reports cleared");
  };

  if (!isAdmin) {
    return (
      <SoftwareTabPanel>
        <TabSectionHeader title="Reports & Analytics" description="Sales, revenue, and staff performance reports." />
        <EmptyState title="Admin access required" description="Reports are available to administrators only." />
      </SoftwareTabPanel>
    );
  }

  return (
    <SoftwareTabPanel className="space-y-6">
      <TabSectionHeader
        title="Reports & Analytics"
        description="Executive overview, visual reports, and downloadable exports for architecture operations."
        actions={
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        }
      />

      {overviewLoading ? (
        <div className="flex h-48 items-center justify-center">
          <OniLoader size="lg" text="Loading analytics" />
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Architecture Staff" value={overview.kpis.totalStaff} icon={Users} color="bg-teal-600" delay={0} />
            <KPICard title="Pending Approvals" value={(overview.kpis.pendingProjectApprovals ?? 0) + (overview.kpis.pendingOrderApprovals ?? 0)} icon={Clock} color="bg-amber-500" delay={0.05} subtitle={`${overview.kpis.pendingProjectApprovals} projects · ${overview.kpis.pendingOrderApprovals} orders`} />
            <KPICard title="Revenue Collected" value={formatArchCurrency(overview.kpis.totalCollected)} icon={DollarSign} color="bg-emerald-600" delay={0.1} />
            <KPICard title={`Orders (${year})`} value={overview.kpis.ordersThisYear} icon={ShoppingCart} color="bg-slate-700" delay={0.15} subtitle={formatArchCurrency(overview.kpis.revenueThisYear)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AppleCard hover={false} className="p-4">
              <p className="text-xs text-muted-foreground">Total Billed</p>
              <p className="text-lg font-bold">{formatArchCurrency(overview.kpis.totalBilled)}</p>
            </AppleCard>
            <AppleCard hover={false} className="p-4">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold text-amber-600">{formatArchCurrency(overview.kpis.totalOutstanding)}</p>
            </AppleCard>
            <AppleCard hover={false} className="p-4 flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-teal-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">Global architecture data</p>
                <p className="text-xs text-muted-foreground">All staff projects, orders, and payments included.</p>
              </div>
            </AppleCard>
          </div>

          <ArchitectureOverviewCharts
            projectsByStatus={overview.projectsByStatus}
            ordersByPaymentStatus={overview.ordersByPaymentStatus}
            monthlyTrend={overview.monthlyTrend}
            topCategories={overview.topCategories}
          />
        </>
      ) : null}

      <AppleCard hover={false} className="p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="h-5 w-5 text-teal-600" />
          Generate Report
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 sm:col-span-2">
            <Label>Report Name *</Label>
            <Input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="March 2026 Sales Summary" />
          </div>
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(v: ReportType) => setReportType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={reportPeriod} onValueChange={(v: ReportPeriod) => setReportPeriod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Today</SelectItem>
                <SelectItem value="weekly">Last 7 days</SelectItem>
                <SelectItem value="monthly">This month</SelectItem>
                <SelectItem value="yearly">This year</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(reportPeriod === "custom" || reportPeriod === "monthly") && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={reportPeriod !== "custom"} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={reportPeriod !== "custom"} />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Label>Export Format</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "pdf" as const, label: "PDF", icon: FileText },
              { value: "excel" as const, label: "Excel", icon: FileSpreadsheet },
              { value: "csv" as const, label: "CSV", icon: FileText },
            ].map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => setExportFormat(fmt.value)}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  exportFormat === fmt.value ? "border-teal-600 bg-teal-600/5 text-teal-700 dark:text-teal-400" : "border-border hover:bg-accent"
                )}
              >
                <fmt.icon className="h-4 w-4" />
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={generateReport} disabled={generateMutation.isPending} className="min-h-10 w-full sm:w-auto">
            {generateMutation.isPending ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      </AppleCard>

      {reportData ? (
        <AppleCard hover={false} className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{reportData.reportName}</h3>
              <p className="text-sm text-muted-foreground">
                {REPORT_TYPES.find((r) => r.value === reportData.reportType)?.label} · {reportData.dateFrom} — {reportData.dateTo}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleExport(reportData)}>
              <Download className="mr-1 h-4 w-4" />
              Download
            </Button>
          </div>
          <ArchitectureReportSummary reportType={reportData.reportType} summary={reportData.summary} />
        </AppleCard>
      ) : (
        <EmptyState title="No report generated yet" description="Fill in the form above and click Generate Report to see visual analytics." />
      )}

      {reportHistory.length > 0 && (
        <AppleCard hover={false} className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Recent Reports (this session)</h3>
            <Button variant="outline" size="sm" onClick={clearReportHistory}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Clear all
            </Button>
          </div>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Format</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportHistory.map((report) => (
                  <tr key={report.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{report.reportName}</td>
                    <td className="px-4 py-3">{REPORT_TYPES.find((r) => r.value === report.reportType)?.label || formatStatusLabel(report.reportType)}</td>
                    <td className="px-4 py-3 text-xs">{report.dateFrom} to {report.dateTo}</td>
                    <td className="px-4 py-3 text-xs uppercase">{report.exportFormat}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewReport(report)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExport(report)} title="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeReportFromHistory(report.id)} title="Remove">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppleCard>
      )}

      <Dialog open={viewReport !== null} onOpenChange={(open) => !open && setViewReport(null)}>
        <DialogContent className={softwareFormDialogClass}>
          <DialogHeader>
            <DialogTitle>{viewReport?.reportName}</DialogTitle>
          </DialogHeader>
          {viewReport && (
            <ArchitectureReportSummary reportType={viewReport.reportType} summary={viewReport.summary} />
          )}
        </DialogContent>
      </Dialog>
    </SoftwareTabPanel>
  );
}
