import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart3, FileSpreadsheet, FileText, Download, Eye, Plus } from "lucide-react";

const REPORT_TYPES = [
  { value: "sales_summary", label: "Sales Summary" },
  { value: "project_progress", label: "Project Progress" },
  { value: "payment_collection", label: "Payment Collection" },
  { value: "customer_analysis", label: "Customer Analysis" },
  { value: "product_performance", label: "Product Performance" },
  { value: "revenue_report", label: "Revenue Report" },
  { value: "outstanding_payments", label: "Outstanding Payments" },
  { value: "developer_performance", label: "Developer Performance" },
];

const EXPORT_FORMATS = [
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "excel", label: "Excel", icon: FileSpreadsheet },
  { value: "csv", label: "CSV", icon: FileText },
];

export default function SoftwareReports() {
  const [viewReport, setViewReport] = useState<any>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [exportFormat, setExportFormat] = useState("pdf");

  const { data, isLoading } = trpc.softwareReport.list.useQuery({ page: 1, limit: 50 });
  const { data: stats } = trpc.softwareReport.stats.useQuery();
  const generateMutation = trpc.softwareReport.generate.useMutation({
    onSuccess: () => {
      setCreateDialog(false);
      alert("Report generated successfully!");
    },
    onError: (err) => alert(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading reports..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Reports"
        description="Generate and manage software development reports"
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Reports</p>
            <p className="text-lg font-bold">{stats?.total || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PDF</p>
            <p className="text-lg font-bold">{stats?.pdf || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <FileSpreadsheet className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Excel</p>
            <p className="text-lg font-bold">{stats?.excel || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CSV</p>
            <p className="text-lg font-bold">{stats?.csv || 0}</p>
          </div>
        </AppleCard>
      </div>

      {/* Reports Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Report Name</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Date Range</th>
                  <th className="text-left py-3 px-4 font-medium">Format</th>
                  <th className="text-left py-3 px-4 font-medium">Generated</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((report: any) => (
                  <tr key={report.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-medium">{report.reportName}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {REPORT_TYPES.find(t => t.value === report.reportType)?.label || report.reportType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {report.dateFrom} to {report.dateTo}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        report.exportFormat === "pdf"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : report.exportFormat === "excel"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {report.exportFormat.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{report.createdAt}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewReport(report)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No reports found"
            description="Generate sales, project, payment, and performance reports."
            icon={<BarChart3 className="h-5 w-5" />}
          />
        )}
      </AppleCard>

      {/* View Report Dialog */}
      <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewReport?.reportName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-medium">
                  {REPORT_TYPES.find(t => t.value === viewReport?.reportType)?.label || viewReport?.reportType}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Format:</span>
                <p className="font-medium uppercase">{viewReport?.exportFormat}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date From:</span>
                <p className="font-medium">{viewReport?.dateFrom}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date To:</span>
                <p className="font-medium">{viewReport?.dateTo}</p>
              </div>
            </div>
            {viewReport?.filters && Object.keys(viewReport.filters).length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground font-medium">Filters:</span>
                <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(viewReport.filters, null, 2)}</pre>
              </div>
            )}
            {viewReport?.summary && (
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground font-medium">Summary:</span>
                <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(viewReport.summary, null, 2)}</pre>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewReport(null)}>Close</Button>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Download {viewReport?.exportFormat?.toUpperCase()}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Report Name</label>
              <input
                type="text"
                placeholder="e.g., Q1 2024 Sales Report"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Report Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                {REPORT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date From</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(p => ({ ...p, from: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Date To</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(p => ({ ...p, to: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Export Format</label>
              <div className="mt-1 flex gap-2">
                {EXPORT_FORMATS.map(fmt => (
                  <button
                    key={fmt.value}
                    onClick={() => setExportFormat(fmt.value)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      exportFormat === fmt.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <fmt.icon className="h-4 w-4" />
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!selectedType || !dateRange.from || !dateRange.to || generateMutation.isPending}
              onClick={() => generateMutation.mutate({
                reportName: `Report ${new Date().toLocaleDateString()}`,
                reportType: selectedType as typeof REPORT_TYPES[number]["value"],
                dateFrom: dateRange.from,
                dateTo: dateRange.to,
                exportFormat: exportFormat as "pdf" | "excel" | "csv",
              })}
            >
              {generateMutation.isPending ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
