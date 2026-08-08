import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { WorkProgressReport } from "@db/schema";

// ─── Color Palette (matching PHOJAA95 brand) ──────────────────────────
const COLORS = {
  darkNavy: [26, 35, 60] as [number, number, number],
  gold: [183, 148, 56] as [number, number, number],
  lightGold: [243, 232, 195] as [number, number, number],
  green: [34, 139, 34] as [number, number, number],
  lightGray: [248, 250, 252] as [number, number, number],
  midGray: [120, 130, 145] as [number, number, number],
  borderGray: [226, 232, 240] as [number, number, number],
  textDark: [30, 35, 45] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
};

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Set at the start of generateWorkProgressPdf so checkPageBreak can draw
// continuation-page headers without needing siteName/reportNumber passed
// into every single call site.
let _pdfSiteName = "";
let _pdfReportNumber = "";

function addSection(doc: jsPDF, title: string, y: number): number {
  // Section heading pill with gold left-accent bar
  doc.setFillColor(...COLORS.gold);
  doc.rect(MARGIN, y, 3, 7.5, "F");

  doc.setFillColor(...COLORS.darkNavy);
  doc.roundedRect(MARGIN + 3, y, CONTENT_W - 3, 7.5, 1, 1, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN + 7, y + 5.2);
  doc.setTextColor(...COLORS.textDark);
  return y + 11;
}

function checkPageBreak(doc: jsPDF, y: number, needed = 20): number {
  // Page height for A4 portrait = 297mm; footer occupies ~13mm at the bottom
  if (y + needed > 280) {
    doc.addPage();
    // ── Continuation page header (matches page-1 styling) ──────────────
    drawContinuationHeader(doc, _pdfSiteName, _pdfReportNumber);
    return 24; // start below the continuation header
  }
  return y;
}

/** Slim header on every continuation page so content doesn't float naked */
function drawContinuationHeader(doc: jsPDF, siteName: string, reportNumber: string) {
  // Top gold accent bar (same as page 1)
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 0, PAGE_W, 2.5, "F");

  // Thin navy strip
  doc.setFillColor(...COLORS.darkNavy);
  doc.rect(0, 2.5, PAGE_W, 12, "F");

  // Left: company name
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(siteName.toUpperCase(), MARGIN, 9.5);

  // Right: report number
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(200, 205, 215);
  doc.text(`Work Progress Report — ${reportNumber}`, PAGE_W - MARGIN, 9.5, { align: "right" });

  // Thin gold underline below the strip
  doc.setFillColor(...COLORS.gold);
  doc.rect(MARGIN, 15.5, CONTENT_W, 0.4, "F");
}


function reportStatusColor(s: string): [number, number, number] {
  switch (s) {
    case "approved":   return COLORS.green;
    case "reviewed":   return COLORS.gold;
    case "submitted":  return COLORS.amber;
    default:           return COLORS.midGray;
  }
}

/** Normalize JSON/array columns that may arrive as a string or null. Exported for reuse. */
export function safeArray<T>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

type LogoImage = {
  dataUrl: string;
  format: "PNG" | "JPEG" | "WEBP";
  width: number;
  height: number;
};

/** Robust logo loader: tries custom site logo, then standard site assets (/loader.png, /pwa-512x512.png) */
async function loadLogoImage(siteLogoUrl?: string): Promise<LogoImage | null> {
  const candidates: string[] = [];

  if (siteLogoUrl && typeof siteLogoUrl === "string" && siteLogoUrl.trim()) {
    candidates.push(siteLogoUrl.trim());
  }

  // Standard fallback assets from /public
  candidates.push("/loader.png");
  candidates.push("/pwa-512x512.png");
  candidates.push("/pwa-192x192.png");

  for (const candidate of candidates) {
    const loaded = await tryLoadImage(candidate);
    if (loaded) return loaded;
  }

  return null;
}

/** Get natural dimensions from a data URL (needed for aspect-ratio-correct placement) */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 100, height: img.naturalHeight || 100 });
    img.onerror = () => resolve({ width: 100, height: 100 });
    img.src = dataUrl;
  });
}

