/**
 * Billing export builders — one styled PDF + one styled Excel workbook for the
 * Billing page's "export all data" buttons.
 *
 * Both formats share the same branding (site name + logo from system settings),
 * the same header block (generated-on / record count / filters) and the same
 * KPI summary strip (total sales value, payments received, outstanding balance,
 * total commission) so an exported report always carries the grand totals.
 */
import fs from "fs";
import path from "path";
import { inArray } from "drizzle-orm";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { Border, FillPattern } from "exceljs";
import { pdfMoney, pdfText } from "@contracts/pdf-text";
import { systemSettings } from "@db/schema";
import { getDb } from "../queries/connection";
import { getUploadSearchDirs } from "./paths";
import { logger } from "./logger";

// ─── Shared shapes ─────────────────────────────────────────────────────────

export interface BillingExportRow {
  id: number;
  invoiceNo: string;
  propertyName: string;
  ownerName: string;
  buyerName: string;
  propertyType: string;
  listedBy: string;
  status: string;
  sellingPrice: string;
  finalSellingPrice: string;
  totalPaid: string;
  balanceDue: string;
  commission: string;
  netToSeller: string;
  percentPaid: number;
  createdAt: string;
  completedAt: string;
}

export interface BillingExportTotals {
  /** Effective sale value: finalSellingPrice when set, else sellingPrice. */
  sales: number;
  paid: number;
  due: number;
  commission: number;
  net: number;
}

export interface BillingExportMeta {
  siteName: string;
  logoDataUrl: string | null;
  generatedOn: string;
  recordCount: number;
  filters: string[];
}

// ─── Branding (site name + logo) ───────────────────────────────────────────

const DEFAULT_SITE_NAME = "PHOJAA95";

/** PNG/JPEG only — jsPDF and ExcelJS can embed those natively. */
function sniffImageMime(buf: Buffer): "png" | "jpeg" | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  return null;
}

/** Logo uploaded through Settings lands in the shared upload directory. */
function readLocalLogo(logo: string): Buffer | null {
  const normalized = logo
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/^uploads\//i, "");
  if (!normalized || normalized.includes("..")) return null;

  for (const dir of getUploadSearchDirs()) {
    const candidate = path.join(dir, normalized);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return fs.readFileSync(candidate);
    } catch {
      // keep searching the other upload roots
    }
  }
  return null;
}

/** Resolved logo cache — avoids re-downloading the banner PNG on every export. */
let logoCache: { key: string; dataUrl: string | null; expiresAt: number } | null = null;
const LOGO_CACHE_TTL_MS = 10 * 60 * 1000;

/** Resolve the `site_logo` setting into a PNG/JPEG data URL, or null. */
export async function resolveExportLogo(logo?: string | null): Promise<string | null> {
  const key = (logo || "").trim();
  if (!key) return null;
  if (logoCache && logoCache.key === key && Date.now() < logoCache.expiresAt) {
    return logoCache.dataUrl;
  }
  const dataUrl = await resolveExportLogoUncached(key);
  logoCache = { key, dataUrl, expiresAt: Date.now() + LOGO_CACHE_TTL_MS };
  return dataUrl;
}

async function resolveExportLogoUncached(raw: string): Promise<string | null> {
  if (!raw) return null;

  // Already a data URL (some admins paste base64 straight into settings).
  if (raw.startsWith("data:")) {
    const match = /^data:image\/(png|jpe?g);base64,/i.exec(raw);
    return match ? raw : null;
  }

  let buf: Buffer | null = null;
  if (/^https?:\/\//i.test(raw)) {
    // Cloudinary-style URLs may use /f_auto/ — jsPDF cannot decode webp, so
    // force JPEG conversion the same way the client-side helper does.
    let url = raw.replace(/\/f_auto(?=\/,)/g, "/f_jpg");
    // The logo is drawn at ~16mm — request a small rendition instead of the
    // full-size upload (a 300KB+ banner PNG bloats every exported file).
    url = url.replace(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/i, "$1c_limit,w_240/");
    try {
      // First fetch can take several seconds (DNS + TLS + 300KB+ banner).
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) buf = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      logger.warn("Billing export: could not fetch site logo", { error: String(err) });
    }
  } else {
    buf = readLocalLogo(raw);
  }

  if (!buf || buf.length === 0) return null;
  const mime = sniffImageMime(buf);
  if (!mime) return null;
  return `data:image/${mime};base64,${buf.toString("base64")}`;
}

