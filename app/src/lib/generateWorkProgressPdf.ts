import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { WorkProgressReport } from "@db/schema";

// ─── Executive Color Palette (PHOJAA95 Luxury Theme) ────────────────
const COLORS = {
  darkNavy:     [26, 35, 60]    as [number, number, number],
  navyHeader:   [18, 25, 45]    as [number, number, number],
  gold:         [183, 148, 56]  as [number, number, number],
  goldLight:    [243, 232, 195] as [number, number, number],
  goldAccent:   [212, 175, 55]  as [number, number, number],
  green:        [16, 122, 58]   as [number, number, number],
  greenBg:      [240, 253, 244] as [number, number, number],
  greenBorder:  [187, 247, 208] as [number, number, number],
  amber:        [217, 119, 6]   as [number, number, number],
  amberBg:      [255, 251, 235] as [number, number, number],
  amberBorder:  [253, 230, 138] as [number, number, number],
  slateBg:      [248, 250, 252] as [number, number, number],
  slateBorder:  [226, 232, 240] as [number, number, number],
  slateText:    [100, 116, 139] as [number, number, number],
  textDark:     [30, 41, 59]    as [number, number, number],
  textMuted:    [71, 85, 105]   as [number, number, number],
  white:        [255, 255, 255] as [number, number, number],
  blue:         [29, 78, 216]   as [number, number, number],
};

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addSection(doc: jsPDF, title: string, y: number): number {
  // Gold left accent bar
  doc.setFillColor(...COLORS.gold);
  doc.rect(MARGIN, y, 3, 8, "F");

  // Executive Navy header bar
  doc.setFillColor(...COLORS.darkNavy);
  doc.roundedRect(MARGIN + 3, y, CONTENT_W - 3, 8, 1, 1, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN + 8, y + 5.5);
  doc.setTextColor(...COLORS.textDark);
  return y + 12;
}

function checkPageBreak(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > 275) {
    doc.addPage();
    return 24; // Start content at y=24 on continuation pages
  }
  return y;
}

/** Slim continuation header rendered on Page 2+ in post-processing */
function drawContinuationHeader(doc: jsPDF, siteName: string, reportNumber: string) {
  // Top gold accent line
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 0, PAGE_W, 2.5, "F");

  // Navy strip
  doc.setFillColor(...COLORS.darkNavy);
  doc.rect(0, 2.5, PAGE_W, 12.5, "F");

  // Left: Brand
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(siteName.toUpperCase(), MARGIN, 10);

  // Right: Report metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(215, 222, 235);
  doc.text(`Work Progress Report — ${reportNumber}`, PAGE_W - MARGIN, 10, { align: "right" });

  // Gold underline
  doc.setFillColor(...COLORS.gold);
  doc.rect(MARGIN, 15, CONTENT_W, 0.5, "F");
}

