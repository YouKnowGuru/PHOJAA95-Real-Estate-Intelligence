import jsPDF from "jspdf";
import {
  normalizeSiteLogoUrl,
  resolveSiteLogoForCertificate,
  type SiteBranding,
} from "@/lib/site-branding";
import { formatDisplayDate } from "@/lib/format-date";

export type ArchCertificateRecord = {
  certificateNumber?: string | null;
  customerName?: string | null;
  projectName?: string | null;
  projectCategory?: string | null;
  projectLocation?: string | null;
  completionDate?: string | Date | null;
  staffName?: string | null;
  companyName?: string | null;
  verificationNumber?: string | null;
  validationUrl?: string | null;
  createdAt?: string | Date | null;
};

/** A4 landscape — 297 × 210 mm */
const PAGE = { w: 297, h: 210, pad: 8 } as const;

const PAL = {
  navy: "#0C2340",
  navyMid: "#1B4D6E",
  teal: "#2A6F97",
  gold: "#C5A028",
  goldLight: "#E8D48B",
  copper: "#B87333",
  parchment: "#F5F0E6",
  cream: "#FAF7F2",
  white: "#FFFFFF",
  ink: "#1C1917",
  inkMuted: "#57534E",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCertDate(value?: string | Date | null): string {
  return formatDisplayDate(value);
}

function buildLogoHtml(logoSrc: string | null | undefined, siteName: string, branding: SiteBranding): string {
  const resolvedLogo = logoSrc || normalizeSiteLogoUrl(branding.site_logo);
  if (resolvedLogo) {
    return `<div class="logo-wrap"><img src="${resolvedLogo.replace(/"/g, "&quot;")}" alt="${siteName}" class="logo-img" /></div>`;
  }
  const initial = (branding.site_name || "P").trim().charAt(0).toUpperCase() || "P";
  return `<div class="logo-wrap"><div class="logo-fallback">${escapeHtml(initial)}</div></div>`;
}

function buildCornerOrnament(position: "tl" | "tr" | "bl" | "br"): string {
  const rotate = { tl: "0", tr: "90", bl: "270", br: "180" }[position];
  return `
    <svg class="corner corner-${position}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="rotate(${rotate} 32 32)">
        <path d="M4 4 H44 V8 H8 V44 H4 Z" fill="${PAL.gold}"/>
        <path d="M8 8 H36 V12 H12 V36 H8 Z" fill="${PAL.teal}"/>
        <circle cx="14" cy="14" r="3" fill="${PAL.navy}"/>
        <path d="M20 8 L24 16 L16 16 Z" fill="${PAL.goldLight}"/>
      </g>
    </svg>`;
}

function buildMetaCards(cert: ArchCertificateRecord, siteName: string, issueDate: string): string {
  const cards: [string, string][] = [
    ["Project", cert.projectName || "—"],
    ["Category", cert.projectCategory || "—"],
    ["Location", cert.projectLocation || "—"],
    ["Lead Architect", cert.staffName || "—"],
    ["Completion Date", issueDate],
    ["Issued By", cert.companyName || siteName],
  ];

  return cards
    .map(
      ([label, value]) => `
        <div class="meta-card">
          <div class="meta-label">${escapeHtml(label)}</div>
          <div class="meta-value">${escapeHtml(value)}</div>
        </div>`
    )
    .join("");
}

export function buildArchitectureCertificateHtml(
  cert: ArchCertificateRecord,
  branding: SiteBranding,
  logoSrc?: string | null
): string {
  const siteName = escapeHtml(branding.site_name || "PHOJAA95 Real Estate");
  const tagline = escapeHtml(branding.site_tagline || "Architecture & Design Services");
  const issueDate = formatCertDate(cert.completionDate || cert.createdAt);
  const certNo = escapeHtml(cert.certificateNumber || "—");
  const verifyNo = escapeHtml(cert.verificationNumber || "—");
  const customerName = escapeHtml(cert.customerName || "—");
  const projectName = escapeHtml(cert.projectName || "—");
  const logoHtml = buildLogoHtml(logoSrc, siteName, branding);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Architecture Certificate — ${certNo}</title>
<style>
  @page { size: A4 landscape; margin: 0; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: ${PAGE.w}mm;
    height: ${PAGE.h}mm;
    overflow: hidden;
  }

  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: ${PAL.cream};
    color: ${PAL.ink};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .cert-page {
    width: ${PAGE.w}mm;
    height: ${PAGE.h}mm;
    max-height: ${PAGE.h}mm;
    padding: ${PAGE.pad}mm;
    background: ${PAL.parchment};
    position: relative;
    overflow: hidden;
    page-break-after: avoid;
    page-break-inside: avoid;
  }

  .cert-page::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 12% 18%, rgba(42,111,151,0.09) 0%, transparent 40%),
      radial-gradient(circle at 88% 82%, rgba(197,160,40,0.1) 0%, transparent 38%);
    pointer-events: none;
  }

  .cert-outer {
    position: relative;
    height: ${PAGE.h - PAGE.pad * 2}mm;
    max-height: ${PAGE.h - PAGE.pad * 2}mm;
    border: 3px solid ${PAL.gold};
    outline: 1px solid ${PAL.teal};
    background: ${PAL.white};
    box-shadow: inset 0 0 0 5px ${PAL.parchment}, inset 0 0 0 6px ${PAL.navy};
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .corner {
    position: absolute;
    width: 38px;
    height: 38px;
    opacity: 0.85;
    z-index: 1;
    pointer-events: none;
  }
  .corner-tl { top: 10px; left: 10px; }
  .corner-tr { top: 10px; right: 10px; }
  .corner-bl { bottom: 10px; left: 10px; }
  .corner-br { bottom: 10px; right: 10px; }

  .cert-weave {
    height: 7px;
    flex-shrink: 0;
    background: repeating-linear-gradient(
      90deg,
      ${PAL.navy} 0 12px,
      ${PAL.gold} 12px 24px,
      ${PAL.teal} 24px 36px,
      ${PAL.goldLight} 36px 48px
    );
  }

  .cert-inner {
    position: relative;
    z-index: 2;
    flex: 1;
    padding: 12px 34px 12px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .main-content {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .header-band {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 52px;
    margin: -12px -34px 10px;
    background: linear-gradient(135deg, ${PAL.navy} 0%, ${PAL.navyMid} 45%, ${PAL.teal} 100%);
    color: ${PAL.white};
    border-bottom: 3px solid ${PAL.gold};
    flex-shrink: 0;
    position: relative;
    z-index: 3;
  }

  .brand-block {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .logo-wrap {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-img {
    width: 44px;
    height: 44px;
    max-width: 44px;
    max-height: 44px;
    object-fit: contain;
    border-radius: 8px;
    background: rgba(255,255,255,0.96);
    padding: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    display: block;
  }

  .logo-fallback {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: linear-gradient(145deg, ${PAL.gold}, ${PAL.teal});
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${PAL.white};
    font-weight: 800;
    font-size: 18px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }

  .brand-text {
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }

  .brand-name {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.15;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .brand-tag {
    margin-top: 2px;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.88;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arch-badge {
    flex-shrink: 0;
    text-align: right;
    padding: 6px 10px;
    border: 1px solid rgba(255,255,255,0.35);
    border-radius: 8px;
    background: rgba(255,255,255,0.08);
    max-width: 130px;
  }

  .arch-badge .main {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: ${PAL.goldLight};
    white-space: nowrap;
  }

  .arch-badge .sub {
    font-size: 7px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.85;
    margin-top: 2px;
    white-space: nowrap;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 8px;
    flex-shrink: 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, ${PAL.gold}, transparent);
  }

  .divider-gem {
    width: 9px;
    height: 9px;
    background: ${PAL.teal};
    transform: rotate(45deg);
    border: 1px solid ${PAL.gold};
  }

  .title-block {
    text-align: center;
    margin-bottom: 6px;
    flex-shrink: 0;
  }

  .cert-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${PAL.navy};
    line-height: 1.12;
  }

  .cert-subtitle {
    margin-top: 5px;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${PAL.inkMuted};
  }

  .cert-no {
    display: inline-block;
    margin-top: 7px;
    padding: 4px 12px;
    border-radius: 999px;
    background: ${PAL.cream};
    border: 1px solid rgba(197,160,40,0.45);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: ${PAL.navyMid};
  }

  .body {
    text-align: center;
    max-width: 92%;
    margin: 0 auto 8px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13px;
    line-height: 1.45;
    color: ${PAL.inkMuted};
    flex-shrink: 0;
  }

  .body .lead {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${PAL.inkMuted};
    margin-bottom: 4px;
  }

  .recipient {
    font-size: 22px;
    font-weight: 700;
    color: ${PAL.ink};
    margin: 4px 0 3px;
    line-height: 1.2;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .product {
    margin-top: 4px;
    font-size: 16px;
    font-weight: 700;
    color: ${PAL.navyMid};
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .body .date-line {
    margin-top: 4px;
    font-size: 12px;
    color: ${PAL.ink};
    line-height: 1.4;
  }

  .body .date-line strong {
    color: ${PAL.navy};
    font-weight: 700;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 6px 0 8px;
    flex-shrink: 0;
  }

  .meta-card {
    background: linear-gradient(180deg, ${PAL.white} 0%, ${PAL.parchment} 100%);
    border: 1px solid rgba(197,160,40,0.35);
    border-left: 3px solid ${PAL.teal};
    border-radius: 6px;
    padding: 6px 8px;
    text-align: left;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .meta-label {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${PAL.inkMuted};
    font-weight: 700;
    margin-bottom: 2px;
  }

  .meta-value {
    font-size: 10px;
    font-weight: 600;
    color: ${PAL.ink};
    line-height: 1.3;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .footer {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(197,160,40,0.4);
    flex-shrink: 0;
  }

  .sig-block {
    flex: 1;
    min-width: 0;
    max-width: 180px;
  }

  .sig-line {
    width: 100%;
    max-width: 160px;
    border-top: 2px solid ${PAL.navy};
    padding-top: 5px;
    font-size: 9px;
    color: ${PAL.inkMuted};
    text-align: center;
    line-height: 1.35;
  }

  .sig-line strong {
    display: block;
    color: ${PAL.ink};
    font-size: 10px;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .seal-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .seal {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    border: 2px double ${PAL.gold};
    background:
      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, transparent 50%),
      linear-gradient(145deg, ${PAL.cream}, ${PAL.white});
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 10px rgba(12,35,64,0.1);
    position: relative;
    flex-shrink: 0;
  }

  .seal::before {
    content: '';
    position: absolute;
    inset: 5px;
    border-radius: 50%;
    border: 1px dashed rgba(197,160,40,0.55);
  }

  .seal-label {
    font-size: 7px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${PAL.inkMuted};
    font-weight: 700;
  }

  .seal-text {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 8px;
    font-weight: 700;
    color: ${PAL.navy};
    letter-spacing: 0.04em;
    text-align: center;
    line-height: 1.15;
  }

  .verify-block {
    flex: 1;
    min-width: 0;
    max-width: 190px;
    text-align: right;
  }

  .verify-label {
    font-size: 8px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: ${PAL.inkMuted};
    font-weight: 700;
  }

  .verify-code {
    margin-top: 3px;
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    color: ${PAL.navy};
    padding: 4px 7px;
    border-radius: 6px;
    background: ${PAL.cream};
    border: 1px solid rgba(197,160,40,0.4);
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media print {
    html, body {
      width: ${PAGE.w}mm !important;
      height: ${PAGE.h}mm !important;
      margin: 0 !important;
      overflow: hidden !important;
    }
    body { background: ${PAL.white}; }
    .cert-page {
      width: ${PAGE.w}mm !important;
      height: ${PAGE.h}mm !important;
      max-height: ${PAGE.h}mm !important;
      padding: ${PAGE.pad}mm !important;
      margin: 0 !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }
  }
</style>
</head>
<body>
  <div class="cert-page">
    <div class="cert-outer">
      ${buildCornerOrnament("tl")}
      ${buildCornerOrnament("tr")}
      ${buildCornerOrnament("bl")}
      ${buildCornerOrnament("br")}
      <div class="cert-weave"></div>
      <div class="cert-inner">
        <header class="header-band">
          <div class="brand-block">
            ${logoHtml}
            <div class="brand-text">
              <div class="brand-name">${siteName}</div>
              <div class="brand-tag">${tagline}</div>
            </div>
          </div>
          <div class="arch-badge">
            <div class="main">Architecture</div>
            <div class="sub">Design Certificate</div>
          </div>
        </header>

        <div class="main-content">
        <div class="divider">
          <div class="divider-line"></div>
          <div class="divider-gem"></div>
          <div class="divider-line"></div>
        </div>

        <div class="title-block">
          <div class="cert-title">Certificate of Design Completion</div>
          <div class="cert-subtitle">Official Architecture Project Delivery</div>
          <div class="cert-no">Certificate No. ${certNo}</div>
        </div>

        <div class="body">
          <div class="lead">This is to certify that</div>
          <div class="recipient">${customerName}</div>
          has successfully received completion of the architecture design project
          <div class="product">${projectName}</div>
          <div class="date-line">
            delivered on <strong>${escapeHtml(issueDate)}</strong>, in accordance with our agreement and verified payment terms.
          </div>
        </div>

        <div class="meta">${buildMetaCards(cert, branding.site_name || "PHOJAA95 Real Estate", issueDate)}</div>

        <div class="footer">
          <div class="sig-block">
            <div class="sig-line">
              Authorized Signatory
              <strong>${siteName}</strong>
            </div>
          </div>
          <div class="seal-block">
            <div class="seal">
              <span class="seal-label">Verified</span>
              <span class="seal-text">Authentic<br/>Certificate</span>
            </div>
          </div>
          <div class="verify-block">
            <div class="verify-label">Verification Number</div>
            <div class="verify-code" title="${verifyNo}">${verifyNo}</div>
          </div>
        </div>
        </div>
      </div>
      <div class="cert-weave"></div>
    </div>
  </div>
</body>
</html>`;
}

async function waitForDocumentImages(doc: Document | null | undefined): Promise<void> {
  const images = Array.from(doc?.images || []);
  if (images.length === 0) return;
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 3000);
        })
    )
  );
}

async function mountCertificateFrame(html: string): Promise<{
  iframe: HTMLIFrameElement;
  frameDoc: Document;
  cleanup: () => void;
}> {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.cssText = "position:fixed;left:-10000px;top:0;overflow:hidden;";

  const iframe = document.createElement("iframe");
  iframe.style.cssText = `width:${PAGE.w}mm;height:${PAGE.h}mm;border:0;`;
  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);

  const frameDoc = iframe.contentDocument;
  if (!frameDoc) {
    document.body.removeChild(wrapper);
    throw new Error("Unable to prepare certificate view.");
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  await waitForDocumentImages(frameDoc);
  if (frameDoc.fonts?.ready) {
    await frameDoc.fonts.ready;
  }
  await new Promise((r) => setTimeout(r, 200));

  return {
    iframe,
    frameDoc,
    cleanup: () => {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    },
  };
}

function printHtmlInHiddenFrame(html: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const { frameDoc, cleanup } = await mountCertificateFrame(html);
      const frameWindow = frameDoc.defaultView;
      if (!frameWindow) {
        cleanup();
        reject(new Error("Unable to prepare print view."));
        return;
      }

      frameWindow.focus();
      frameWindow.print();

      frameWindow.addEventListener(
        "afterprint",
        () => {
          cleanup();
          resolve();
        },
        { once: true }
      );

      setTimeout(() => {
        cleanup();
        resolve();
      }, 60_000);
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Failed to print certificate"));
    }
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function drawArchBorder(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const gold = hexToRgb(PAL.gold);
  const teal = hexToRgb(PAL.teal);
  const navy = hexToRgb(PAL.navy);
  const cream = hexToRgb(PAL.cream);

  doc.setFillColor(...cream);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setDrawColor(...gold);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(...teal);
  doc.setLineWidth(0.4);
  doc.rect(11, 11, pageWidth - 22, pageHeight - 22);

  doc.setDrawColor(...navy);
  doc.setLineWidth(0.25);
  doc.rect(13, 13, pageWidth - 26, pageHeight - 26);

  doc.setFillColor(...navy);
  doc.rect(8, 8, pageWidth - 16, 2.5, "F");
  doc.setFillColor(...gold);
  doc.rect(8, pageHeight - 10.5, pageWidth - 16, 2.5, "F");
}

function drawArchSeal(doc: jsPDF, cx: number, cy: number) {
  const gold = hexToRgb(PAL.gold);
  const navy = hexToRgb(PAL.navy);
  const cream = hexToRgb(PAL.cream);

  doc.setFillColor(...cream);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, 12, "FD");

  doc.setDrawColor(...navy);
  doc.setLineWidth(0.2);
  doc.circle(cx, cy, 9.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...navy);
  doc.text("VERIFIED", cx, cy - 1.5, { align: "center" });
  doc.text("AUTHENTIC", cx, cy + 2, { align: "center" });
}

async function renderArchitectureCertificatePdf(
  cert: ArchCertificateRecord,
  branding: SiteBranding,
  filename: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const siteName = branding.site_name || "PHOJAA95 Real Estate";
  const tagline = (branding.site_tagline || "Architecture & Design Services").toUpperCase();
  const issueDate = formatCertDate(cert.completionDate || cert.createdAt);

  const navy = hexToRgb(PAL.navy);
  const navyMid = hexToRgb(PAL.navyMid);
  const teal = hexToRgb(PAL.teal);
  const gold = hexToRgb(PAL.gold);
  const goldLight = hexToRgb(PAL.goldLight);
  const ink = hexToRgb(PAL.ink);
  const inkMuted = hexToRgb(PAL.inkMuted);
  const white = hexToRgb(PAL.white);
  const parchment = hexToRgb(PAL.parchment);

  drawArchBorder(doc, pageWidth, pageHeight);

  doc.setFillColor(...navy);
  doc.rect(16, 16, pageWidth - 32, 20, "F");
  doc.setFillColor(...gold);
  doc.rect(16, 34, pageWidth - 32, 1, "F");

  let textX = 22;
  const logoDataUrl = await resolveSiteLogoForCertificate(branding);
  if (logoDataUrl) {
    try {
      const format = logoDataUrl.startsWith("data:image/jp") ? "JPEG" : "PNG";
      doc.addImage(logoDataUrl, format, 20, 18, 16, 16, undefined, "FAST");
      textX = 40;
    } catch {
      // ignore logo errors
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(siteName.toUpperCase(), textX, 26, { maxWidth: pageWidth - 100 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 230, 240);
  doc.text(tagline, textX, 31, { maxWidth: pageWidth - 100 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...goldLight);
  doc.text("Architecture", pageWidth - 22, 24, { align: "right" });
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("Design Certificate", pageWidth - 22, 29, { align: "right" });

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.line(28, 40, pageWidth - 28, 40);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...teal);
  doc.text("ARCHITECTURE DESIGN", pageWidth / 2, 47, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...navy);
  doc.text("CERTIFICATE OF DESIGN COMPLETION", pageWidth / 2, 55, { align: "center", maxWidth: pageWidth - 40 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...inkMuted);
  doc.text("OFFICIAL ARCHITECTURE PROJECT DELIVERY", pageWidth / 2, 61, { align: "center" });
  doc.text(`Certificate No. ${cert.certificateNumber || "—"}`, pageWidth / 2, 66, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...inkMuted);
  doc.text("THIS IS TO CERTIFY THAT", pageWidth / 2, 74, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...ink);
  doc.text(cert.customerName || "—", pageWidth / 2, 82, { align: "center", maxWidth: pageWidth - 50 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...inkMuted);
  doc.text("has successfully received completion of the architecture design project", pageWidth / 2, 89, {
    align: "center",
    maxWidth: pageWidth - 40,
  });

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...navyMid);
  doc.text(cert.projectName || "—", pageWidth / 2, 96, { align: "center", maxWidth: pageWidth - 40 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ink);
  doc.text(`delivered on ${issueDate}, in accordance with our agreement and verified payment terms.`, pageWidth / 2, 103, {
    align: "center",
    maxWidth: pageWidth - 40,
  });

  const cards: [string, string][] = [
    ["Project", cert.projectName || "—"],
    ["Category", cert.projectCategory || "—"],
    ["Location", cert.projectLocation || "—"],
    ["Lead Architect", cert.staffName || "—"],
    ["Completion Date", issueDate],
    ["Issued By", cert.companyName || siteName],
  ];

  const cardW = (pageWidth - 52) / 3;
  const cardH = 15;
  const cardY = 110;

  cards.forEach((card, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 22 + col * (cardW + 3);
    const y = cardY + row * (cardH + 3);

    doc.setFillColor(...white);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

    doc.setFillColor(...teal);
    doc.rect(x, y, 2, cardH, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...inkMuted);
    doc.text(card[0].toUpperCase(), x + 5, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.text(card[1], x + 5, y + 11, { maxWidth: cardW - 8 });
  });

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.line(22, pageHeight - 34, pageWidth - 22, pageHeight - 34);

  doc.setDrawColor(...navy);
  doc.setLineWidth(0.4);
  doc.line(28, pageHeight - 22, 78, pageHeight - 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...inkMuted);
  doc.text("Authorized Signatory", 53, pageHeight - 17, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ink);
  doc.text(siteName, 53, pageHeight - 12, { align: "center", maxWidth: 50 });

  drawArchSeal(doc, pageWidth / 2, pageHeight - 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...inkMuted);
  doc.text("VERIFICATION NUMBER", pageWidth - 24, pageHeight - 28, { align: "right" });

  const verifyCode = cert.verificationNumber || "—";
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  const verifyW = Math.min(doc.getTextWidth(verifyCode) + 8, 70);
  doc.setFillColor(...parchment);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.2);
  doc.roundedRect(pageWidth - 24 - verifyW, pageHeight - 30, verifyW, 10, 2, 2, "FD");
  doc.setTextColor(...navy);
  doc.text(verifyCode, pageWidth - 24, pageHeight - 22, { align: "right", maxWidth: 65 });

  doc.save(filename);
}

export async function printArchitectureCertificate(
  cert: ArchCertificateRecord,
  branding: SiteBranding
) {
  const logoDataUrl = await resolveSiteLogoForCertificate(branding);
  const html = buildArchitectureCertificateHtml(cert, branding, logoDataUrl);
  await printHtmlInHiddenFrame(html);
}

export async function downloadArchitectureCertificatePdf(
  cert: ArchCertificateRecord,
  branding: SiteBranding
) {
  await renderArchitectureCertificatePdf(
    cert,
    branding,
    `architecture-certificate-${cert.certificateNumber || "cert"}.pdf`
  );
}
