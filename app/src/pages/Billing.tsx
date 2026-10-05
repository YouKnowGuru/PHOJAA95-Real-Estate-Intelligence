import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { loadSiteLogoDataUrl } from "@/lib/site-branding";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AppleCard,
  AppleCardContent,
} from "@/components/ui/apple-card";
import { PageHeader } from "@/components/ui/page-header";
import { KPICard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Receipt,
  Search,
  Printer,
  Download,
  User,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  FileText,
  Wallet,
  Landmark,
  PiggyBank,
  CircleCheck,
  CircleDashed,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  FileType,
  Table2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { pdfText } from "@contracts/pdf-text";

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt = (val: string | number | null | undefined) => {
  const n = typeof val === "number" ? val : parseFloat(val ?? "0");
  if (isNaN(n)) return "Nu. 0.00";
  return `Nu. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
};

const fmtPlain = (val: string | number | null | undefined) => {
  const n = typeof val === "number" ? val : parseFloat(val ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
};

/** Human labels for every value the status filter can hold. */
const STATUS_LABELS: Record<string, string> = {
  all: "All Statuses",
  pending: "Payment Pending",
  partial: "Partially Paid",
  paid: "Fully Paid",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  approved: "Approved",
  rejected: "Rejected",
};

// ─── Payment computation ───────────────────────────────────────────────────
// New records store a single "Total Amount Paid" (entered in Step 2).
// Legacy records keep the old 50% advance + remaining split and are calculated
// exactly as before, so past data is unaffected.
function computePayments(item: BillingItem, price: number) {
  const isStep2Approved = item.currentStep >= 3;
  const isStep3Approved = item.currentStep >= 4;
  const hasTotalPaid = item.totalAmountPaid !== null && item.totalAmountPaid !== undefined;

  let totalPaid = 0;
  if (hasTotalPaid) {
    totalPaid = isStep2Approved ? parseFloat(item.totalAmountPaid || "0") : 0;
  } else {
    const hasExactPayment = item.paymentAmount !== null && item.paymentAmount !== undefined;
    const initialPayment = hasExactPayment ? parseFloat(item.paymentAmount || "0") : price / 2;
    const hasExactRemaining = item.remainingPaymentAmount !== null && item.remainingPaymentAmount !== undefined;
    const remainingPayment = hasExactRemaining
      ? parseFloat(item.remainingPaymentAmount || "0")
      : Math.max(0, price - initialPayment);
    totalPaid = (isStep2Approved ? initialPayment : 0) + (isStep3Approved ? remainingPayment : 0);
  }

  // A sale can never be paid beyond its selling price — a few legacy rows have
  // advance+remainder recorded above the price, which used to show paid > price.
  if (price > 0 && totalPaid > price) totalPaid = price;

  const balanceDue = Math.max(0, price - totalPaid);
  // Exact comparison — Math.round() used to turn 99.9998% into "100% / Fully Paid"
  // while the SQL filter still (correctly) counted the record as unpaid.
  const isFull = price > 0 ? totalPaid >= price : totalPaid > 0;
  const percentPaid = isFull ? 100 : price > 0 ? Math.min(99, Math.floor((totalPaid / price) * 100)) : 0;

  return { totalPaid, balanceDue, percentPaid, isReceived: totalPaid > 0 };
}

/** Billing cards are about money first: show how far the payment has got. */
/** Workflow state — shown alongside the payment badge so a record filtered as
 *  "Completed" never looks like it disagrees with its payment status. */
function WorkflowChip({ status }: { status: string }) {
  if (!status) return null;
  const dot =
    status === "completed"
      ? "bg-emerald-500"
      : status === "processing"
      ? "bg-blue-500"
      : status === "rejected" || status === "cancelled"
      ? "bg-red-500"
      : "bg-amber-500";

  return (
    <span
      title="Workflow status"
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/70 border border-border/60 whitespace-nowrap"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function PaymentBadge({ item }: { item: BillingItem }) {
  const price = parseFloat(item.finalSellingPrice ?? item.sellingPrice ?? "0");
  const { percentPaid } = computePayments(item, price);

  const conf =
    percentPaid >= 100
      ? {
          label: "Fully Paid",
          className:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
          icon: <CircleCheck className="h-3 w-3" />,
        }
      : percentPaid > 0
      ? {
          label: "Partially Paid",
          className:
            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
          icon: <CircleDashed className="h-3 w-3" />,
        }
      : {
          label: "Payment Pending",
          className:
            "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
          icon: <AlertCircle className="h-3 w-3" />,
        };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${conf.className}`}
    >
      {conf.icon}
      {conf.label}
    </span>
  );
}