export async function getExportBranding(): Promise<{ siteName: string; logoDataUrl: string | null }> {
  let siteName = DEFAULT_SITE_NAME;
  let logo: string | null = null;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, ["site_name", "site_logo"]));
    for (const row of rows) {
      if (row.key === "site_name" && row.value) siteName = row.value;
      if (row.key === "site_logo" && row.value) logo = row.value;
    }
  } catch (err) {
    logger.warn("Billing export: falling back to default branding", { error: String(err) });
  }
  const logoDataUrl = await resolveExportLogo(logo);
  return { siteName, logoDataUrl };
}

// ─── Shared palette ────────────────────────────────────────────────────────

type RGB = [number, number, number];

const C = {
  ink: [15, 23, 42] as RGB,
  body: [51, 65, 85] as RGB,
  muted: [100, 116, 139] as RGB,
  faint: [148, 163, 184] as RGB,
  line: [226, 232, 240] as RGB,
  soft: [248, 250, 252] as RGB,
  primary: [79, 70, 229] as RGB,
  green: [5, 150, 105] as RGB,
  amber: [217, 119, 6] as RGB,
  violet: [124, 58, 237] as RGB,
  white: [255, 255, 255] as RGB,
};

const money = (value: number) => `Nu. ${pdfMoney(String(value))}`;

// ─── PDF ───────────────────────────────────────────────────────────────────

const PDF_STATUS_LABELS: Record<string, string> = {
  pending: "Payment Pending",
  partial: "Partially Paid",
  paid: "Fully Paid",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  approved: "Approved",
  rejected: "Rejected",
};

