import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatStatusLabel } from "./utils";

export type ReportExportData = {
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
    case "sales_summary":
      rows.push(["Total Sales", String(summary.totalSales ?? 0)]);
      rows.push(["Total Revenue", String(summary.totalRevenue ?? 0)]);
      rows.push(["Average Sale", String(summary.avgSale ?? 0)]);
      break;
    case "payment_collection":
      rows.push(["Total Payments", String(summary.totalPayments ?? 0)]);
      rows.push(["Total Collected", String(summary.totalCollected ?? 0)]);
      break;
    case "customer_analysis":
      rows.push(["New Customers", String(summary.totalCustomers ?? 0)]);
      break;
    case "outstanding_payments":
      rows.push(["Outstanding Sales", String(summary.count ?? 0)]);
      rows.push(["Outstanding Amount", String(summary.totalOutstanding ?? 0)]);
      break;
    case "project_progress":
      (summary.projectsByStatus as Array<{ status: string; count: number }> | undefined)?.forEach((row) => {
        rows.push([formatStatusLabel(row.status), String(row.count ?? 0)]);
      });
      break;
    case "revenue_report":
      (summary.revenueByMonth as Array<{ month: string; totalRevenue: number; saleCount?: number }> | undefined)?.forEach((row) => {
        rows.push([row.month, String(row.totalRevenue ?? 0), String(row.saleCount ?? "")]);
      });
      break;
    case "product_performance":
      (summary.productPerformance as Array<{ productName?: string; productId?: number; totalRevenue?: number; saleCount?: number }> | undefined)?.forEach((row) => {
        rows.push([
          row.productName || `Product #${row.productId}`,
          String(row.saleCount ?? 0),
          String(row.totalRevenue ?? 0),
        ]);
      });
      break;
    case "developer_performance":
      (summary.developerProjects as Array<{ developerId?: number; count?: number }> | undefined)?.forEach((row) => {
        rows.push([row.developerId ? `Developer #${row.developerId}` : "Unassigned", String(row.count ?? 0)]);
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
    case "revenue_report":
      return ["Month", "Revenue", "Sales"];
    case "product_performance":
      return ["Product", "Sales Count", "Revenue"];
    case "project_progress":
    case "developer_performance":
      return ["Category", "Count"];
    default:
      return ["Metric", "Value"];
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

export function exportReportAsCsv(report: ReportExportData) {
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

export function exportReportAsPdf(report: ReportExportData) {
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
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 },
  });

  doc.save(`${safeFilename(report.reportName)}.pdf`);
}

export function exportReport(report: ReportExportData) {
  if (report.exportFormat === "csv" || report.exportFormat === "excel") {
    exportReportAsCsv(report);
    return;
  }
  exportReportAsPdf(report);
}
