import jsPDF from "jspdf";
import {
  loadSiteLogoImage,
  loadSiteLogoDataUrl,
  normalizeSiteLogoUrl,
  type SiteBranding,
} from "@/lib/site-branding";
import { formatDisplayDate } from "@/lib/format-date";
import { formatStatusLabel } from "./utils";

export type CertificateRecord = {
  certificateNumber?: string;
  certificateType?: string;
  customerName?: string;
  companyName?: string;
  productName?: string;
  productVersion?: string;
  completionDate?: string;
  warrantyPeriod?: number;
  maintenancePeriod?: number;
  developerName?: string;
  verificationNumber?: string;
  createdAt?: string | Date;
};

export type CertificateBranding = SiteBranding;

/** Bhutan-inspired palette — saffron, gold, maroon, parchment. */
const BHUTAN = {
  saffron: "#FF671F",
  saffronDark: "#E55A12",
  gold: "#C9A227",
  goldLight: "#E8C547",
  maroon: "#6B1D1D",
  maroonDeep: "#4A1212",
  parchment: "#FFF9F2",
  cream: "#FDF3E7",
  ink: "#1C1917",
  inkMuted: "#57534E",
  white: "#FFFFFF",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCertificateTitle(type?: string): string {
  if (type === "architecture_completion") return "Certificate of Architecture Design Completion";
  if (type === "software_ownership") return "Certificate of Software Ownership";
  if (type === "project_completion") return "Certificate of Project Completion";
  return "Certificate of Achievement";
}

function getCertificateAction(type?: string): string {
  if (type === "architecture_completion") return "has successfully received completion of the architecture design project";
  if (type === "software_ownership") return "has acquired full ownership of the software product";
  return "has successfully received completion of the software product";
}

function getCertificateSubtitle(type?: string): string {
  if (type === "architecture_completion") return "Official Architecture Design Certificate";
  return "Official Software Delivery Certificate";
}

function getStaffRoleLabel(type?: string): string {
  if (type === "architecture_completion") return "Lead Architect";
  return "Lead Developer";
}

export function formatCertDate(value?: string | Date): string {
  return formatDisplayDate(value);
}

function buildMetaCards(cert: CertificateRecord, siteName: string, issueDate: string): string {
  const roleLabel = getStaffRoleLabel(cert.certificateType);
  const cards = [
    ["Certificate Type", formatStatusLabel(cert.certificateType || "")],
    [roleLabel, cert.developerName || "—"],
    ["Warranty", cert.warrantyPeriod ? `${cert.warrantyPeriod} months` : "—"],
    ["Maintenance", cert.maintenancePeriod ? `${cert.maintenancePeriod} months` : "—"],
    ["Issue Date", issueDate],
    ["Issued By", siteName],
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

function buildCornerOrnament(position: "tl" | "tr" | "bl" | "br"): string {
  const rotate = { tl: "0", tr: "90", bl: "270", br: "180" }[position];
  return `
    <svg class="corner corner-${position}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="rotate(${rotate} 32 32)">
        <path d="M4 4 H44 V8 H8 V44 H4 Z" fill="${BHUTAN.gold}"/>
        <path d="M8 8 H36 V12 H12 V36 H8 Z" fill="${BHUTAN.saffron}"/>
        <circle cx="14" cy="14" r="3" fill="${BHUTAN.maroon}"/>
        <path d="M20 8 L24 16 L16 16 Z" fill="${BHUTAN.goldLight}"/>
      </g>
    </svg>`;
}

export function buildCertificateHtml(
  cert: CertificateRecord,
  branding: CertificateBranding,
  logoSrc?: string | null
): string {
  const siteName = escapeHtml(branding.site_name || "PHOJAA95");
  const tagline = escapeHtml(branding.site_tagline || "Software Development & Digital Solutions");
  const resolvedLogo = logoSrc || normalizeSiteLogoUrl(branding.site_logo);
  const title = escapeHtml(getCertificateTitle(cert.certificateType));
  const subtitle = escapeHtml(getCertificateSubtitle(cert.certificateType));
  const issueDate = formatCertDate(cert.completionDate || cert.createdAt);
  const certNo = escapeHtml(cert.certificateNumber || "—");
  const verifyNo = escapeHtml(cert.verificationNumber || "—");
  const customerName = escapeHtml(cert.customerName || "—");
  const companyName = cert.companyName ? escapeHtml(cert.companyName) : "";
  const productName = escapeHtml(cert.productName || "—");
  const productVersion = cert.productVersion ? escapeHtml(cert.productVersion) : "";
  const action = getCertificateAction(cert.certificateType);

  const customerLine = companyName
    ? `${customerName}<span class="company">(${companyName})</span>`
    : customerName;

  const logoHtml = resolvedLogo
    ? `<img src="${resolvedLogo}" alt="${siteName}" class="logo-img" />`
    : `<div class="logo-fallback">${siteName.charAt(0)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${title} — ${certNo}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: ${BHUTAN.cream};
    color: ${BHUTAN.ink};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .cert-page {
    width: 277mm;
    min-height: 190mm;
    margin: 0 auto;
    padding: 10mm;
    background: ${BHUTAN.parchment};
    position: relative;
    overflow: hidden;
  }

  .cert-page::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 15% 20%, rgba(255,103,31,0.06) 0%, transparent 42%),
      radial-gradient(circle at 85% 80%, rgba(201,162,39,0.08) 0%, transparent 40%);
    pointer-events: none;
  }

  .cert-outer {
    position: relative;
    min-height: 170mm;
    border: 3px solid ${BHUTAN.gold};
    outline: 1px solid ${BHUTAN.saffron};
    background: ${BHUTAN.white};
    box-shadow: inset 0 0 0 6px ${BHUTAN.parchment}, inset 0 0 0 7px ${BHUTAN.maroon};
  }

  .cert-weave {
    height: 8px;
    background: repeating-linear-gradient(
      90deg,
      ${BHUTAN.saffron} 0 14px,
      ${BHUTAN.gold} 14px 28px,
      ${BHUTAN.maroon} 28px 42px,
      ${BHUTAN.goldLight} 42px 56px
    );
  }

  .cert-inner {
    position: relative;
    padding: 22px 36px 28px;
  }

  .corner {
    position: absolute;
    width: 52px;
    height: 52px;
    opacity: 0.95;
  }
  .corner-tl { top: 10px; left: 10px; }
  .corner-tr { top: 10px; right: 10px; }
  .corner-bl { bottom: 10px; left: 10px; }
  .corner-br { bottom: 10px; right: 10px; }

  .header-band {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 22px;
    margin: -22px -36px 20px;
    background: linear-gradient(135deg, ${BHUTAN.maroonDeep} 0%, ${BHUTAN.maroon} 40%, ${BHUTAN.saffronDark} 100%);
    color: ${BHUTAN.white};
    border-bottom: 3px solid ${BHUTAN.gold};
  }

  .brand-block {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .logo-img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 12px;
    background: rgba(255,255,255,0.95);
    padding: 6px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  }

  .logo-fallback {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    background: linear-gradient(145deg, ${BHUTAN.gold}, ${BHUTAN.saffron});
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${BHUTAN.white};
    font-weight: 800;
    font-size: 26px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  }

  .brand-name {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1.1;
    text-transform: uppercase;
  }

  .brand-tag {
    margin-top: 4px;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.88;
  }

  .locale-badge {
    flex-shrink: 0;
    text-align: right;
    padding: 10px 14px;
    border: 1px solid rgba(255,255,255,0.35);
    border-radius: 10px;
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(4px);
  }

  .locale-badge .druk {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: ${BHUTAN.goldLight};
  }

  .locale-badge .sub {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
    margin-top: 2px;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 6px 0 18px;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, ${BHUTAN.gold}, transparent);
  }

  .divider-gem {
    width: 10px;
    height: 10px;
    background: ${BHUTAN.saffron};
    transform: rotate(45deg);
    border: 1px solid ${BHUTAN.gold};
    box-shadow: 0 0 0 3px ${BHUTAN.parchment};
  }

  .title-block { text-align: center; margin-bottom: 18px; }

  .cert-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${BHUTAN.maroonDeep};
    line-height: 1.15;
  }

  .cert-subtitle {
    margin-top: 8px;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${BHUTAN.inkMuted};
  }

  .cert-no {
    display: inline-block;
    margin-top: 10px;
    padding: 5px 14px;
    border-radius: 999px;
    background: ${BHUTAN.cream};
    border: 1px solid rgba(201,162,39,0.45);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: ${BHUTAN.maroon};
  }

  .body {
    text-align: center;
    max-width: 760px;
    margin: 0 auto 22px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 18px;
    line-height: 1.65;
    color: ${BHUTAN.inkMuted};
  }

  .body .lead {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${BHUTAN.inkMuted};
    margin-bottom: 8px;
  }

  .recipient {
    font-size: 36px;
    font-weight: 700;
    color: ${BHUTAN.ink};
    margin: 10px 0 6px;
    line-height: 1.2;
  }

  .recipient .company {
    display: block;
    margin-top: 4px;
    font-size: 18px;
    font-weight: 600;
    color: ${BHUTAN.saffronDark};
    letter-spacing: 0.02em;
  }

  .product {
    margin-top: 12px;
    font-size: 24px;
    font-weight: 700;
    color: ${BHUTAN.maroon};
  }

  .product .version {
    font-size: 15px;
    font-weight: 600;
    color: ${BHUTAN.gold};
    margin-left: 6px;
  }

  .body .date-line {
    margin-top: 12px;
    font-size: 17px;
    color: ${BHUTAN.ink};
  }

  .body .date-line strong {
    color: ${BHUTAN.maroonDeep};
    font-weight: 700;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 22px 0 20px;
  }

  .meta-card {
    background: linear-gradient(180deg, ${BHUTAN.white} 0%, ${BHUTAN.parchment} 100%);
    border: 1px solid rgba(201,162,39,0.35);
    border-left: 4px solid ${BHUTAN.saffron};
    border-radius: 10px;
    padding: 11px 13px;
    text-align: left;
  }

  .meta-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${BHUTAN.inkMuted};
    font-weight: 700;
    margin-bottom: 4px;
  }

  .meta-value {
    font-size: 13px;
    font-weight: 600;
    color: ${BHUTAN.ink};
    word-break: break-word;
    line-height: 1.35;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    padding-top: 16px;
    border-top: 1px solid rgba(201,162,39,0.4);
  }

  .sig-block { min-width: 200px; }

  .sig-line {
    width: 200px;
    border-top: 2px solid ${BHUTAN.maroon};
    padding-top: 8px;
    font-size: 11px;
    color: ${BHUTAN.inkMuted};
    text-align: center;
    line-height: 1.5;
  }

  .sig-line strong {
    display: block;
    color: ${BHUTAN.ink};
    font-size: 12px;
    margin-top: 2px;
  }

  .seal-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .seal {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    border: 3px double ${BHUTAN.gold};
    background:
      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, transparent 50%),
      linear-gradient(145deg, ${BHUTAN.cream}, ${BHUTAN.white});
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 18px rgba(107,29,29,0.12);
    position: relative;
  }

  .seal::before {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    border: 1px dashed rgba(201,162,39,0.55);
  }

  .seal-label {
    font-size: 7px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${BHUTAN.inkMuted};
    font-weight: 700;
  }

  .seal-text {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11px;
    font-weight: 700;
    color: ${BHUTAN.maroon};
    letter-spacing: 0.06em;
    text-align: center;
    padding: 0 8px;
    line-height: 1.2;
  }

  .verify-block {
    text-align: right;
    min-width: 180px;
  }

  .verify-label {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${BHUTAN.inkMuted};
    font-weight: 700;
  }

  .verify-code {
    margin-top: 5px;
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 12px;
    font-weight: 700;
    color: ${BHUTAN.maroonDeep};
    padding: 6px 10px;
    border-radius: 8px;
    background: ${BHUTAN.cream};
    border: 1px solid rgba(201,162,39,0.4);
    display: inline-block;
  }

  .cert-weave-bottom { margin-top: 0; }

  @media print {
    body { background: ${BHUTAN.white}; }
    .cert-page { width: auto; min-height: auto; padding: 0; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="cert-page">
    <div class="cert-outer">
      <div class="cert-weave"></div>
      <div class="cert-inner">
        ${buildCornerOrnament("tl")}
        ${buildCornerOrnament("tr")}
        ${buildCornerOrnament("bl")}
        ${buildCornerOrnament("br")}

        <header class="header-band">
          <div class="brand-block">
            ${logoHtml}
            <div>
              <div class="brand-name">${siteName}</div>
              <div class="brand-tag">${tagline}</div>
            </div>
          </div>
          <div class="locale-badge">
            <div class="druk">འབྲུག</div>
            <div class="sub">Kingdom of Bhutan · Druk Yul</div>
          </div>
        </header>

        <div class="divider">
          <div class="divider-line"></div>
          <div class="divider-gem"></div>
          <div class="divider-line"></div>
        </div>

        <div class="title-block">
          <div class="cert-title">${title}</div>
          <div class="cert-subtitle">${subtitle}</div>
          <div class="cert-no">Certificate No. ${certNo}</div>
        </div>

        <div class="body">
          <div class="lead">This is to certify that</div>
          <div class="recipient">${customerLine}</div>
          ${action}
          <div class="product">
            ${productName}${productVersion ? `<span class="version">v${productVersion}</span>` : ""}
          </div>
          <div class="date-line">
            delivered on <strong>${escapeHtml(issueDate)}</strong>, in accordance with our agreement and payment terms.
          </div>
        </div>

        <div class="meta">${buildMetaCards(cert, branding.site_name || "PHOJAA95", issueDate)}</div>

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
            <div class="verify-code">${verifyNo}</div>
          </div>
        </div>
      </div>
      <div class="cert-weave cert-weave-bottom"></div>
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

function printHtmlInHiddenFrame(html: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDoc = frameWindow?.document;
    if (!frameWindow || !frameDoc) {
      cleanup();
      reject(new Error("Unable to prepare print view."));
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    try {
      await waitForDocumentImages(frameDoc);
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
      cleanup();
      reject(err instanceof Error ? err : new Error("Failed to print certificate"));
    }
  });
}

export async function printCertificate(cert: CertificateRecord, branding: CertificateBranding) {
  const logoDataUrl = branding.site_logo ? await loadSiteLogoDataUrl(branding.site_logo) : null;
  const html = buildCertificateHtml(cert, branding, logoDataUrl);
  await printHtmlInHiddenFrame(html);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function drawBhutanBorder(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const gold = hexToRgb(BHUTAN.gold);
  const saffron = hexToRgb(BHUTAN.saffron);
  const maroon = hexToRgb(BHUTAN.maroon);
  const cream = hexToRgb(BHUTAN.cream);

  doc.setFillColor(...cream);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setDrawColor(...gold);
  doc.setLineWidth(1.4);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(...saffron);
  doc.setLineWidth(0.5);
  doc.rect(11, 11, pageWidth - 22, pageHeight - 22);

  doc.setDrawColor(...maroon);
  doc.setLineWidth(0.3);
  doc.rect(13.5, 13.5, pageWidth - 27, pageHeight - 27);

  doc.setFillColor(...saffron);
  doc.rect(8, 8, pageWidth - 16, 3, "F");
  doc.setFillColor(...gold);
  doc.rect(8, pageHeight - 11, pageWidth - 16, 3, "F");
}

function drawCornerAccent(doc: jsPDF, x: number, y: number, flipX: boolean, flipY: boolean) {
  const gold = hexToRgb(BHUTAN.gold);
  const saffron = hexToRgb(BHUTAN.saffron);
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.line(x, y, x + 14 * sx, y);
  doc.line(x, y, x, y + 14 * sy);

  doc.setDrawColor(...saffron);
  doc.setLineWidth(0.4);
  doc.line(x + 2 * sx, y + 2 * sy, x + 10 * sx, y + 2 * sy);
  doc.line(x + 2 * sx, y + 2 * sy, x + 2 * sx, y + 10 * sy);
}

function drawVerificationSeal(doc: jsPDF, cx: number, cy: number) {
  const gold = hexToRgb(BHUTAN.gold);
  const maroon = hexToRgb(BHUTAN.maroon);
  const cream = hexToRgb(BHUTAN.cream);

  doc.setFillColor(...cream);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.circle(cx, cy, 14, "FD");

  doc.setDrawColor(...maroon);
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...maroon);
  doc.text("VERIFIED", cx, cy - 2, { align: "center" });
  doc.setFontSize(5);
  doc.text("AUTHENTIC", cx, cy + 2, { align: "center" });
  doc.text("CERTIFICATE", cx, cy + 5.5, { align: "center" });
}

export async function downloadCertificatePdf(cert: CertificateRecord, branding: CertificateBranding) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const siteName = branding.site_name || "PHOJAA95";
  const tagline = branding.site_tagline || "Software Development & Digital Solutions";
  const title = getCertificateTitle(cert.certificateType);
  const issueDate = formatCertDate(cert.completionDate || cert.createdAt);
  const roleLabel = getStaffRoleLabel(cert.certificateType);

  const maroon = hexToRgb(BHUTAN.maroon);
  const maroonDeep = hexToRgb(BHUTAN.maroonDeep);
  const saffron = hexToRgb(BHUTAN.saffron);
  const gold = hexToRgb(BHUTAN.gold);
  const ink = hexToRgb(BHUTAN.ink);
  const inkMuted = hexToRgb(BHUTAN.inkMuted);
  const cream = hexToRgb(BHUTAN.cream);
  const white = hexToRgb(BHUTAN.white);

  drawBhutanBorder(doc, pageWidth, pageHeight);
  drawCornerAccent(doc, 16, 19, false, false);
  drawCornerAccent(doc, pageWidth - 16, 19, true, false);
  drawCornerAccent(doc, 16, pageHeight - 16, false, true);
  drawCornerAccent(doc, pageWidth - 16, pageHeight - 16, true, true);

  doc.setFillColor(...maroonDeep);
  doc.rect(16, 16, pageWidth - 32, 22, "F");
  doc.setFillColor(...saffron);
  doc.rect(16, 36, pageWidth - 32, 1.2, "F");

  let textX = 22;
  const logoImg = await loadSiteLogoImage(branding.site_logo);
  if (logoImg) {
    try {
      doc.addImage(logoImg, "PNG", 22, 19, 18, 18, undefined, "FAST");
      textX = 44;
    } catch {
      // ignore logo errors
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(siteName.toUpperCase(), textX, 27);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 230, 200);
  doc.text(tagline.toUpperCase(), textX, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...gold);
  doc.text("Kingdom of Bhutan · Druk Yul", pageWidth - 22, 27, { align: "right" });
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(getCertificateSubtitle(cert.certificateType), pageWidth - 22, 32, { align: "right" });

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.line(30, 44, pageWidth - 30, 44);

  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...maroonDeep);
  doc.text(title.toUpperCase(), pageWidth / 2, 54, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...inkMuted);
  doc.text(`Certificate No. ${cert.certificateNumber || "—"}`, pageWidth / 2, 61, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...inkMuted);
  doc.text("THIS IS TO CERTIFY THAT", pageWidth / 2, 72, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...ink);
  const customerLabel = cert.companyName
    ? `${cert.customerName || "—"} (${cert.companyName})`
    : cert.customerName || "—";
  doc.text(customerLabel, pageWidth / 2, 82, { align: "center", maxWidth: pageWidth - 50 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...inkMuted);
  doc.text(getCertificateAction(cert.certificateType), pageWidth / 2, 92, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...maroon);
  const productLine = `${cert.productName || "—"}${cert.productVersion ? ` v${cert.productVersion}` : ""}`;
  doc.text(productLine, pageWidth / 2, 100, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(`delivered on ${issueDate}, in accordance with our agreement and payment terms.`, pageWidth / 2, 108, {
    align: "center",
    maxWidth: pageWidth - 40,
  });

  const cards = [
    ["Type", formatStatusLabel(cert.certificateType || "")],
    [roleLabel.replace("Lead ", ""), cert.developerName || "—"],
    ["Warranty", cert.warrantyPeriod ? `${cert.warrantyPeriod} months` : "—"],
    ["Maintenance", cert.maintenancePeriod ? `${cert.maintenancePeriod} months` : "—"],
    ["Issue Date", issueDate],
    ["Issued By", siteName],
  ];
  const cardW = (pageWidth - 52) / 3;
  const cardH = 16;
  const cardY = 116;
  cards.forEach((card, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 22 + col * (cardW + 3);
    const y = cardY + row * (cardH + 3);

    doc.setFillColor(...white);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

    doc.setFillColor(...saffron);
    doc.rect(x, y, 2.5, cardH, "F");

    doc.setFontSize(6);
    doc.setTextColor(...inkMuted);
    doc.text(card[0].toUpperCase(), x + 5, y + 5.5);
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.text(card[1], x + 5, y + 11.5, { maxWidth: cardW - 8 });
    doc.setFont("helvetica", "normal");
  });

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.line(22, pageHeight - 34, pageWidth - 22, pageHeight - 34);

  doc.setDrawColor(...maroon);
  doc.setLineWidth(0.5);
  doc.line(28, pageHeight - 22, 78, pageHeight - 22);
  doc.setFontSize(8);
  doc.setTextColor(...inkMuted);
  doc.text("Authorized Signatory", 53, pageHeight - 17, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ink);
  doc.text(siteName, 53, pageHeight - 12, { align: "center" });
  doc.setFont("helvetica", "normal");

  drawVerificationSeal(doc, pageWidth / 2, pageHeight - 20);

  doc.setFontSize(7);
  doc.setTextColor(...inkMuted);
  doc.text("VERIFICATION NUMBER", pageWidth - 24, pageHeight - 28, { align: "right" });

  const verifyCode = cert.verificationNumber || "—";
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  const verifyW = doc.getTextWidth(verifyCode) + 8;
  doc.setFillColor(...cream);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.2);
  doc.roundedRect(pageWidth - 24 - verifyW, pageHeight - 30, verifyW, 10, 2, 2, "FD");
  doc.setTextColor(...maroonDeep);
  doc.text(verifyCode, pageWidth - 24, pageHeight - 22, { align: "right" });

  const fileName = `${cert.certificateNumber || "certificate"}.pdf`;
  doc.save(fileName);
}