async function tryLoadImage(rawUrl: string): Promise<LogoImage | null> {
  if (!rawUrl) return null;

  let url = rawUrl.trim();
  if (url.startsWith("data:image/")) {
    let format: "PNG" | "JPEG" | "WEBP" = "PNG";
    if (url.includes("image/jpeg") || url.includes("image/jpg")) format = "JPEG";
    else if (url.includes("image/webp")) format = "WEBP";
    return { dataUrl: url, format };
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    if (!url.startsWith("/")) url = "/" + url;
    url = window.location.origin + url;
  }

  // Strategy 1: HTML Image Element + Canvas
  const canvasPromise = new Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 200;
        canvas.height = img.naturalHeight || img.height || 200;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ dataUrl, format: "PNG", width: img.naturalWidth || 100, height: img.naturalHeight || 100 });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  const canvasResult = await canvasPromise;
  if (canvasResult) return canvasResult;

  // Strategy 2: Fetch API + FileReader fallback
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
          let format: "PNG" | "JPEG" | "WEBP" = "PNG";
          if (dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")) format = "JPEG";
          else if (dataUrl.includes("image/webp")) format = "WEBP";
          const dims = await getImageDimensions(dataUrl);
          resolve({ dataUrl, format, width: dims.width, height: dims.height });
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateWorkProgressPdf(
  report: WorkProgressReport,
  siteName = "PHOJAA95",
  siteLogoUrl?: string
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Store for continuation-page headers
  _pdfSiteName = siteName;
  _pdfReportNumber = report.reportNumber;

  // Load logo (tries custom site logo first, then standard site assets)
  const logoObj = await loadLogoImage(siteLogoUrl);

  // ── TOP ACCENT BAR ───────────────────────────────────────────────────
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 0, PAGE_W, 3, "F");

  // ── HEADER AREA ──────────────────────────────────────────────────────
  // Left dark block for logo / emblem frame
  doc.setFillColor(...COLORS.darkNavy);
  doc.rect(0, 3, 46, 38, "F");

  if (logoObj) {
    try {
      // Elegant white container inside the dark navy header block with gold border
      const frameX = 5, frameY = 7, frameW = 36, frameH = 30;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(frameX, frameY, frameW, frameH, 2, 2, "F");
      doc.setDrawColor(...COLORS.gold);
      doc.setLineWidth(0.4);
      doc.roundedRect(frameX, frameY, frameW, frameH, 2, 2, "S");

      // ── Aspect-ratio-correct logo placement (contain mode) ──
      // Compute fit within a padded inner area so the logo is never stretched
      const pad = 3;
      const innerW = frameW - pad * 2;
      const innerH = frameH - pad * 2;
      const imgAspect = logoObj.width / logoObj.height;
      let imgW: number, imgH: number;
      if (imgAspect > innerW / innerH) {
        // Image is wider than frame — fit to width
        imgW = innerW;
        imgH = innerW / imgAspect;
      } else {
        // Image is taller than frame — fit to height
        imgH = innerH;
        imgW = innerH * imgAspect;
      }
      const imgX = frameX + (frameW - imgW) / 2;
      const imgY = frameY + (frameH - imgH) / 2;
      doc.addImage(logoObj.dataUrl, logoObj.format, imgX, imgY, imgW, imgH, undefined, "FAST");
    } catch {
      drawDefaultLogoSeal(doc, siteName);
    }
  } else {
    drawDefaultLogoSeal(doc, siteName);
  }

  // Title area
  doc.setTextColor(...COLORS.darkNavy);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("WORK PROGRESS REPORT", 52, 15);

  // Subtitle / Company name
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.midGray);
  doc.text(siteName.toUpperCase(), 52, 19.5);

  // Thin gold underline
  doc.setFillColor(...COLORS.gold);
  doc.rect(52, 21.5, CONTENT_W - 38, 0.6, "F");

  // ── STATUS BADGE PILL ──────────────────────────────────────────────
  const statusText = report.status.charAt(0).toUpperCase() + report.status.slice(1);
  const sColor = reportStatusColor(report.status);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const badgeW = doc.getTextWidth(statusText) + 8;
  const badgeX = PAGE_W - MARGIN - badgeW;
  doc.setFillColor(...sColor);
  doc.roundedRect(badgeX, 13, badgeW, 5.5, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, badgeX + 4, 16.7);

  // Report number next to badge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.midGray);
  doc.text(`Report No: ${report.reportNumber}`, 52, 25.5);

  // ── METADATA CARD GRID ────────────────────────────────────────────────
  const metaY = 28;
  const col1x = 52, col2x = 126;

  // Card background
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(50, metaY, CONTENT_W - 36, 12, 1.5, 1.5, "F");
  doc.setDrawColor(...COLORS.borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(50, metaY, CONTENT_W - 36, 12, 1.5, 1.5, "S");

  doc.setFontSize(8);

  // Left metadata column
  const leftMeta = [
    ["Project:", report.project],
    ["Feature:", report.feature],
  ];
  leftMeta.forEach(([label, val], i) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.midGray);
    doc.text(label, col1x, metaY + 4 + i * 4.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textDark);
    const truncVal = val.length > 30 ? val.slice(0, 30) + "..." : val;
    doc.text(truncVal, col1x + 19, metaY + 4 + i * 4.2);
  });

  // Right metadata column
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.midGray);
  doc.text("Prepared By:", col2x, metaY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textDark);
  doc.text(report.staffName, col2x + 22, metaY + 4);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.midGray);
  doc.text("Report Date:", col2x, metaY + 8.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textDark);
  doc.text(report.reportDate || "—", col2x + 22, metaY + 8.2);

  // Main divider line
  doc.setDrawColor(...COLORS.darkNavy);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 43, PAGE_W - MARGIN, 43);

  let y = 48;

  // ── SECTION 1: FEATURE OVERVIEW ───────────────────────────────────────
  y = addSection(doc, "1. FEATURE OVERVIEW", y);

  if (report.featureOverview) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.textDark);
    const lines = doc.splitTextToSize(report.featureOverview, CONTENT_W - 4);
    y = checkPageBreak(doc, y, lines.length * 5 + 6);
    doc.text(lines, MARGIN + 2, y);
    y += lines.length * 4.6 + 4;
  }

  // Objectives sub-section
  const objectives = safeArray<string>(report.objectives);
  if (objectives.length > 0) {
    y = checkPageBreak(doc, y, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.darkNavy);
    doc.text("Objectives", MARGIN + 2, y);
    y += 4.5;

    objectives.forEach((obj) => {
      y = checkPageBreak(doc, y, 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textDark);
      const wrapped = doc.splitTextToSize(`• ${obj}`, CONTENT_W - 8);
      doc.text(wrapped, MARGIN + 5, y);
      y += wrapped.length * 4.2 + 1;
    });
    y += 2;
  }

  // ── SECTION 2: SCOPE OF WORK ─────────────────────────────────────────
  const scopeItems = safeArray<{ module: string; description: string }>(report.scopeOfWork);
  if (scopeItems.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSection(doc, "2. SCOPE OF WORK", y);

    autoTable(doc, {
      startY: y,
      head: [["Module", "Description"]],
      body: scopeItems.map((s) => [s.module, s.description]),
      margin: { left: MARGIN, right: MARGIN, top: 24 },
      headStyles: {
        fillColor: COLORS.darkNavy,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.textDark,
      },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: "bold" },
        1: { cellWidth: CONTENT_W - 48 },
      },
      // Draw continuation header on every new page autoTable creates
      didDrawPage: () => {
        drawContinuationHeader(doc, _pdfSiteName, _pdfReportNumber);
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── SECTION 3: PROGRESS SUMMARY ──────────────────────────────────────
  const completed = safeArray<string>(report.completedItems);
  const inProgress = safeArray<string>(report.inProgressItems);

  if (completed.length > 0 || inProgress.length > 0) {
    y = checkPageBreak(doc, y, 25);
    y = addSection(doc, "3. PROGRESS SUMMARY", y);

    const colW = (CONTENT_W - 8) / 2;
    const col1X = MARGIN;
    const col2X = MARGIN + colW + 8;
    const sectionStartY = y;

    // --- Column Headers ---
    // Completed Header (Left) with count badge
    doc.setFillColor(...COLORS.green);
    doc.circle(col1X + 3.5, sectionStartY + 3, 2.5, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(col1X + 2.2, sectionStartY + 3, col1X + 3.1, sectionStartY + 3.9);
    doc.line(col1X + 3.1, sectionStartY + 3.9, col1X + 4.6, sectionStartY + 2.1);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.green);
    doc.text(`Completed (${completed.filter(i => i.trim()).length})`, col1X + 8, sectionStartY + 4);

    // In Progress Header (Right) with count badge
    doc.setDrawColor(...COLORS.darkNavy);
    doc.setFillColor(...COLORS.darkNavy);
    doc.setLineWidth(0.6);
    doc.circle(col2X + 3.5, sectionStartY + 3, 2.5, "S");
    doc.circle(col2X + 3.5, sectionStartY + 3, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.darkNavy);
    doc.text(`In Progress (${inProgress.filter(i => i.trim()).length})`, col2X + 8, sectionStartY + 4);

    let yCol1 = sectionStartY + 10;
    let yCol2 = sectionStartY + 10;

    // --- Column 1: Completed Items ---
    completed.forEach((item) => {
      if (!item.trim()) return;
      const lines = doc.splitTextToSize(item, colW - 7);
      const itemHeight = lines.length * 4.3 + 2.5;

      yCol1 = checkPageBreak(doc, yCol1, itemHeight);

      // Green vector checkmark
      doc.setDrawColor(...COLORS.green);
      doc.setLineWidth(0.6);
      doc.line(col1X + 0.8, yCol1 - 1.2, col1X + 2.0, yCol1 - 0.2);
      doc.line(col1X + 2.0, yCol1 - 0.2, col1X + 3.8, yCol1 - 2.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textDark);
      doc.text(lines, col1X + 6, yCol1 - 1);

      yCol1 += itemHeight;
    });

    // --- Column 2: In Progress Items ---
    inProgress.forEach((item) => {
      if (!item.trim()) return;
      const lines = doc.splitTextToSize(item, colW - 7);
      const itemHeight = lines.length * 4.3 + 2.5;

      yCol2 = checkPageBreak(doc, yCol2, itemHeight);

      // Solid bullet dot
      doc.setFillColor(...COLORS.textDark);
      doc.circle(col2X + 2, yCol2 - 1.5, 0.8, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textDark);
      doc.text(lines, col2X + 6, yCol2 - 1);

      yCol2 += itemHeight;
    });

    y = Math.max(yCol1, yCol2) + 4;
  }

  // ── SECTION 4: TIMELINE ───────────────────────────────────────────────
  const timeline = safeArray<{ phase: string; targetCompletion: string; status: string }>(report.timeline);
  if (timeline.length > 0) {
    y = checkPageBreak(doc, y, 25);
    y = addSection(doc, "4. TIMELINE", y);

    const statusLabelMap = (s: string): string => {
      switch (s) {
        case "completed":   return "Completed";
        case "in_progress": return "In Progress";
        default:            return "Pending";
      }
    };

    autoTable(doc, {
      startY: y,
      head: [["Phase", "Target Completion", "Status"]],
      body: timeline.map((t) => [
        t.phase || "—",
        t.targetCompletion?.trim() || "—",
        statusLabelMap(t.status),
      ]),
      margin: { left: MARGIN, right: MARGIN, top: 24 },
      headStyles: {
        fillColor: COLORS.darkNavy,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.textDark,
      },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: {
        0: { cellWidth: CONTENT_W * 0.5, fontStyle: "bold" },
        1: { cellWidth: CONTENT_W * 0.3 },
        2: { cellWidth: CONTENT_W * 0.2 },
      },
      // Color the Status column text by status value
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const row = timeline[data.row.index];
          if (row?.status === "completed") {
            data.cell.styles.textColor = COLORS.green;
            data.cell.styles.fontStyle = "bold";
          } else if (row?.status === "in_progress") {
            data.cell.styles.textColor = COLORS.amber;
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = COLORS.midGray;
          }
        }
      },
      // Draw continuation header on every new page autoTable creates
      didDrawPage: () => {
        drawContinuationHeader(doc, _pdfSiteName, _pdfReportNumber);
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── ADMIN NOTES ───────────────────────────────────────────────────────
  if (report.adminNotes) {
    y = checkPageBreak(doc, y, 20);
    doc.setFillColor(254, 249, 231);
    const noteLines = doc.splitTextToSize(report.adminNotes, CONTENT_W - 8);
    const noteHeight = noteLines.length * 4.8 + 10;
    doc.roundedRect(MARGIN, y, CONTENT_W, noteHeight, 2, 2, "F");
    doc.setDrawColor(...COLORS.gold);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, CONTENT_W, noteHeight, 2, 2, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.amber);
    doc.text("Admin Notes:", MARGIN + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textDark);
    doc.text(noteLines, MARGIN + 3, y + 10);
    y += noteHeight + 6;
  }

  // ── APPROVAL / SIGN-OFF BLOCK ─────────────────────────────────────────
  // Need room for the section header (~11mm) + the 22mm approval box = ~33mm,
  // plus a little buffer. If it doesn't fit, push the whole block to the next page
  // so the header and box stay together instead of splitting across pages.
  y = checkPageBreak(doc, y, 40);

  // Section header
  y = addSection(doc, "5. APPROVAL", y);

  const apprBoxH = 22;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(MARGIN, y, CONTENT_W, apprBoxH, 2, 2, "F");
  doc.setDrawColor(...COLORS.borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, apprBoxH, 2, 2, "S");

  // Left: Prepared By
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.midGray);
  doc.text("PREPARED BY", MARGIN + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textDark);
  doc.text(report.staffName, MARGIN + 4, y + 11);
  // Signature line
  doc.setDrawColor(...COLORS.midGray);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 4, y + 18, MARGIN + 4 + 70, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.midGray);
  doc.text("Signature", MARGIN + 4, y + 20.5);

  // Right: Reviewed/Approved By
  const rightX = MARGIN + CONTENT_W / 2 + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.midGray);
  const reviewLabel = report.status === "approved" ? "APPROVED BY" : report.status === "reviewed" ? "REVIEWED BY" : "REVIEWED BY";
  doc.text(reviewLabel, rightX, y + 6);

  if (report.reviewedByName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textDark);
    doc.text(report.reviewedByName, rightX, y + 11);
    if (report.reviewedAt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.midGray);
      doc.text(`Date: ${new Date(report.reviewedAt).toLocaleDateString()}`, rightX, y + 14.5);
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.midGray);
    doc.text("Pending review", rightX, y + 11);
  }
  // Signature line
  doc.setDrawColor(...COLORS.midGray);
  doc.setLineWidth(0.3);
  doc.line(rightX, y + 18, rightX + 70, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.midGray);
  doc.text("Signature", rightX, y + 20.5);

  y += apprBoxH + 6;

  // ── APPROVED WATERMARK ───────────────────────────────────────────────
  if (report.status === "approved") {
    doc.saveGraphicsState();
    doc.setTextColor(...COLORS.green);
    doc.setFillColor(...COLORS.green);
    // Semi-transparent diagonal watermark (simulated with light gray-green)
    doc.setGState((doc as any).GState({ opacity: 0.08 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(60);
    doc.text("APPROVED", PAGE_W / 2, 160, {
      align: "center",
      angle: 35,
    });
    doc.restoreGraphicsState();
  }

  // ── FOOTER ────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.height;

    // Golden accent border line above footer
    doc.setFillColor(...COLORS.gold);
    doc.rect(0, pageH - 13.5, PAGE_W, 0.5, "F");

    // Dark navy footer bar
    doc.setFillColor(...COLORS.darkNavy);
    doc.rect(0, pageH - 13, PAGE_W, 13, "F");

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`${siteName} — Official Work Progress Report (${report.reportNumber})`, MARGIN, pageH - 7);
    doc.text(
      `Page ${i} of ${totalPages}  |  Generated: ${new Date().toLocaleDateString()}`,
      PAGE_W - MARGIN,
      pageH - 7,
      { align: "right" }
    );
    // Confidentiality notice
    doc.setFontSize(5.5);
    doc.setTextColor(180, 185, 195);
    doc.text(
      "This document is confidential and intended solely for authorized personnel. Unauthorized distribution is prohibited.",
      MARGIN,
      pageH - 3
    );
  }

  // ── SAVE ─────────────────────────────────────────────────────────────
  const safeProject = report.project.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  doc.save(`${report.reportNumber}_${safeProject}.pdf`);
}

/** Fallback brand seal when image logo isn't provided */
function drawDefaultLogoSeal(doc: jsPDF, siteName: string) {
  // Outer gold ring
  doc.setFillColor(...COLORS.gold);
  doc.circle(23, 22, 14, "F");

  // Inner navy circle
  doc.setFillColor(...COLORS.darkNavy);
  doc.circle(23, 22, 12, "F");

  // Thin gold inner ring for elegance
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.3);
  doc.circle(23, 22, 10.5, "S");

  // Brand initials (first 2 chars of site name)
  const initials = siteName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2) || "PH";
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(initials, 23, 21, { align: "center" });

  // Subtitle
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(4.5);
  doc.setFont("helvetica", "normal");
  doc.text("OFFICIAL REPORT", 23, 26, { align: "center" });
}
