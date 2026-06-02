import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatStatusLabel } from "@/components/software-dev/utils";

export type ArchitectureReportExportData = {
  reportName: string;
  reportType: string;
  dateFrom: string;
  dateTo: string;
  exportFormat: "pdf" | "excel" | "csv";
  summary: Record<string, unknown>;
};

function flattenSummary(reportType: string, summary: Record<string, unknown>): string[][] {
  const rows: string[][] = [];

  switch (reportType) {
    case "sales":
      rows.push(["Total Orders", String(summary.totalOrders ?? 0)]);
      rows.push(["Total Revenue", String(summary.totalRevenue ?? 0)]);
      rows.push(["Collected", String(summary.collected ?? 0)]);
      rows.push(["Outstanding", String(summary.outstanding ?? 0)]);
      rows.push(["Average Order", String(summary.avgOrderValue ?? 0)]);
      (summary.topOrders as Array<{ orderNumber: string; projectName: string; finalAmount: string | number }> | undefined)?.forEach((row) => {
        rows.push([row.orderNumber, row.projectName, String(row.finalAmount ?? 0)]);
      });
      break;
    case "projects":
      rows.push(["Total Projects", String(summary.totalProjects ?? 0)]);
      (summary.projectsByStatus as Array<{ status: string; count: number }> | undefined)?.forEach((row) => {
        rows.push([formatStatusLabel(row.status), String(row.count ?? 0)]);
      });
      break;
    case "revenue":
      rows.push(["Total Billed", String(summary.totalRevenue ?? 0)]);
      rows.push(["Collected", String(summary.collectedRevenue ?? 0)]);
      rows.push(["Pending", String(summary.pendingRevenue ?? 0)]);
      (summary.revenueByMonth as Array<{ month: string; totalRevenue: number; collected?: number }> | undefined)?.forEach((row) => {
        rows.push([row.month, String(row.totalRevenue ?? 0), String(row.collected ?? "")]);
      });
      break;
    case "staff_performance":
      (summary.staffPerformance as Array<{ staffName?: string | null; staffId?: number; ordersCount?: number; revenue?: number; collected?: number }> | undefined)?.forEach((row) => {
        rows.push([
          row.staffName || `Staff #${row.staffId}`,
          String(row.ordersCount ?? 0),
          String(row.revenue ?? 0),
          String(row.collected ?? 0),
        ]);
      });
      break;
    case "payment_collection":
      rows.push(["Total Payments", String(summary.totalPayments ?? 0)]);
      rows.push(["Total Collected", String(summary.totalCollected ?? 0)]);
      (summary.verificationStats as Array<{ status: string; count: number }> | undefined)?.forEach((row) => {
        rows.push([formatStatusLabel(row.status), String(row.count ?? 0)]);
      });
      break;
    case "outstanding_balances":
      rows.push(["Outstanding Orders", String(summary.count ?? 0)]);
      rows.push(["Total Outstanding", String(summary.totalOutstanding ?? 0)]);
      (summary.outstandingOrders as Array<{ orderNumber: string; projectName: string; remainingPayment: string | number }> | undefined)?.forEach((row) => {
        rows.push([row.orderNumber, row.projectName, String(row.remainingPayment ?? 0)]);
      });
      break;
    default:
      Object.entries(summary).forEach(([key, value]) => {
        if (typeof value === "number" || typeof value === "string") {
          rows.push([formatStatusLabel(key), String(value)]);
        }
      });
  }

  return rows;
}

function getTableHeaders(reportType: string): string[] {
  switch (reportType) {
    case "sales":
      return ["Metric / Order", "Project", "Amount"];
    case "revenue":
      return ["Month", "Revenue", "Collected"];
    case "staff_performance":
      return ["Staff", "Orders", "Revenue", "Collected"];
    case "outstanding_balances":
      return ["Order #", "Project", "Remaining"];
    default:
      return ["Category", "Value"];
  }
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(name: string) {
  return name.replace(/[^\w\-]+/g, "_").slice(0, 80);
}

export function exportArchitectureReportAsCsv(report: ArchitectureReportExportData) {
  const rows = flattenSummary(report.reportType, report.summary);
  const headers = getTableHeaders(report.reportType);
  const lines = [
    `"${report.reportName}"`,
    `"Period","${report.dateFrom}","${report.dateTo}"`,
    "",
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ];
  downloadBlob(lines.join("\n"), `${safeFilename(report.reportName)}.csv`, "text/csv;charset=utf-8");
}

export function exportArchitectureReportAsPdf(report: ArchitectureReportExportData) {
  const doc = new jsPDF();
  const rows = flattenSummary(report.reportType, report.summary);
  const headers = getTableHeaders(report.reportType);

  doc.setFontSize(16);
  doc.text(report.reportName, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Period: ${report.dateFrom} to ${report.dateTo}`, 14, 26);
  doc.text(`Type: ${formatStatusLabel(report.reportType)}`, 14, 32);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 40,
    head: [headers],
    body: rows.length > 0 ? rows : [["No data", ""]],
    theme: "grid",
    headStyles: { fillColor: [13, 148, 136] },
    styles: { fontSize: 9 },
  });

  doc.save(`${safeFilename(report.reportName)}.pdf`);
}

export function exportArchitectureReport(report: ArchitectureReportExportData) {
  if (report.exportFormat === "csv" || report.exportFormat === "excel") {
    exportArchitectureReportAsCsv(report);
    return;
  }
  exportArchitectureReportAsPdf(report);
}
