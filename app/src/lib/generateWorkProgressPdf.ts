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
  if (y + needed > 275) {
    doc.addPage();
    return 16;
  }
  return y;
}


function statusLabel(status: string): string {
  switch (status) {
    case "completed":   return "Completed";
    case "in_progress": return "In Progress";
    default:            return "Pending";
  }
}

function reportStatusColor(s: string): [number, number, number] {
  switch (s) {
    case "approved":   return COLORS.green;
    case "reviewed":   return COLORS.gold;
    case "submitted":  return COLORS.amber;
    default:           return COLORS.midGray;
  }
}

function safeArray<T>(val: any): T[] {
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

/** Robust logo loader: tries custom site logo, then standard site assets (/loader.png, /pwa-512x512.png) */
async function loadLogoImage(siteLogoUrl?: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
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

async function tryLoadImage(rawUrl: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
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
        resolve({ dataUrl, format: "PNG" });
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
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
          let format: "PNG" | "JPEG" | "WEBP" = "PNG";
          if (dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")) format = "JPEG";
          else if (dataUrl.includes("image/webp")) format = "WEBP";
          resolve({ dataUrl, format });
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
      // Elegant white container inside the dark navy header block
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(5, 7, 36, 30, 2, 2, "F");
      doc.setDrawColor(...COLORS.gold);
      doc.setLineWidth(0.4);
      doc.roundedRect(5, 7, 36, 30, 2, 2, "S");

      // Embed actual logo image
      doc.addImage(logoObj.dataUrl, logoObj.format, 7, 9, 32, 26, undefined, "FAST");
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

  // ── METADATA CARD GRID ────────────────────────────────────────────────
  const metaY = 24.5;
  const col1x = 52, col2x = 126;

  // Card background
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(50, metaY, CONTENT_W - 36, 16.5, 1.5, 1.5, "F");
  doc.setDrawColor(...COLORS.borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(50, metaY, CONTENT_W - 36, 16.5, 1.5, 1.5, "S");

  doc.setFontSize(8);

  // Left metadata column
  const leftMeta = [
    ["Project:", report.project],
    ["Feature:", report.feature],
    ["Report Date:", report.reportDate || "—"],
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
  doc.text("Status:", col2x, metaY + 8.2);
  const sColor = reportStatusColor(report.status);
  doc.setTextColor(...sColor);
  doc.setFont("helvetica", "bold");
  doc.text(report.status.charAt(0).toUpperCase() + report.status.slice(1), col2x + 22, metaY + 8.2);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.midGray);
  doc.text("Report No:", col2x, metaY + 12.4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textDark);
  doc.text(report.reportNumber, col2x + 22, metaY + 12.4);

  // Main divider line
  doc.setDrawColor(...COLORS.darkNavy);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 44, PAGE_W - MARGIN, 44);

  let y = 49;

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
      margin: { left: MARGIN, right: MARGIN },
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
    // Completed Header (Left)
    doc.setFillColor(...COLORS.green);
    doc.circle(col1X + 3.5, sectionStartY + 3, 2.5, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(col1X + 2.2, sectionStartY + 3, col1X + 3.1, sectionStartY + 3.9);
    doc.line(col1X + 3.1, sectionStartY + 3.9, col1X + 4.6, sectionStartY + 2.1);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.green);
    doc.text("Completed", col1X + 8, sectionStartY + 4);

    // In Progress Header (Right)
    doc.setDrawColor(...COLORS.darkNavy);
    doc.setFillColor(...COLORS.darkNavy);
    doc.setLineWidth(0.6);
    doc.circle(col2X + 3.5, sectionStartY + 3, 2.5, "S");
    doc.circle(col2X + 3.5, sectionStartY + 3, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.darkNavy);
    doc.text("In Progress", col2X + 8, sectionStartY + 4);

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

    const tableW = CONTENT_W * 0.72; // Left-aligned table as in reference image (~130mm)
    const col1W = tableW - 42;       // Phase column (~88mm)
    const startX = MARGIN;

    // Table Header Bar
    doc.setFillColor(...COLORS.darkNavy);
    doc.roundedRect(startX, y, tableW, 6.5, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.text("Phase", startX + 4, y + 4.3);
    doc.text("Target Completion", startX + col1W + 2, y + 4.3);

    y += 7.5;

    timeline.forEach((t, index) => {
      const phaseText = t.phase || "";
      const rawTarget = t.targetCompletion || "";
      const targetText = rawTarget.trim()
        ? rawTarget
        : statusLabel(t.status);

      const lines = doc.splitTextToSize(phaseText, col1W - 10);
      const rowHeight = Math.max(lines.length * 4.2 + 3, 6.5);

      y = checkPageBreak(doc, y, rowHeight);

      // Alternate row background
      if (index % 2 === 1) {
        doc.setFillColor(...COLORS.lightGray);
        doc.rect(startX, y - 1, tableW, rowHeight, "F");
      }

      // Draw Vector Status Icon & Text
      const iconX = startX + 2.5;
      const iconY = y + 2.2;

      if (t.status === "completed") {
        // Green Check Circle
        doc.setFillColor(...COLORS.green);
        doc.circle(iconX + 1.5, iconY, 2.2, "F");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.line(iconX + 0.6, iconY, iconX + 1.3, iconY + 0.7);
        doc.line(iconX + 1.3, iconY + 0.7, iconX + 2.5, iconY - 0.8);

        // Phase text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.textDark);
        doc.text(lines, startX + 8, y + 2.8);

        // Target completion
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.green);
        doc.text(targetText, startX + col1W + 2, y + 2.8);

      } else if (t.status === "in_progress") {
        // In Progress Circle Icon
        doc.setDrawColor(...COLORS.amber);
        doc.setFillColor(...COLORS.amber);
        doc.setLineWidth(0.5);
        doc.circle(iconX + 1.5, iconY, 2.2, "S");
        doc.circle(iconX + 1.5, iconY, 0.9, "F");

        // Phase text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.textDark);
        doc.text(lines, startX + 8, y + 2.8);

        // Target completion
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.amber);
        doc.text(targetText, startX + col1W + 2, y + 2.8);

      } else {
        // Pending Info Circle Icon
        doc.setDrawColor(...COLORS.midGray);
        doc.setFillColor(...COLORS.midGray);
        doc.setLineWidth(0.5);
        doc.circle(iconX + 1.5, iconY, 2.2, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.text("i", iconX + 1.5, iconY + 0.7, { align: "center" });

        // Phase text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.textDark);
        doc.text(lines, startX + 8, y + 2.8);

        // Target completion
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.midGray);
        doc.text(targetText, startX + col1W + 2, y + 2.8);
      }

      y += rowHeight;
    });

    y += 4;
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

  // ── FOOTER ────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.height;

    // Golden accent border line above footer
    doc.setFillColor(...COLORS.gold);
    doc.rect(0, pageH - 12.5, PAGE_W, 0.5, "F");

    // Dark navy footer bar
    doc.setFillColor(...COLORS.darkNavy);
    doc.rect(0, pageH - 12, PAGE_W, 12, "F");

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`${siteName} — Official Work Progress Report (${report.reportNumber})`, MARGIN, pageH - 5);
    doc.text(
      `Page ${i} of ${totalPages}  |  Generated: ${new Date().toLocaleDateString()}`,
      PAGE_W - MARGIN,
      pageH - 5,
      { align: "right" }
    );
  }

  // ── SAVE ─────────────────────────────────────────────────────────────
  const safeProject = report.project.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  doc.save(`${report.reportNumber}_${safeProject}.pdf`);
}

/** Fallback brand seal when image logo isn't provided */
function drawDefaultLogoSeal(doc: jsPDF, siteName: string) {
  doc.setFillColor(...COLORS.gold);
  doc.circle(23, 22, 13, "F");

  doc.setFillColor(...COLORS.darkNavy);
  doc.circle(23, 22, 11, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");

  const cleanName = siteName.toUpperCase().slice(0, 14);
  const logoLines = [cleanName, "OFFICIAL REPORT", "EXCELLENCE"];
  logoLines.forEach((line, i) => {
    doc.text(line, 23, 18 + i * 3.5, { align: "center" });
  });
}