// ─── Print / Download helpers ─────────────────────────────────────────────

function buildInvoiceHtml(item: BillingItem, branding: { siteName: string; siteLogo?: string }) {
  // Use finalSellingPrice when available (for land with negotiated price), otherwise fall back to sellingPrice
  const effectivePrice = parseFloat(item.finalSellingPrice ?? item.sellingPrice ?? "0");
  const originalPrice = parseFloat(item.sellingPrice ?? "0");
  const commission = parseFloat(item.commissionAmount ?? item.realEstateFee ?? "0");

  const { totalPaid, balanceDue, percentPaid } = computePayments(item, effectivePrice);
  const isFullyPaid = percentPaid === 100;

  const invoiceNo = `INV-${String(item.id).padStart(5, "0")}`;
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const statusColor = isFullyPaid ? "#10b981" : percentPaid >= 50 ? "#f59e0b" : "#6366f1";
  const statusBg = isFullyPaid ? "#ecfdf5" : percentPaid >= 50 ? "#fffbeb" : "#eef2ff";
  const statusText = isFullyPaid ? "Fully Paid" : percentPaid >= 50 ? "Partially Paid" : "Payment Pending";

  const hasPriceAdjustment = item.finalSellingPrice && parseFloat(item.finalSellingPrice) !== originalPrice;

  const logoHtml = branding.siteLogo
    ? `<img src="${branding.siteLogo}" alt="${branding.siteName}" style="width:40px;height:40px;object-fit:contain;border-radius:8px;" onerror="this.style.display='none'"/>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice ${invoiceNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1e293b;background:#fff}
  .page{max-width:210mm;margin:0 auto;background:#fff;padding:24px 28px}

  /* Header */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand-text{line-height:1.15}
  .brand-name{font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-0.4px}
  .brand-sub{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600}
  .invoice-meta{text-align:right}
  .invoice-badge{display:inline-block;padding:3px 10px;border-radius:999px;background:${statusBg};color:${statusColor};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;border:1px solid ${statusColor}25}
  .invoice-title{font-size:26px;font-weight:900;color:#0f172a;letter-spacing:-1.2px;line-height:1}
  .invoice-no{font-size:11px;color:#64748b;margin-top:3px;font-weight:500}

  /* Stamp */
  .stamp-wrap{position:relative}
  .stamp{position:absolute;top:-6px;right:-4px;width:90px;height:90px;border:2.5px solid ${isFullyPaid ? '#10b981' : '#cbd5e1'};border-radius:50%;display:flex;align-items:center;justify-content:center;transform:rotate(-16deg);opacity:${isFullyPaid ? 0.8 : 0.3};pointer-events:none;z-index:5}
  .stamp-inner{text-align:center}
  .stamp-text{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:${isFullyPaid ? '#10b981' : '#94a3b8'};line-height:1.1}
  .stamp-line{width:56px;height:2px;background:${isFullyPaid ? '#10b981' : '#94a3b8'};margin:3px auto}

  /* Parties + Property row */
  .info-row{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px;margin-bottom:12px}
  .info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;position:relative;overflow:hidden}
  .info-card::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:${statusColor}}
  .info-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:700;margin-bottom:3px}
  .info-name{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:1px}
  .info-detail{font-size:10px;color:#64748b;line-height:1.5}

  /* Table */
  .table-wrap{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f1f5f9;text-align:left;padding:7px 10px;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;font-weight:700;border-bottom:1px solid #e2e8f0}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155}
  tr:last-child td{border-bottom:none}
  tr.highlight td{background:#f8fafc}
  .amount{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
  .status-tag{display:inline-block;padding:1px 6px;border-radius:999px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;margin-left:4px;vertical-align:middle}
  .status-tag.paid{background:#d1fae5;color:#065f46}
  .status-tag.due{background:#fef3c7;color:#92400e}

  /* Bottom section */
  .bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}

  /* Notes */
  .notes{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:10px;color:#78350f;line-height:1.5}
  .notes-title{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#92400e;margin-bottom:3px}

  /* Totals */
  .totals{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
  .total-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;color:#475569}
  .total-row.highlight{color:#0f172a;font-weight:800;font-size:13px;border-top:1.5px solid #e2e8f0;margin-top:4px;padding-top:7px}
  .total-row.commission{color:#4f46e5;font-weight:700}
  .total-row.net{color:#0f172a;font-weight:800;font-size:13px;margin-top:3px;padding-top:6px;border-top:1px dashed #cbd5e1}
  .total-bar{height:3px;background:#e2e8f0;border-radius:2px;margin-top:6px;overflow:hidden}
  .total-bar-fill{height:100%;background:linear-gradient(90deg,${statusColor},${isFullyPaid ? '#34d399' : percentPaid >= 50 ? '#fbbf24' : '#818cf8'});border-radius:2px;width:${percentPaid}%}
  .total-pct{text-align:center;margin-top:3px;font-size:8px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}

  /* Footer */
  .footer{text-align:center;padding-top:10px;margin-top:10px;border-top:1px solid #e2e8f0}
  .footer-brand{font-size:12px;font-weight:800;color:#0f172a}
  .footer-text{font-size:9px;color:#94a3b8;line-height:1.5;margin-top:2px}
  .footer-meta{font-size:8px;color:#cbd5e1;margin-top:4px}

  /* Compact utility */
  .compact-row{display:flex;gap:10px;margin-bottom:8px}
  .compact-col{flex:1}

  @media print{
    body{background:#fff}
    .page{padding:18px 22px;max-width:100%}
  }
</style>
</head>
<body>
<div class="page">
  <div class="stamp-wrap">
    <div class="header">
      <div class="brand">
        ${logoHtml}
        <div class="brand-text">
          <div class="brand-name">${branding.siteName}</div>
          <div class="brand-sub">Real Estate Management</div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-badge">${statusText}</div>
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-no">${invoiceNo} &nbsp;&bull;&nbsp; ${today}</div>
      </div>
    </div>
    <div class="stamp">
      <div class="stamp-inner">
        <div class="stamp-text">${isFullyPaid ? 'PAID' : 'PENDING'}</div>
        <div class="stamp-line"></div>
        <div class="stamp-text" style="font-size:9px">${percentPaid}%</div>
      </div>
    </div>
  </div>

  <div class="info-row">
    <div class="info-card">
      <div class="info-label">Seller / Owner</div>
      <div class="info-name">${item.ownerName || "—"}</div>
      ${item.propertyTypeName ? `<div class="info-detail">${item.propertyTypeName}</div>` : ""}
    </div>
    <div class="info-card">
      <div class="info-label">Buyer</div>
      <div class="info-name">${item.buyerName || "Not assigned"}</div>
      <div class="info-detail">Agent: ${item.listedByName || "—"}</div>
    </div>
    <div class="info-card">
      <div class="info-label">Property</div>
      <div class="info-name" style="font-size:12px">${item.propertyName}</div>
      <div class="info-detail">ID: #${item.id} &nbsp; Status: ${item.workflowStatus?.toUpperCase() || "N/A"}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Description</th>
          <th style="width:120px" class="amount">Amount (Nu.)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>01</td>
          <td><strong>Total Selling Price</strong>${hasPriceAdjustment ? `<br/><span style="font-size:9px;color:#64748b">(Original: ${fmtPlain(originalPrice)})</span>` : ""}</td>
          <td class="amount"><strong>${fmtPlain(effectivePrice)}</strong></td>
        </tr>
        <tr>
          <td>02</td>
          <td>Total Paid <span class="status-tag ${totalPaid > 0 ? 'paid' : 'due'}">${totalPaid > 0 ? 'Received' : 'Due'}</span></td>
          <td class="amount">${fmtPlain(String(totalPaid))}</td>
        </tr>
        <tr class="highlight">
          <td></td>
          <td><strong>Balance Due</strong></td>
          <td class="amount"><strong style="color:${balanceDue > 0 ? '#b45309' : '#065f46'}">${fmtPlain(String(balanceDue))}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="bottom">
    <div class="notes">
      <div class="notes-title">Important Notice</div>
      Buyer pays full selling price. Commission (${fmtPlain(commission)}) is deducted and paid to agent. This is a computer-generated invoice valid without signature. Disputes must be raised within 7 business days.
    </div>
    <div class="totals">
      <div class="total-row">
        <span>Total Selling Price</span>
        <span>${fmtPlain(item.sellingPrice)}</span>
      </div>
      <div class="total-row">
        <span>Amount Received</span>
        <span style="color:#065f46;font-weight:700">${fmtPlain(String(totalPaid))}</span>
      </div>
      <div class="total-row">
        <span>Balance Due</span>
        <span style="color:${balanceDue > 0 ? '#b45309' : '#065f46'};font-weight:700">${fmtPlain(String(balanceDue))}</span>
      </div>
      <div class="total-row highlight">
        <span>TOTAL PAYABLE</span>
        <span>${fmtPlain(item.sellingPrice)}</span>
      </div>
      <div class="total-row commission">
        <span>Commission (3%)</span>
        <span>-${fmtPlain(commission)}</span>
      </div>
      <div class="total-row net">
        <span>Net to Seller</span>
        <span style="color:#4f46e5">${fmtPlain(String(Math.max(0, effectivePrice - commission)))}</span>
      </div>
      <div class="total-bar">
        <div class="total-bar-fill"></div>
      </div>
      <div class="total-pct">${percentPaid}% Paid</div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-brand">Thank you for choosing ${branding.siteName}</div>
    <div class="footer-text">This invoice was generated electronically and is valid without a signature.</div>
    <div class="footer-meta">© ${new Date().getFullYear()} ${branding.siteName} &nbsp;&bull;&nbsp; All rights reserved.</div>
  </div>
</div>
</body>
</html>`;
}