export function buildBillingPdfBase64(
  rows: BillingExportRow[],
  totals: BillingExportTotals,
  meta: BillingExportMeta
): string {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;

  /* Brand band */
  doc.setFillColor(...C.ink);
  doc.rect(0, 0, W, 7, "F");
  doc.setFillColor(...C.primary);
  doc.rect(0, 7, W, 1.4, "F");

  /* Logo + titles */
  let textX = M;
  if (meta.logoDataUrl) {
    try {
      const fmt = /^data:image\/jpe?g/i.test(meta.logoDataUrl) ? "JPEG" : "PNG";
      doc.addImage(meta.logoDataUrl, fmt, M, 11.5, 16, 16, undefined, "FAST");
      textX = M + 21;
    } catch {
      textX = M; // a broken logo must never break the export
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.primary);
  doc.text(pdfText(meta.siteName).toUpperCase(), textX, 15.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...C.ink);
  doc.text(pdfText("Billing & Invoices Report"), textX, 22.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text(
    pdfText(`Generated on ${meta.generatedOn}   |   ${meta.recordCount} records   |   All amounts in Ngultrum (Nu.)`),
    textX,
    27.5
  );

  let tableStartY = 33;
  if (meta.filters.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(...C.faint);
    doc.text(pdfText(`Filters: ${meta.filters.join("   |   ")}`), textX, 31.5);
    tableStartY = 37;
  }

  /* KPI summary strip — the grand totals the dashboard shows */
  const kpiY = tableStartY;
  const cardH = 20;
  const gap = 5;
  const usable = W - 2 * M;
  const cardW = (usable - 3 * gap) / 4;
  const kpis: Array<{ label: string; value: number; color: RGB }> = [
    { label: "TOTAL SALES VALUE", value: totals.sales, color: C.primary },
    { label: "PAYMENTS RECEIVED", value: totals.paid, color: C.green },
    { label: "OUTSTANDING BALANCE", value: totals.due, color: C.amber },
    { label: "TOTAL COMMISSION", value: totals.commission, color: C.violet },
  ];

  kpis.forEach((kpi, i) => {
    const x = M + i * (cardW + gap);
    doc.setFillColor(...C.soft);
    doc.rect(x, kpiY, cardW, cardH, "F");
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.rect(x, kpiY, cardW, cardH, "S");
    doc.setFillColor(...kpi.color);
    doc.rect(x, kpiY, 1.6, cardH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(kpi.label, x + 5, kpiY + 7);

    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    const value = money(kpi.value);
    // Shrink once instead of overflowing the card on very large amounts.
    if (doc.getTextWidth(value) > cardW - 9) doc.setFontSize(8.5);
    doc.text(value, x + 5, kpiY + 15.5);
  });

  /* Records table */
  // The footer must total the columns exactly as printed (raw selling price,
  // not the effective sales figure used by the KPI strip above).
  const sumCol = (key: keyof BillingExportRow) =>
    rows.reduce((acc, row) => acc + (parseFloat(String(row[key])) || 0), 0);

  autoTable(doc, {
    startY: kpiY + cardH + 7,
    head: [
      [
        "Invoice #",
        "Property",
        "Owner",
        "Buyer",
        "Status",
        "Selling Price",
        "Total Paid",
        "Balance Due",
        "Commission",
        "Net to Seller",
      ],
    ],
    body: rows.map((row) => [
      pdfText(row.invoiceNo),
      pdfText(row.propertyName) || "-",
      pdfText(row.ownerName) || "-",
      pdfText(row.buyerName) || "-",
      pdfText(PDF_STATUS_LABELS[row.status] ?? row.status),
      pdfMoney(row.sellingPrice),
      pdfMoney(row.totalPaid),
      pdfMoney(row.balanceDue),
      pdfMoney(row.commission),
      pdfMoney(row.netToSeller),
    ]),
    foot: [
      [
        "",
        "TOTAL",
        "",
        "",
        `${rows.length} rows`,
        pdfMoney(String(sumCol("sellingPrice"))),
        pdfMoney(String(sumCol("totalPaid"))),
        pdfMoney(String(sumCol("balanceDue"))),
        pdfMoney(String(sumCol("commission"))),
        pdfMoney(String(sumCol("netToSeller"))),
      ],
    ],
    showFoot: "everyPage",
    theme: "striped",
    headStyles: {
      fillColor: C.ink,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 2.2,
    },
    footStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: C.body,
      cellPadding: 1.9,
    },
    alternateRowStyles: { fillColor: C.soft },
    styles: {
      overflow: "linebreak",
      lineColor: C.line,
      lineWidth: 0.1,
      font: "helvetica",
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: "auto" },
      4: { cellWidth: 26 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
    margin: { left: M, right: M, bottom: 16 },
    didDrawPage: () => {
      const y = H - 6;
      doc.setDrawColor(...C.line);
      doc.setLineWidth(0.2);
      doc.line(M, y - 4.5, W - M, y - 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.faint);
      doc.text(pdfText(`${meta.siteName}  |  Billing & Invoices Report`), M, y);
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, W / 2, y, { align: "center" });
      doc.text(pdfText(meta.generatedOn), W - M, y, { align: "right" });
    },
  });

  return Buffer.from(doc.output("arraybuffer")).toString("base64");
}

// ─── Excel ─────────────────────────────────────────────────────────────────

interface ExcelColumn {
  key: keyof BillingExportRow;
  label: string;
  width: number;
  money?: boolean;
  center?: boolean;
}

const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: "invoiceNo", label: "Invoice #", width: 14 },
  { key: "propertyName", label: "Property", width: 34 },
  { key: "ownerName", label: "Owner", width: 24 },
  { key: "buyerName", label: "Buyer", width: 24 },
  { key: "propertyType", label: "Type", width: 16 },
  { key: "listedBy", label: "Listed By", width: 20 },
  { key: "status", label: "Status", width: 16, center: true },
  { key: "sellingPrice", label: "Selling Price", width: 16, money: true },
  { key: "finalSellingPrice", label: "Final Price", width: 16, money: true },
  { key: "totalPaid", label: "Total Paid", width: 15, money: true },
  { key: "balanceDue", label: "Balance Due", width: 15, money: true },
  { key: "commission", label: "Commission", width: 14, money: true },
  { key: "netToSeller", label: "Net to Seller", width: 15, money: true },
  { key: "percentPaid", label: "% Paid", width: 9, center: true },
  { key: "createdAt", label: "Listed On", width: 13, center: true },
  { key: "completedAt", label: "Completed On", width: 15, center: true },
];