function reportStatusColor(s: string): { bg: [number, number, number]; text: [number, number, number] } {
  switch (s) {
    case "approved":   return { bg: [220, 252, 231], text: COLORS.green };
    case "reviewed":   return { bg: [254, 243, 199], text: COLORS.gold };
    case "submitted":  return { bg: [254, 243, 199], text: COLORS.amber };
    default:           return { bg: [241, 245, 249], text: COLORS.slateText };
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

/** Robust logo loader: tries custom site logo, then standard site assets */
async function loadLogoImage(siteLogoUrl?: string): Promise<LogoImage | null> {
  const candidates: string[] = [];
  if (siteLogoUrl && typeof siteLogoUrl === "string" && siteLogoUrl.trim()) {
    candidates.push(siteLogoUrl.trim());
  }
  candidates.push("/loader.png");
  candidates.push("/pwa-512x512.png");
  candidates.push("/pwa-192x192.png");

  for (const candidate of candidates) {
    const loaded = await tryLoadImage(candidate);
    if (loaded) return loaded;
  }
  return null;
}

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
    const dims = await getImageDimensions(url);
    return { dataUrl: url, format, width: dims.width, height: dims.height };
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    if (!url.startsWith("/")) url = "/" + url;
    url = window.location.origin + url;
  }

  const canvasPromise = new Promise<LogoImage | null>((resolve) => {
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

// ─── MAIN PDF GENERATOR ───────────────────────────────────────────────
export async function generateWorkProgressPdf(
  report: WorkProgressReport,
  siteName = "PHOJAA95",
  siteLogoUrl?: string
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const logoObj = await loadLogoImage(siteLogoUrl);

  // ── TOP ACCENT BAR ───────────────────────────────────────────────────
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 0, PAGE_W, 3, "F");

  // ── HEADER AREA ──────────────────────────────────────────────────────
  // Left Dark Navy Logo Block (0..42mm)
  const headerBlockW = 42;
  const headerBlockH = 28;
  doc.setFillColor(...COLORS.navyHeader);
  doc.rect(0, 3, headerBlockW, headerBlockH, "F");

  if (logoObj) {
    try {
      // White rounded emblem frame with gold stroke
      const frameX = 4, frameY = 5, frameW = headerBlockW - 8, frameH = headerBlockH - 4;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(frameX, frameY, frameW, frameH, 2, 2, "F");
      doc.setDrawColor(...COLORS.gold);
      doc.setLineWidth(0.4);
      doc.roundedRect(frameX, frameY, frameW, frameH, 2, 2, "S");

      // Aspect-ratio-correct logo placement
      const pad = 3;
      const innerW = frameW - pad * 2;
      const innerH = frameH - pad * 2;
      const w = Math.max(logoObj.width, 1);
      const h = Math.max(logoObj.height, 1);
      const imgAspect = w / h;
      let imgW: number, imgH: number;
      if (imgAspect > innerW / innerH) {
        imgW = innerW;
        imgH = innerW / imgAspect;
      } else {
        imgH = innerH;
        imgW = innerH * imgAspect;
      }
      const imgX = frameX + (frameW - imgW) / 2;
      const imgY = frameY + (frameH - imgH) / 2;
      doc.addImage(logoObj.dataUrl, logoObj.format, imgX, imgY, imgW, imgH, undefined, "NONE");
    } catch {
      drawDefaultLogoSeal(doc, siteName);
    }
  } else {
    drawDefaultLogoSeal(doc, siteName);
  }

  // Right Header Info Block (starts at x=50mm)
  const titleX = 50;
  const infoW = PAGE_W - MARGIN - titleX;

  // Title: "WORK PROGRESS REPORT"
  doc.setTextColor(...COLORS.darkNavy);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("WORK PROGRESS REPORT", titleX, 12);

  // Subtitle / Company name
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.gold);
  doc.text(siteName.toUpperCase(), titleX, 16.5);

  // Status Badge Pill (Top-Right)
  const statusStr = report.status.charAt(0).toUpperCase() + report.status.slice(1);
  const st = reportStatusColor(report.status);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const badgeW = doc.getTextWidth(statusStr) + 8;
  const badgeX = PAGE_W - MARGIN - badgeW;
  const badgeY = 7.5;
  doc.setFillColor(...st.bg);
  doc.roundedRect(badgeX, badgeY, badgeW, 5.5, 1.5, 1.5, "F");
  doc.setDrawColor(...st.text);
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, badgeY, badgeW, 5.5, 1.5, 1.5, "S");
  doc.setTextColor(...st.text);
  doc.text(statusStr, badgeX + 4, badgeY + 4);

  // Gold horizontal line under title
  doc.setFillColor(...COLORS.gold);
  doc.rect(titleX, 18.5, infoW, 0.4, "F");

  // Executive Metadata Key-Value Box (starts at y=20mm)
  const metaBoxY = 20;
  const metaBoxH = 14;
  doc.setFillColor(...COLORS.slateBg);
  doc.roundedRect(titleX, metaBoxY, infoW, metaBoxH, 1.5, 1.5, "F");
  doc.setDrawColor(...COLORS.slateBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(titleX, metaBoxY, infoW, metaBoxH, 1.5, 1.5, "S");

  // Left accent line on metadata box
  doc.setFillColor(...COLORS.gold);
  doc.rect(titleX, metaBoxY, 1.5, metaBoxH, "F");

  // Grid Row 1: Report No & Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.slateText);
  doc.text("REPORT NO:", titleX + 4, metaBoxY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textDark);
  doc.text(report.reportNumber, titleX + 22, metaBoxY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.slateText);
  doc.text("DATE:", titleX + 85, metaBoxY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textDark);
  doc.text(report.reportDate || "—", titleX + 96, metaBoxY + 4.5);

  // Grid Row 2: Project & Feature
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.slateText);
  doc.text("PROJECT:", titleX + 4, metaBoxY + 9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.darkNavy);
  const projText = report.project.length > 34 ? report.project.slice(0, 34) + "..." : report.project;
  doc.text(projText, titleX + 22, metaBoxY + 9.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.slateText);
  doc.text("FEATURE:", titleX + 85, metaBoxY + 9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textDark);
  const featText = report.feature.length > 32 ? report.feature.slice(0, 32) + "..." : report.feature;
  doc.text(featText, titleX + 96, metaBoxY + 9.5);

  // Main divider line across content width
  doc.setDrawColor(...COLORS.darkNavy);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 37, PAGE_W - MARGIN, 37);

  let y = 41;

  // ── SECTION 1: FEATURE OVERVIEW ───────────────────────────────────────
  y = addSection(doc, "1. FEATURE OVERVIEW", y);

  if (report.featureOverview) {
    const lines = doc.splitTextToSize(report.featureOverview, CONTENT_W - 8);
    const ovHeight = lines.length * 4.4 + 6;

    y = checkPageBreak(doc, y, ovHeight);

    // Light overview card with left gold bar
    doc.setFillColor(...COLORS.slateBg);
    doc.roundedRect(MARGIN, y, CONTENT_W, ovHeight, 1.5, 1.5, "F");
    doc.setDrawColor(...COLORS.slateBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, ovHeight, 1.5, 1.5, "S");

    doc.setFillColor(...COLORS.gold);
    doc.rect(MARGIN, y, 1.5, ovHeight, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.textDark);
    doc.text(lines, MARGIN + 5, y + 4.8);
    y += ovHeight + 6;
  }

  // Objectives sub-section
  const objectives = safeArray<string>(report.objectives);
  if (objectives.length > 0) {
    y = checkPageBreak(doc, y, 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.darkNavy);
    doc.text("Key Objectives", MARGIN + 1, y);
    y += 5;

    objectives.forEach((obj) => {
      if (!obj.trim()) return;
      const wrapped = doc.splitTextToSize(obj, CONTENT_W - 10);
      const itemH = wrapped.length * 4.2 + 3;

      y = checkPageBreak(doc, y, itemH);

      // Gold accent bullet tag
      doc.setFillColor(...COLORS.gold);
      doc.circle(MARGIN + 3, y + 1.2, 1.2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textDark);
      doc.text(wrapped, MARGIN + 7, y + 2);
      y += itemH;
    });
    y += 4;
  }

  // ── SECTION 2: SCOPE OF WORK ─────────────────────────────────────────
  const scopeItems = safeArray<{ module: string; description: string }>(report.scopeOfWork);
  if (scopeItems.length > 0) {
    y = checkPageBreak(doc, y, 20);
    y = addSection(doc, "2. SCOPE OF WORK", y);

    autoTable(doc, {
      startY: y,
      head: [["Module / Component", "Scope Description"]],
      body: scopeItems.map((s) => [s.module, s.description]),
      margin: { left: MARGIN, right: MARGIN, top: 22, bottom: 18 },
      headStyles: {
        fillColor: COLORS.navyHeader,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: 3.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.textDark,
        cellPadding: 3,
      },
      alternateRowStyles: { fillColor: COLORS.slateBg },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: "bold", textColor: COLORS.darkNavy },
        1: { cellWidth: CONTENT_W - 52 },
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── SECTION 3: PROGRESS SUMMARY ──────────────────────────────────────
  const completed = safeArray<string>(report.completedItems);
  const inProgress = safeArray<string>(report.inProgressItems);

  if (completed.length > 0 || inProgress.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = addSection(doc, "3. PROGRESS SUMMARY", y);

    const colW = (CONTENT_W - 6) / 2;
    const col1X = MARGIN;
    const col2X = MARGIN + colW + 6;
    const sectionStartY = y;

    // --- Column Headers ---
    // Left: Completed Header Card
    const compCount = completed.filter(i => i.trim()).length;
    doc.setFillColor(...COLORS.greenBg);
    doc.roundedRect(col1X, sectionStartY, colW, 7, 1, 1, "F");
    doc.setDrawColor(...COLORS.greenBorder);
    doc.setLineWidth(0.4);
    doc.roundedRect(col1X, sectionStartY, colW, 7, 1, 1, "S");

    doc.setFillColor(...COLORS.green);
    doc.circle(col1X + 4, sectionStartY + 3.5, 2.2, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(col1X + 2.8, sectionStartY + 3.5, col1X + 3.6, sectionStartY + 4.3);
    doc.line(col1X + 3.6, sectionStartY + 4.3, col1X + 5.2, sectionStartY + 2.6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.green);
    doc.text(`Completed (${compCount})`, col1X + 8, sectionStartY + 4.8);

    // Right: In Progress Header Card
    const inpCount = inProgress.filter(i => i.trim()).length;
    doc.setFillColor(...COLORS.amberBg);
    doc.roundedRect(col2X, sectionStartY, colW, 7, 1, 1, "F");
    doc.setDrawColor(...COLORS.amberBorder);
    doc.setLineWidth(0.4);
    doc.roundedRect(col2X, sectionStartY, colW, 7, 1, 1, "S");

    doc.setDrawColor(...COLORS.amber);
    doc.setFillColor(...COLORS.amber);
    doc.setLineWidth(0.6);
    doc.circle(col2X + 4, sectionStartY + 3.5, 2.2, "S");
    doc.circle(col2X + 4, sectionStartY + 3.5, 0.9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.amber);
    doc.text(`In Progress (${inpCount})`, col2X + 8, sectionStartY + 4.8);

    let yCol1 = sectionStartY + 10;
    let yCol2 = sectionStartY + 10;
    let col1Page = doc.getCurrentPageInfo().pageNumber;
    let col2Page = doc.getCurrentPageInfo().pageNumber;

    // --- Column 1: Completed Items ---
    completed.forEach((item) => {
      if (!item.trim()) return;
      const lines = doc.splitTextToSize(item, colW - 7);
      const itemHeight = lines.length * 4.2 + 2.5;

      const prevPage = doc.getCurrentPageInfo().pageNumber;
      yCol1 = checkPageBreak(doc, yCol1, itemHeight);
      const newPage = doc.getCurrentPageInfo().pageNumber;
      if (newPage !== prevPage) {
        col1Page = newPage;
        yCol2 = yCol1;
        col2Page = newPage;
      }

      // Green vector checkmark
      doc.setDrawColor(...COLORS.green);
      doc.setLineWidth(0.6);
      doc.line(col1X + 1, yCol1 + 0.8, col1X + 2.2, yCol1 + 1.8);
      doc.line(col1X + 2.2, yCol1 + 1.8, col1X + 4, yCol1 - 0.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textDark);
      doc.text(lines, col1X + 6, yCol1 + 1.5);

      yCol1 += itemHeight;
    });

    // --- Column 2: In Progress Items ---
    if (col2Page !== col1Page) {
      doc.setPage(col1Page);
      yCol2 = sectionStartY + 10;
      col2Page = col1Page;
    }

    inProgress.forEach((item) => {
      if (!item.trim()) return;
      const lines = doc.splitTextToSize(item, colW - 7);
      const itemHeight = lines.length * 4.2 + 2.5;

      const prevPage = doc.getCurrentPageInfo().pageNumber;
      yCol2 = checkPageBreak(doc, yCol2, itemHeight);
      const newPage = doc.getCurrentPageInfo().pageNumber;
      if (newPage !== prevPage) {
        col2Page = newPage;
      }

      // Amber bullet dot
      doc.setFillColor(...COLORS.amber);
      doc.circle(col2X + 2.5, yCol2 + 0.5, 1, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textDark);
      doc.text(lines, col2X + 6, yCol2 + 1.5);

      yCol2 += itemHeight;
    });

    y = Math.max(yCol1, yCol2) + 6;
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
      head: [["Project Phase", "Target Completion", "Status"]],
      body: timeline.map((t) => [
        t.phase || "—",
        t.targetCompletion?.trim() || "—",
        statusLabelMap(t.status),
      ]),
      margin: { left: MARGIN, right: MARGIN, top: 22, bottom: 18 },
      headStyles: {
        fillColor: COLORS.navyHeader,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: 3.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.textDark,
        cellPadding: 3,
      },
      alternateRowStyles: { fillColor: COLORS.slateBg },
      columnStyles: {
        0: { cellWidth: CONTENT_W * 0.5, fontStyle: "bold", textColor: COLORS.darkNavy },
        1: { cellWidth: CONTENT_W * 0.28 },
        2: { cellWidth: CONTENT_W * 0.22, fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const row = timeline[data.row.index];
          if (row?.status === "completed") {
            data.cell.styles.textColor = COLORS.green;
          } else if (row?.status === "in_progress") {
            data.cell.styles.textColor = COLORS.amber;
          } else {
            data.cell.styles.textColor = COLORS.slateText;
          }
        }
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── ADMIN NOTES ───────────────────────────────────────────────────────
  if (report.adminNotes) {
    const noteLines = doc.splitTextToSize(report.adminNotes, CONTENT_W - 10);
    const noteHeight = noteLines.length * 4.5 + 14;

    y = checkPageBreak(doc, y, noteHeight + 4);

    doc.setFillColor(...COLORS.amberBg);
    doc.roundedRect(MARGIN, y, CONTENT_W, noteHeight, 1.5, 1.5, "F");
    doc.setDrawColor(...COLORS.amberBorder);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, CONTENT_W, noteHeight, 1.5, 1.5, "S");

    doc.setFillColor(...COLORS.amber);
    doc.rect(MARGIN, y, 1.5, noteHeight, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.amber);
    doc.text("Admin Review Feedback:", MARGIN + 5, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textDark);
    doc.text(noteLines, MARGIN + 5, y + 10.5);

    y += noteHeight + 6;
  }

  // ── APPROVAL / SIGN-OFF BLOCK ─────────────────────────────────────────
  y = checkPageBreak(doc, y, 32);

  y = addSection(doc, "5. APPROVAL & SIGN-OFF", y);

  const apprBoxH = 24;
  doc.setFillColor(...COLORS.slateBg);
  doc.roundedRect(MARGIN, y, CONTENT_W, apprBoxH, 1.5, 1.5, "F");
  doc.setDrawColor(...COLORS.slateBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, apprBoxH, 1.5, 1.5, "S");

  // Left Signature Block: Prepared By
  const leftX = MARGIN + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.slateText);
  doc.text("PREPARED BY (STAFF)", leftX, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.darkNavy);
  doc.text(report.staffName, leftX, y + 10.5);

  doc.setDrawColor(...COLORS.slateText);
  doc.setLineWidth(0.3);
  doc.line(leftX, y + 18.5, leftX + 72, y + 18.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.slateText);
  doc.text("Authorized Staff Signature", leftX, y + 21.5);

  // Right Signature Block: Reviewed/Approved By
  const rightX = MARGIN + CONTENT_W / 2 + 4;
  const reviewLabel = report.status === "approved" ? "APPROVED BY (ADMIN)" : "REVIEWED BY (ADMIN)";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.slateText);
  doc.text(reviewLabel, rightX, y + 5.5);

  if (report.reviewedByName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.darkNavy);
    doc.text(report.reviewedByName, rightX, y + 10.5);

    if (report.reviewedAt) {
      const reviewedDateStr = String(report.reviewedAt).split("T")[0];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.slateText);
      doc.text(`Date: ${reviewedDateStr}`, rightX + 45, y + 10.5);
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.slateText);
    doc.text("Pending Review", rightX, y + 10.5);
  }

  doc.setDrawColor(...COLORS.slateText);
  doc.setLineWidth(0.3);
  doc.line(rightX, y + 18.5, rightX + 72, y + 18.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.slateText);
  doc.text("Management Signature & Date", rightX, y + 21.5);

  y += apprBoxH + 6;

  // ── APPROVED WATERMARK ───────────────────────────────────────────────
  if (report.status === "approved") {
    doc.saveGraphicsState();
    doc.setTextColor(...COLORS.green);
    doc.setFillColor(...COLORS.green);
    doc.setGState((doc as any).GState({ opacity: 0.07 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(55);
    doc.text("APPROVED", PAGE_W / 2, 160, {
      align: "center",
      angle: 35,
    });
    doc.restoreGraphicsState();
  }

  // ── FOOTER & CONTINUATION HEADERS ────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.height;

    // Continuation Header (Page 2+)
    if (i > 1) {
      drawContinuationHeader(doc, siteName, report.reportNumber);
    }

    // Gold accent line above footer
    doc.setFillColor(...COLORS.gold);
    doc.rect(0, pageH - 13.5, PAGE_W, 0.5, "F");

    // Executive Navy Footer Bar
    doc.setFillColor(...COLORS.navyHeader);
    doc.rect(0, pageH - 13, PAGE_W, 13, "F");

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(`${siteName.toUpperCase()} — OFFICIAL WORK PROGRESS REPORT`, MARGIN, pageH - 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(215, 222, 235);
    doc.text(
      `Page ${i} of ${totalPages}  |  Generated: ${new Date().toLocaleDateString()}`,
      PAGE_W - MARGIN,
      pageH - 7.5,
      { align: "right" }
    );

    doc.setFontSize(5.5);
    doc.setTextColor(160, 175, 200);
    doc.text(
      "CONFIDENTIAL — Intended solely for authorized company personnel. Unauthorized distribution is prohibited.",
      MARGIN,
      pageH - 3.5
    );
  }

  // ── SAVE ─────────────────────────────────────────────────────────────
  const safeProject = report.project.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  doc.save(`${report.reportNumber}_${safeProject}.pdf`);
}

/** Fallback brand seal when image logo isn't provided */
function drawDefaultLogoSeal(doc: jsPDF, siteName: string) {
  const cx = 21, cy = 17;
  // Outer gold ring
  doc.setFillColor(...COLORS.gold);
  doc.circle(cx, cy, 11, "F");

  // Inner navy circle
  doc.setFillColor(...COLORS.navyHeader);
  doc.circle(cx, cy, 9, "F");

  // Gold accent inner stroke
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, 7.5, "S");

  // Initials
  const initials = siteName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2) || "PH";
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(initials, cx, cy + 1, { align: "center" });

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(3.5);
  doc.setFont("helvetica", "bold");
  doc.text("OFFICIAL", cx, cy + 5, { align: "center" });
}
