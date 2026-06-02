import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDisplayDate } from "@/lib/format-date";
import { formatStatusLabel } from "@/components/software-dev/utils";
import { loadSiteLogoDataUrl, type SiteBranding } from "@/lib/site-branding";

export type ArchInvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
};

export type ArchInvoiceRecord = {
  id?: number;
  invoiceNumber: string;
  orderNumber?: string;
  issueDate: string | Date;
  dueDate?: string | Date | null;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  projectName: string;
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  amountPaid: string | number;
  remainingAmount: string | number;
  paymentStatus: string;
  status?: string;
  items?: ArchInvoiceItem[];
};

const NAVY = "#1e3a5f";
const TEAL = "#0d9488";
const GOLD = "#b8860b";

function fmtNu(val: string | number | null | undefined): string {
  const n = parseFloat(String(val ?? 0));
  if (Number.isNaN(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentMeta(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "fully_paid" || normalized === "paid") {
    return { label: "Fully Paid", color: "#065f46", bg: "#d1fae5", stamp: "PAID" };
  }
  if (normalized === "partially_paid") {
    return { label: "Partially Paid", color: "#92400e", bg: "#fef3c7", stamp: "PARTIAL" };
  }
  return { label: "Unpaid", color: "#991b1b", bg: "#fee2e2", stamp: "DUE" };
}

function percentPaid(invoice: ArchInvoiceRecord): number {
  const total = parseFloat(String(invoice.totalAmount));
  const paid = parseFloat(String(invoice.amountPaid));
  if (!total || total <= 0) return paid > 0 ? 100 : 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

function lineItems(invoice: ArchInvoiceRecord): ArchInvoiceItem[] {
  if (invoice.items?.length) return invoice.items;
  return [{
    description: `Architecture Design: ${invoice.projectName}`,
    quantity: 1,
    unitPrice: invoice.subtotal,
    totalPrice: invoice.subtotal,
  }];
}

function customerAddressBlock(invoice: ArchInvoiceRecord): string {
  return [invoice.customerAddress, invoice.customerEmail, invoice.customerPhone].filter(Boolean).join("<br/>");
}

export function buildArchitectureInvoiceHtml(
  invoice: ArchInvoiceRecord,
  branding: SiteBranding,
  logoDataUrl?: string | null
): string {
  const siteName = branding.site_name || "PHOJAA95 Real Estate";
  const tagline = branding.site_tagline || "Architecture & Design Services";
  const issueDate = formatDisplayDate(invoice.issueDate);
  const dueDate = invoice.dueDate ? formatDisplayDate(invoice.dueDate) : "—";
  const meta = paymentMeta(invoice.paymentStatus);
  const pct = percentPaid(invoice);
  const items = lineItems(invoice);

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="" style="height:44px;width:44px;object-fit:contain;border-radius:6px" />`
    : `<div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,${NAVY},${TEAL});display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px">${siteName.charAt(0)}</div>`;

  const rowsHtml = items.map((item, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:10px">${String(i + 1).padStart(2, "0")}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#0f172a"><strong>${item.description}</strong></td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px">${item.quantity}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;font-variant-numeric:tabular-nums">${fmtNu(item.unitPrice)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums">${fmtNu(item.totalPrice)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${invoice.invoiceNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Segoe UI,system-ui,sans-serif;background:#f1f5f9;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:16mm 18mm;position:relative}
  .accent{height:4px;background:linear-gradient(90deg,${NAVY},${TEAL},${GOLD});border-radius:2px;margin-bottom:14px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}
  .brand{display:flex;gap:12px;align-items:center}
  .brand-name{font-size:15px;font-weight:800;color:${NAVY};line-height:1.2}
  .brand-sub{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:2px}
  .meta{text-align:right}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
  .title{font-size:28px;font-weight:900;color:${NAVY};letter-spacing:-1px;line-height:1}
  .inv-no{font-size:11px;color:#64748b;margin-top:4px}
  .stamp{position:absolute;top:18mm;right:18mm;width:78px;height:78px;border:2.5px solid ${meta.color};border-radius:50%;display:flex;align-items:center;justify-content:center;transform:rotate(-14deg);opacity:0.75}
  .stamp-text{font-size:11px;font-weight:900;color:${meta.color};text-transform:uppercase;letter-spacing:1px;text-align:center;line-height:1.2}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;border-left:3px solid ${TEAL}}
  .card-label{font-size:8px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:700;margin-bottom:4px}
  .card-name{font-size:12px;font-weight:700;color:#0f172a;margin-bottom:2px}
  .card-detail{font-size:10px;color:#64748b;line-height:1.5}
  table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12px}
  th{background:#f1f5f9;text-align:left;padding:7px 10px;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;font-weight:700;border-bottom:1px solid #e2e8f0}
  th.num{text-align:right} th.qty{text-align:center}
  .bottom{display:grid;grid-template-columns:1.1fr 0.9fr;gap:12px;align-items:start}
  .notes{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:10px;color:#78350f;line-height:1.55}
  .notes-title{font-size:8px;font-weight:700;text-transform:uppercase;color:#92400e;margin-bottom:4px}
  .totals{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
  .row{display:flex;justify-content:space-between;padding:4px 0;font-size:11px;color:#475569}
  .row.total{font-size:13px;font-weight:800;border-top:1.5px solid #e2e8f0;margin-top:6px;padding-top:8px;color:${NAVY}}
  .row.paid{color:#065f46;font-weight:700}
  .row.due{color:#b45309;font-weight:700}
  .bar{height:4px;background:#e2e8f0;border-radius:2px;margin-top:8px;overflow:hidden}
  .bar-fill{height:100%;background:linear-gradient(90deg,${TEAL},${meta.color === "#065f46" ? "#34d399" : GOLD});width:${pct}%}
  .footer{text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0}
  .footer-brand{font-size:12px;font-weight:800;color:${NAVY}}
  .footer-text{font-size:9px;color:#94a3b8;margin-top:3px}
  @media print{body{background:#fff}.page{padding:14mm 16mm;max-width:100%}}
</style></head>
<body><div class="page">
  <div class="accent"></div>
  <div class="stamp"><div class="stamp-text">${meta.stamp}<br/><span style="font-size:9px">${pct}%</span></div></div>
  <div class="header">
    <div class="brand">${logoHtml}<div><div class="brand-name">${siteName}</div><div class="brand-sub">${tagline}</div></div></div>
    <div class="meta">
      <div class="badge">${meta.label}</div>
      <div class="title">INVOICE</div>
      <div class="inv-no"># ${invoice.invoiceNumber}${invoice.orderNumber ? ` · Order ${invoice.orderNumber}` : ""}</div>
      <div class="inv-no">Issued: ${issueDate} · Due: ${dueDate}</div>
    </div>
  </div>
  <div class="cards">
    <div class="card">
      <div class="card-label">Bill To</div>
      <div class="card-name">${invoice.customerName}</div>
      <div class="card-detail">${customerAddressBlock(invoice) || "—"}</div>
    </div>
    <div class="card">
      <div class="card-label">Project</div>
      <div class="card-name">${invoice.projectName}</div>
      <div class="card-detail">Architecture design &amp; documentation services</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th style="width:36px">#</th><th>Description</th><th class="qty" style="width:48px">Qty</th>
      <th class="num" style="width:90px">Unit (Nu.)</th><th class="num" style="width:90px">Amount (Nu.)</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="bottom">
    <div class="notes">
      <div class="notes-title">Payment Terms</div>
      50% advance payment is required upon order approval. Remaining balance is due upon project completion.
      Please include invoice number <strong>${invoice.invoiceNumber}</strong> with all bank transfers.
      This is a computer-generated invoice and is valid without signature.
    </div>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>Nu. ${fmtNu(invoice.subtotal)}</span></div>
      <div class="row"><span>Tax</span><span>Nu. ${fmtNu(invoice.taxAmount)}</span></div>
      <div class="row"><span>Discount</span><span>- Nu. ${fmtNu(invoice.discountAmount)}</span></div>
      <div class="row total"><span>Total Amount</span><span>Nu. ${fmtNu(invoice.totalAmount)}</span></div>
      <div class="row paid"><span>Amount Paid</span><span>Nu. ${fmtNu(invoice.amountPaid)}</span></div>
      <div class="row due"><span>Balance Due</span><span>Nu. ${fmtNu(invoice.remainingAmount)}</span></div>
      <div class="bar"><div class="bar-fill"></div></div>
      <div style="text-align:center;font-size:8px;color:#94a3b8;margin-top:4px;font-weight:700;text-transform:uppercase">${pct}% Collected · ${formatStatusLabel(invoice.paymentStatus)}</div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-brand">Thank you for choosing ${siteName}</div>
    <div class="footer-text">© ${new Date().getFullYear()} ${siteName} · Architecture Division</div>
  </div>
</div></body></html>`;
}

export async function printArchitectureInvoice(invoice: ArchInvoiceRecord, branding: SiteBranding) {
  const logoDataUrl = await loadSiteLogoDataUrl(branding.site_logo);
  const html = buildArchitectureInvoiceHtml(invoice, branding, logoDataUrl);
  const win = window.open("", "_blank", "width=900,height=760");
  if (!win) throw new Error("Pop-up blocked — allow pop-ups to print");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export async function downloadArchitectureInvoicePdf(invoice: ArchInvoiceRecord, branding: SiteBranding) {
  const logoDataUrl = await loadSiteLogoDataUrl(branding.site_logo);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;
  const siteName = branding.site_name || "PHOJAA95 Real Estate";
  const items = lineItems(invoice);

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 3, "F");
  doc.setFillColor(13, 148, 136);
  doc.rect(0, 3, pageWidth, 1.5, "F");
  y = 14;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, y, 18, 18);
    } catch {
      /* skip */
    }
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text(siteName, margin + (logoDataUrl ? 22 : 0), y + 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(branding.site_tagline || "Architecture & Design Services", margin + (logoDataUrl ? 22 : 0), y + 10);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("INVOICE", pageWidth - margin, y + 4, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, y + 11, { align: "right" });
  doc.text(`Issued: ${formatDisplayDate(invoice.issueDate)}`, pageWidth - margin, y + 16, { align: "right" });
  if (invoice.dueDate) {
    doc.text(`Due: ${formatDisplayDate(invoice.dueDate)}`, pageWidth - margin, y + 21, { align: "right" });
  }

  y += 28;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("BILL TO", margin, y);
  doc.text("PROJECT", pageWidth / 2 + 4, y);
  y += 5;
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.customerName, margin, y);
  doc.text(invoice.projectName, pageWidth / 2 + 4, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (invoice.customerEmail) doc.text(invoice.customerEmail, margin, y);
  if (invoice.orderNumber) doc.text(`Order: ${invoice.orderNumber}`, pageWidth / 2 + 4, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", "Unit (Nu.)", "Amount (Nu.)"]],
    body: items.map((item, i) => [
      String(i + 1).padStart(2, "0"),
      item.description,
      String(item.quantity),
      fmtNu(item.unitPrice),
      fmtNu(item.totalPrice),
    ]),
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: "center", cellWidth: 12 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y += 8;

  const totalsX = pageWidth - margin - 62;
  const rows = [
    ["Subtotal", fmtNu(invoice.subtotal)],
    ["Tax", fmtNu(invoice.taxAmount)],
    ["Discount", `- ${fmtNu(invoice.discountAmount)}`],
    ["Total", fmtNu(invoice.totalAmount)],
    ["Paid", fmtNu(invoice.amountPaid)],
    ["Balance Due", fmtNu(invoice.remainingAmount)],
  ];

  rows.forEach(([label, value], idx) => {
    const isTotal = idx === 3;
    const isDue = idx === 5;
    doc.setFont("helvetica", isTotal ? "bold" : "normal");
    doc.setFontSize(isTotal ? 11 : 9);
    doc.setTextColor(isDue ? 180 : 15, isDue ? 83 : 23, isDue ? 9 : 42);
    doc.text(label, totalsX, y);
    doc.text(`Nu. ${value}`, pageWidth - margin, y, { align: "right" });
    y += isTotal ? 7 : 5.5;
  });

  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Status: ${formatStatusLabel(invoice.paymentStatus)} · ${percentPaid(invoice)}% collected`, margin, y);

  doc.save(`architecture-invoice-${invoice.invoiceNumber}.pdf`);
}