// ─── PDF invoice (client-side, so "Download" always yields a real .pdf) ─────

const PDF_COLORS = {
  ink: [15, 23, 42] as [number, number, number],
  body: [51, 65, 85] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  faint: [148, 163, 184] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  soft: [248, 250, 252] as [number, number, number],
  primary: [79, 70, 229] as [number, number, number],
  green: [5, 150, 105] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
};

/** jsPDF's built-in fonts are Latin-1 only — the shared normaliser turns
 *  "𝐏𝐑𝐈𝐌𝐄 𝐋𝐀𝐍𝐃" into "PRIME LAND" instead of "Ø5Ü Ø5Ü". */
const pdfSafe = (value: string) => pdfText(value);

const pdfFileSafe = (value: string) => pdfSafe(value).replace(/[^\w.-]+/g, "_") || "invoice";

const tint = (rgb: [number, number, number], amount = 0.88): [number, number, number] =>
  rgb.map((v) => Math.round(v + (255 - v) * amount)) as [number, number, number];

function buildInvoicePdf(
  item: BillingItem,
  branding: { siteName: string; siteLogo?: string },
  logoDataUrl?: string | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const C = PDF_COLORS;

  const effectivePrice = parseFloat(item.finalSellingPrice ?? item.sellingPrice ?? "0");
  const originalPrice = parseFloat(item.sellingPrice ?? "0");
  const commission = parseFloat(item.commissionAmount ?? item.realEstateFee ?? "0");
  const { totalPaid, balanceDue, percentPaid } = computePayments(item, effectivePrice);

  const isFullyPaid = percentPaid === 100;
  const statusText = isFullyPaid ? "Fully Paid" : percentPaid >= 50 ? "Partially Paid" : "Payment Pending";
  const accent = isFullyPaid ? C.green : percentPaid >= 50 ? C.amber : C.primary;
  const invoiceNo = `INV-${String(item.id).padStart(5, "0")}`;
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const hasPriceAdjustment = !!item.finalSellingPrice && parseFloat(item.finalSellingPrice) !== originalPrice;

  /* Header */
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 5, "F");

  // Site logo (when one is configured) sits left of the brand name.
  let brandX = M;
  if (logoDataUrl?.startsWith("data:image")) {
    try {
      const fmt = /^data:image\/jpe?g/i.test(logoDataUrl) ? "JPEG" : "PNG";
      doc.addImage(logoDataUrl, fmt, M, 12, 14, 14, undefined, "FAST");
      brandX = M + 18;
    } catch {
      brandX = M; // a broken logo must never break the invoice
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...C.ink);
  doc.text(pdfSafe(branding.siteName || "PHOJAA95"), brandX, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text("REAL ESTATE MANAGEMENT", brandX, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...C.ink);
  doc.text("INVOICE", W - M, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(`${invoiceNo}   |   ${today}`, W - M, 26, { align: "right" });

  /* Status pill */
  const pillW = 52;
  const pillH = 8;
  const pillX = W - M - pillW;
  const pillY = 30;
  doc.setFillColor(...tint(accent));
  doc.rect(pillX, pillY, pillW, pillH, "F");
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${statusText.toUpperCase()}  ${percentPaid}%`, pillX + pillW / 2, pillY + 5.4, { align: "center" });

  /* Party / property boxes */
  const boxY = 44;
  const boxH = 26;
  const gap = 4;
  const boxW = (W - 2 * M - 2 * gap) / 3;
  const boxes = [
    { label: "SELLER / OWNER", name: item.ownerName || "—", sub: item.propertyTypeName || "" },
    { label: "BUYER", name: item.buyerName || "Not assigned", sub: `Agent: ${item.listedByName || "—"}` },
    {
      label: "PROPERTY",
      name: item.propertyName,
      sub: `ID: #${item.id}  |  ${item.workflowStatus?.toUpperCase() || "N/A"}`,
    },
  ];

  boxes.forEach((b, i) => {
    const x = M + i * (boxW + gap);
    doc.setFillColor(...C.soft);
    doc.rect(x, boxY, boxW, boxH, "F");
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.rect(x, boxY, boxW, boxH, "S");
    doc.setFillColor(...accent);
    doc.rect(x, boxY, 1.4, boxH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.faint);
    doc.text(b.label, x + 5, boxY + 6.5);
    doc.setFontSize(10);
    doc.setTextColor(...C.ink);
    doc.text(doc.splitTextToSize(pdfSafe(b.name), boxW - 8).slice(0, 2), x + 5, boxY + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(doc.splitTextToSize(pdfSafe(b.sub), boxW - 8).slice(0, 2), x + 5, boxY + 22);
  });

  /* Line items */
  autoTable(doc, {
    startY: 78,
    head: [["#", "Description", "Amount (Nu.)"]],
    body: [
      [
        "01",
        `Total Selling Price${hasPriceAdjustment ? `  (original ${fmtPlain(originalPrice)})` : ""}`,
        fmtPlain(effectivePrice),
      ],
      ["02", `Total Paid  (${totalPaid > 0 ? "Received" : "Due"})`, fmtPlain(String(totalPaid))],
      ["03", "Balance Due", fmtPlain(String(balanceDue))],
    ],
    theme: "grid",
    headStyles: { fillColor: C.ink, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 9, textColor: C.body, cellPadding: 2.4 },
    alternateRowStyles: { fillColor: C.soft },
    styles: { lineColor: C.line, lineWidth: 0.1, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 42, halign: "right" } },
    margin: { left: M, right: M },
  });
  const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  /* Notes + totals */
  const sectionY = tableEnd + 6;
  const halfW = (W - 2 * M - gap) / 2;
  const boxH2 = 62;

  doc.setFillColor(255, 251, 235);
  doc.rect(M, sectionY, halfW, boxH2, "F");
  doc.setDrawColor(253, 230, 138);
  doc.setLineWidth(0.2);
  doc.rect(M, sectionY, halfW, boxH2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(146, 64, 14);
  doc.text("IMPORTANT NOTICE", M + 4, sectionY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 53, 15);
  doc.text(
    doc.splitTextToSize(
      `Buyer pays the full selling price. Commission (${fmtPlain(commission)}) is deducted and paid to the agent. This is a computer-generated invoice valid without signature. Disputes must be raised within 7 business days.`,
      halfW - 8
    ),
    M + 4,
    sectionY + 11
  );

  const tX = M + halfW + gap;
  doc.setFillColor(...C.soft);
  doc.rect(tX, sectionY, halfW, boxH2, "F");
  doc.setDrawColor(...C.line);
  doc.rect(tX, sectionY, halfW, boxH2, "S");

  const rows: Array<{ label: string; value: string; color?: [number, number, number]; bold?: boolean }> = [
    { label: "Total Selling Price", value: fmtPlain(item.sellingPrice) },
    { label: "Amount Received", value: fmtPlain(String(totalPaid)), color: C.green },
    { label: "Balance Due", value: fmtPlain(String(balanceDue)), color: balanceDue > 0 ? C.amber : C.green },
    { label: "TOTAL PAYABLE", value: fmtPlain(item.sellingPrice), bold: true },
    { label: "Commission (3%)", value: `-${fmtPlain(commission)}`, color: C.primary },
    { label: "Net to Seller", value: fmtPlain(String(Math.max(0, effectivePrice - commission))), color: C.primary, bold: true },
  ];

  let rowY = sectionY + 8;
  rows.forEach((row) => {
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(row.bold ? 9.5 : 8.5);
    doc.setTextColor(...(row.color ?? (row.bold ? C.ink : C.muted)));
    doc.text(row.label, tX + 5, rowY);
    doc.text(row.value, tX + halfW - 5, rowY, { align: "right" });
    rowY += 6.5;
  });

  /* Paid progress bar */
  const barX = tX + 5;
  const barW = halfW - 10;
  doc.setFillColor(226, 232, 240);
  doc.rect(barX, sectionY + boxH2 - 9, barW, 3, "F");
  doc.setFillColor(...accent);
  doc.rect(barX, sectionY + boxH2 - 9, Math.max(0, Math.min(barW, (barW * percentPaid) / 100)), 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.faint);
  doc.text(`${percentPaid}% PAID`, barX + barW / 2, sectionY + boxH2 - 2.5, { align: "center" });

  /* Footer */
  const footY = H - 26;
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.2);
  doc.line(M, footY, W - M, footY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.ink);
  doc.text(`Thank you for choosing ${pdfSafe(branding.siteName || "PHOJAA95")}`, W / 2, footY + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.faint);
  doc.text("This invoice was generated electronically and is valid without a signature.", W / 2, footY + 12, {
    align: "center",
  });
  doc.setFontSize(7);
  doc.text(`© ${new Date().getFullYear()} ${pdfSafe(branding.siteName || "PHOJAA95")}  |  All rights reserved.`, W / 2, footY + 17, {
    align: "center",
  });

  return doc;
}