const colLetter = (n: number) => String.fromCharCode(64 + n);

const ARG = {
  white: "FFFFFFFF",
  banner: "FF4F46E5",
  bannerAlt: "FF6366F1",
  header: "FF0F172A",
  label: "FF64748B",
  value: "FF334155",
  band: "FFF8FAFC",
  bandStrong: "FFF1F5F9",
  hair: "FFE2E8F0",
};

const solid = (argb: string): FillPattern => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = (argb: string = ARG.hair): Border => ({ style: "thin", color: { argb } });

export async function buildBillingExcelBase64(
  rows: BillingExportRow[],
  totals: BillingExportTotals,
  meta: BillingExportMeta
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Billing", {
    // Title, KPI strip and column headers all stay visible while scrolling.
    views: [{ state: "frozen", ySplit: 7, xSplit: 1, activeCell: "A8" }],
    properties: { defaultRowHeight: 18 },
  });

  ws.columns = EXCEL_COLUMNS.map((c) => ({ width: c.width }));

  const lastCol = EXCEL_COLUMNS.length;
  const lastLetter = colLetter(lastCol);
  const headerRow = 7;
  const firstDataRow = headerRow + 1;
  const numFmt = '"Nu." #,##0.00';

  /* Row 1 — brand banner */
  ws.mergeCells(`A1:${lastLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = meta.siteName;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: ARG.white } };
  titleCell.fill = solid(ARG.banner);
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 7 };
  ws.getRow(1).height = 34;

  /* Row 2 — report subtitle */
  ws.mergeCells(`A2:${lastLetter}2`);
  const subtitleCell = ws.getCell("A2");
  const filterText = meta.filters.length > 0 ? `  ·  ${meta.filters.join("  ·  ")}` : "";
  subtitleCell.value = `Billing & Invoices Report  ·  Generated ${meta.generatedOn}  ·  ${meta.recordCount} records${filterText}`;
  subtitleCell.font = { name: "Calibri", size: 10, color: { argb: ARG.white } };
  subtitleCell.fill = solid(ARG.bannerAlt);
  subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 7 };
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 6;

  /* Rows 4-5 — KPI summary (grand totals) */
  const kpis: Array<{ label: string; value: number; color: string }> = [
    { label: "TOTAL SALES VALUE", value: totals.sales, color: "FF4F46E5" },
    { label: "PAYMENTS RECEIVED", value: totals.paid, color: "FF059669" },
    { label: "OUTSTANDING BALANCE", value: totals.due, color: "FFD97706" },
    { label: "TOTAL COMMISSION", value: totals.commission, color: "FF7C3AED" },
  ];
  const span = lastCol / kpis.length;
  kpis.forEach((kpi, i) => {
    const from = i * span + 1;
    const to = from + span - 1;
    ws.mergeCells(4, from, 4, to);
    ws.mergeCells(5, from, 5, to);

    const labelCell = ws.getCell(4, from);
    labelCell.value = kpi.label;
    labelCell.font = { size: 9, bold: true, color: { argb: ARG.label } };
    labelCell.fill = solid(ARG.bandStrong);
    labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    const valueCell = ws.getCell(5, from);
    valueCell.value = kpi.value;
    valueCell.numFmt = numFmt;
    valueCell.font = { size: 14, bold: true, color: { argb: kpi.color } };
    valueCell.fill = solid(ARG.band);
    valueCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    for (let c = from; c <= to; c++) {
      ws.getCell(4, c).border = { top: thin(), left: thin(), right: thin() };
      ws.getCell(5, c).border = { bottom: thin(), left: thin(), right: thin() };
    }
  });
  ws.getRow(4).height = 16;
  ws.getRow(5).height = 25;
  ws.getRow(6).height = 8;

  /* Row 7 — table header */
  const header = ws.getRow(headerRow);
  header.height = 22;
  EXCEL_COLUMNS.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = col.label;
    cell.font = { size: 10, bold: true, color: { argb: ARG.white } };
    cell.fill = solid(ARG.header);
    cell.alignment = {
      horizontal: col.center ? "center" : "left",
      vertical: "middle",
      wrapText: true,
      indent: col.center ? 0 : 1,
    };
    cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
  });

  /* Data rows */
  rows.forEach((row, idx) => {
    const r = ws.getRow(firstDataRow + idx);
    r.height = 18;
    EXCEL_COLUMNS.forEach((col, i) => {
      const cell = r.getCell(i + 1);
      const raw = row[col.key];

      if (col.money) {
        cell.value = parseFloat(String(raw)) || 0;
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (col.key === "percentPaid") {
        cell.value = Number(raw) || 0;
        cell.numFmt = '0"%"';
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.value = String(raw ?? "");
        cell.alignment = {
          horizontal: col.center ? "center" : "left",
          vertical: "middle",
          indent: col.center ? 0 : 1,
        };
      }

      cell.font = { size: 10, color: { argb: ARG.value } };
      if (idx % 2 === 1) cell.fill = solid(ARG.band);
      cell.border = { bottom: thin() };
    });
  });

  /* Totals row — grand sums for every money column */
  const totalsRowIndex = firstDataRow + rows.length;
  const sumOf = (key: keyof BillingExportRow) =>
    rows.reduce((acc, row) => acc + (parseFloat(String(row[key])) || 0), 0);

  const totalsRow = ws.getRow(totalsRowIndex);
  totalsRow.height = 22;
  ws.mergeCells(totalsRowIndex, 1, totalsRowIndex, 6);

  EXCEL_COLUMNS.forEach((col, i) => {
    const cell = totalsRow.getCell(i + 1);
    if (i === 0) {
      cell.value = `TOTAL  (${rows.length} records)`;
      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    } else if (col.money) {
      cell.value = col.key === "netToSeller" ? totals.net : sumOf(col.key);
      cell.numFmt = "#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
    cell.font = { size: 10, bold: true, color: { argb: ARG.white } };
    cell.fill = solid(ARG.header);
    cell.border = { top: thin(ARG.header), bottom: thin(ARG.header), left: thin(ARG.header), right: thin(ARG.header) };
  });

  /* Filter over the data (header row only — the totals row stays put) */
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + rows.length, column: lastCol },
  };

  /* Logo in the banner, when one exists */
  if (meta.logoDataUrl) {
    try {
      const match = /^data:image\/(png|jpe?g);base64,([^,]+)/i.exec(meta.logoDataUrl);
      if (match) {
        const imageId = wb.addImage({
          base64: match[2],
          extension: match[1].toLowerCase() === "png" ? "png" : "jpeg",
        });
        ws.addImage(imageId, {
          tl: { col: 0.08, row: 0.1 },
          ext: { width: 44, height: 44 },
          editAs: "oneCell",
        });
      }
    } catch (err) {
      logger.warn("Billing export: could not embed logo in Excel", { error: String(err) });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer).toString("base64");
}
