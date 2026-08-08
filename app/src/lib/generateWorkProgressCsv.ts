import type { WorkProgressReport } from "@db/schema";

// ─── Bulk Work Progress list export to CSV ──────────────────────────────
// Matches the downloadBlob pattern used by the architecture/software report exporters.

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(val: unknown): string {
  const s = val == null ? "" : String(val);
  return `"${s.replace(/"/g, '""')}"`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "draft": return "Draft";
    case "submitted": return "Submitted";
    case "reviewed": return "Reviewed";
    case "approved": return "Approved";
    default: return status;
  }
}

const HEADERS = [
  "Report Number",
  "Staff",
  "Project",
  "Feature",
  "Report Date",
  "Status",
  "Reviewed By",
  "Reviewed At",
  "Admin Notes",
  "Created At",
];

/**
 * Export a list of Work Progress Reports to a CSV file.
 * Admins get the full column set (staff name, review info); staff exports
 * naturally contain only their own rows since the list passed in is scoped.
 */
export function exportWorkProgressListAsCsv(reports: WorkProgressReport[], siteName = "PHOJAA95") {
  const lines: string[] = [];

  // Header row
  lines.push(HEADERS.map(csvCell).join(","));

  // Data rows
  for (const r of reports) {
    lines.push([
      r.reportNumber,
      r.staffName,
      r.project,
      r.feature,
      r.reportDate || "",
      statusLabel(r.status),
      r.reviewedByName || "",
      r.reviewedAt ? new Date(r.reviewedAt).toISOString() : "",
      r.adminNotes || "",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
    ].map(csvCell).join(","));
  }

  const safeName = siteName.replace(/[^\w-]+/g, "_").slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(lines.join("\n"), `${safeName}_WorkProgressReports_${stamp}.csv`, "text/csv;charset=utf-8");
}