async function downloadInvoice(item: BillingItem, branding: { siteName: string; siteLogo?: string }) {
  try {
    const logoDataUrl = await loadSiteLogoDataUrl(branding.siteLogo).catch(() => null);
    const doc = buildInvoicePdf(item, branding, logoDataUrl);
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${String(item.id).padStart(5, "0")}-${pdfFileSafe(item.propertyName)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    toast.error("Could not generate the invoice PDF. Please try again.");
  }
}

function printInvoice(item: BillingItem, branding: { siteName: string; siteLogo?: string }) {
  const html = buildInvoiceHtml(item, branding);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface BillingItem {
  id: number;
  propertyName: string;
  ownerName: string;
  buyerName: string | null;
  sellingPrice: string;
  realEstateFee: string;
  finalSellingPrice: string | null;
  negotiatedPrice: string | null;
  discountAmount: string | null;
  currentStep: number;
  approvalStatus: string;
  workflowStatus: string;
  createdAt: Date;
  completedAt: Date | null;
  propertyTypeName: string | null;
  listedByName: string | null;
  commissionAmount: string | null;
  paymentAmount: string | null;
  totalAmountPaid: string | null;
  agreementFile: string | null;
  paymentScreenshot: string | null;
  remainingPaymentScreenshot: string | null;
  remainingPaymentAmount: string | null;
}

// ─── Payment Step Indicator ───────────────────────────────────────────────

function PaymentSteps({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: "Listed", step: 1 },
    { label: "Agreement", step: 2 },
    { label: "Documents", step: 3 },
    { label: "Verification", step: 4 },
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const isDone = currentStep >= s.step;
        const isCurrent = currentStep === s.step;
        return (
          <div key={s.label} className="flex items-center">
            <div
              className={`flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold border-2 transition-colors ${
                isDone
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : isCurrent
                  ? "bg-primary border-primary text-white"
                  : "bg-muted border-muted-foreground/20 text-muted-foreground"
              }`}
              title={s.label}
            >
              {isDone ? <CircleCheck className="h-3 w-3" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-3 h-0.5 mx-0.5 ${
                  currentStep > s.step ? "bg-emerald-500" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Compact Invoice Card (App Store Grid Style) ──────────────────────────

function CompactInvoiceCard({ item, branding }: { item: BillingItem; branding: { siteName: string; siteLogo?: string } }) {
  const effectivePrice = parseFloat(item.finalSellingPrice ?? item.sellingPrice ?? "0");
  const { totalPaid, percentPaid } = computePayments(item, effectivePrice);

  const invoiceNo = `INV-${String(item.id).padStart(5, "0")}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm shadow-apple-sm hover:shadow-apple-md hover:-translate-y-1 transition-all duration-300"
    >
      {/* Top accent */}
      <div className={`h-1 w-full ${percentPaid === 100 ? "bg-emerald-500" : percentPaid >= 50 ? "bg-amber-500" : "bg-primary"}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-primary tracking-widest uppercase">{invoiceNo}</p>
              <p className="text-sm font-bold text-foreground truncate max-w-[160px]">{item.propertyName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <PaymentBadge item={item} />
            <WorkflowChip status={item.workflowStatus} />
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {percentPaid}% Paid
            </span>
            <PaymentSteps currentStep={item.currentStep} />
          </div>
          <Progress value={percentPaid} className="h-1.5 bg-muted/60 rounded-full" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Selling Price</p>
            <p className="text-sm font-bold text-foreground">{fmt(item.sellingPrice)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-800/30 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">Total Paid</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmt(String(totalPaid))}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="flex items-center gap-2 mb-4 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">{item.ownerName}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">{item.buyerName || "No buyer"}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-[11px] h-8 rounded-lg hover:bg-muted transition-colors"
            onClick={() => printInvoice(item, branding)}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-[11px] h-8 rounded-lg bg-primary hover:bg-primary/90 text-white"
            onClick={() => downloadInvoice(item, branding)}
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Link to={`/properties/${item.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary">
              <FileText className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────

function SummarySkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted/60 animate-pulse" />
        ))}
      </div>
      <div className="h-24 rounded-2xl bg-muted/60 animate-pulse" />
    </div>
  );
}

function InvoiceSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[420px] rounded-2xl bg-muted/60 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function Billing() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 12;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: branding } = trpc.settings.getPublicSettings.useQuery(undefined, { staleTime: Infinity });
  const siteName = branding?.site_name || "PHOJAA95";
  const siteLogo = branding?.site_logo || undefined;

  const { data, isLoading } = trpc.property.getBillingList.useQuery({
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    page,
    limit,
  });

  const items: BillingItem[] = (data?.items ?? []) as BillingItem[];

  const totalSellingPrice = parseFloat(data?.totals?.totalSellingPrice ?? "0");
  const totalCommission = parseFloat(data?.totals?.totalCommission ?? "0");
  const totalPaymentAmount = parseFloat(data?.totals?.totalPaymentAmount ?? "0");
  const totalRemaining = parseFloat(data?.totals?.totalRemainingDue ?? "0");

  const collectionRate =
    totalSellingPrice > 0 ? Math.min(100, (totalPaymentAmount / totalSellingPrice) * 100) : 0;
  const rateTone =
    collectionRate >= 70
      ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/25"
      : collectionRate >= 40
      ? "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/25"
      : "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/25";
  const rateLabel = collectionRate >= 70 ? "Healthy" : collectionRate >= 40 ? "On track" : "Needs attention";

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("all");
    setPage(1);
  };
  const hasActiveFilters = Boolean(debouncedSearch) || status !== "all";

  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState<null | "csv" | "json" | "pdf" | "xlsx">(null);

  const handleExport = async (format: "csv" | "json" | "pdf" | "xlsx") => {
    if (exporting) return;
    setExporting(format);
    try {
      const result = await utils.client.property.exportBilling.query({
        search: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        format,
      });

      if (format === "csv" && "csv" in result && typeof result.csv === "string") {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
      } else if (format === "json" && "data" in result) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("JSON exported successfully");
      } else if (format === "pdf" && "pdfBase64" in result && typeof result.pdfBase64 === "string") {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `billing-report-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("PDF exported successfully");
      } else if (format === "xlsx" && "xlsxBase64" in result && typeof result.xlsxBase64 === "string") {
        const bytes = atob(result.xlsxBase64);
        const byteArray = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) byteArray[i] = bytes.charCodeAt(i);
        const blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Excel file exported successfully");
      } else {
        // Never fail silently — this used to look like "the button does nothing"
        toast.error(`Export failed: the server returned an unexpected ${format.toUpperCase()} response.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

    const regularItems = items;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Billing & Invoices"
        description={`Full financial breakdown for all property transactions`}
        icon={<Receipt className="h-5 w-5" />}
      />

      {/* Summary Cards */}
      {isLoading ? (
        <SummarySkeleton />
      ) : (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KPICard
              title="Total Sales Value"
              value={totalSellingPrice}
              prefix="Nu."
              subtitle={`Across ${data?.total ?? 0} propert${(data?.total ?? 0) !== 1 ? "ies" : "y"}`}
              icon={Landmark}
              color="bg-primary"
              delay={0}
            />
            <KPICard
              title="Payments Received"
              value={totalPaymentAmount}
              prefix="Nu."
              subtitle="Amount collected so far"
              icon={Wallet}
              color="bg-emerald-500"
              delay={0.05}
            />
            <KPICard
              title="Outstanding Balance"
              value={totalRemaining}
              prefix="Nu."
              subtitle="Still to be collected"
              icon={DollarSign}
              color="bg-amber-500"
              delay={0.1}
            />
            <KPICard
              title="Total Commission"
              value={totalCommission}
              prefix="Nu."
              subtitle="Real estate fees earned"
              icon={PiggyBank}
              color="bg-violet-500"
              delay={0.15}
            />
          </div>

          {/* Collection rate — single full-width strip */}
          <AppleCard hover={false} className="overflow-hidden">
            <AppleCardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Collection Rate
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {fmt(totalPaymentAmount)} received of {fmt(totalSellingPrice)} billed
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {collectionRate.toFixed(1)}%
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border border-transparent ${rateTone}`}
                  >
                    {rateLabel}
                  </span>
                </div>
              </div>
              <Progress value={collectionRate} className="h-2 rounded-full bg-muted/60" />
            </AppleCardContent>
          </AppleCard>
        </div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <AppleCard hover={false} className="overflow-hidden">
          <AppleCardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[140px] sm:min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by property, owner or buyer..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 bg-background/50 rounded-xl border-border/40"
                />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[170px] bg-background/50 rounded-xl border-border/40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{STATUS_LABELS.all}</SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      Payment status
                    </SelectLabel>
                    <SelectItem value="pending">{STATUS_LABELS.pending}</SelectItem>
                    <SelectItem value="partial">{STATUS_LABELS.partial}</SelectItem>
                    <SelectItem value="paid">{STATUS_LABELS.paid}</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      Workflow status
                    </SelectLabel>
                    <SelectItem value="processing">{STATUS_LABELS.processing}</SelectItem>
                    <SelectItem value="completed">{STATUS_LABELS.completed}</SelectItem>
                    <SelectItem value="cancelled">{STATUS_LABELS.cancelled}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <span className="hidden sm:inline text-xs font-medium text-muted-foreground tabular-nums mr-1">
                  {data?.total ?? 0} record{(data?.total ?? 0) === 1 ? "" : "s"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs rounded-xl border-border/40"
                  disabled={isLoading || !!exporting}
                  onClick={() => handleExport("csv")}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  {exporting === "csv" ? "Exporting..." : "CSV"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs rounded-xl border-border/40"
                  disabled={isLoading || !!exporting}
                  onClick={() => handleExport("xlsx")}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {exporting === "xlsx" ? "Exporting..." : "Excel"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs rounded-xl border-border/40"
                  disabled={isLoading || !!exporting}
                  onClick={() => handleExport("json")}
                >
                  <FileJson className="h-3.5 w-3.5" />
                  {exporting === "json" ? "Exporting..." : "JSON"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs rounded-xl border-border/40"
                  disabled={isLoading || !!exporting}
                  onClick={() => handleExport("pdf")}
                >
                  <FileType className="h-3.5 w-3.5" />
                  {exporting === "pdf" ? "Exporting..." : "PDF"}
                </Button>
              </div>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/40">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Active filters
                </span>
                {debouncedSearch && (
                  <Badge variant="secondary" className="gap-1 pr-1.5 rounded-lg">
                    <Search className="h-3 w-3" />
                    {debouncedSearch}
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearch("");
                        setDebouncedSearch("");
                        setPage(1);
                      }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {status !== "all" && (
                  <Badge variant="secondary" className="gap-1 pr-1.5 rounded-lg">
                    {STATUS_LABELS[status] ?? status}
                    <button
                      type="button"
                      aria-label="Clear status filter"
                      onClick={() => {
                        setStatus("all");
                        setPage(1);
                      }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              </div>
            )}
          </AppleCardContent>
        </AppleCard>
      </motion.div>

      {/* Invoice Grid */}
      {isLoading ? (
        <InvoiceSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={hasActiveFilters ? "No matching billing records" : "No billing records yet"}
          description={
            hasActiveFilters
              ? "Nothing matches the current search and status filters. Try widening them, or clear them to see everything."
              : "Properties with payment data will appear here as soon as transactions start."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 rounded-xl">
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${debouncedSearch}-${status}-${page}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {regularItems.map((item) => (
                <CompactInvoiceCard key={item.id} item={item} branding={{ siteName, siteLogo }} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap items-center justify-center gap-2 pt-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="gap-1 rounded-xl border-border/40"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: data?.totalPages ?? 1 }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === (data?.totalPages ?? 1) || Math.abs(p - page) <= 1)
              .map((p, i, arr) => (
                <div key={p} className="flex items-center gap-1">
                  {i > 0 && arr[i - 1] !== p - 1 && (
                    <span className="text-muted-foreground px-1">...</span>
                  )}
                  <Button
                    variant={page === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(p)}
                    className="h-8 w-8 p-0 text-xs rounded-xl"
                  >
                    {p}
                  </Button>
                </div>
              ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
            className="gap-1 rounded-xl border-border/40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
