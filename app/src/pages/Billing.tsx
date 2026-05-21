import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Search,
  Printer,
  Download,
  Building2,
  User,
  TrendingUp,
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
  PackageOpen,
  FileSpreadsheet,
  FileJson,
  FileType,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router";

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt = (val: string | number | null | undefined) => {
  const n = typeof val === "number" ? val : parseFloat(val ?? "0");
  if (isNaN(n)) return "Nu. 0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "BTN",
    currencyDisplay: "name",
  })
    .format(n)
    .replace("Bhutanese ngultrum", "Nu.");
};

const fmtPlain = (val: string | number | null | undefined) => {
  const n = typeof val === "number" ? val : parseFloat(val ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
};

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    pending: { label: "Pending", variant: "outline", icon: <CircleDashed className="h-3 w-3" /> },
    processing: { label: "Processing", variant: "secondary", icon: <TrendingUp className="h-3 w-3" /> },
    completed: { label: "Completed", variant: "default", icon: <CircleCheck className="h-3 w-3" /> },
    rejected: { label: "Rejected", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
    cancelled: { label: "Cancelled", variant: "outline", icon: <AlertCircle className="h-3 w-3" /> },
    approved: { label: "Approved", variant: "default", icon: <CircleCheck className="h-3 w-3" /> },
  };
  const conf = configs[status] ?? { label: status, variant: "outline" as const, icon: null };
  return (
    <Badge variant={conf.variant} className="gap-1 capitalize">
      {conf.icon}
      {conf.label}
    </Badge>
  );
}

// ─── Print / Download helpers ─────────────────────────────────────────────

function buildInvoiceHtml(item: BillingItem, branding: { siteName: string; siteLogo?: string }) {
  const sellingPrice = parseFloat(item.sellingPrice ?? "0");
  const hasExactPayment = item.paymentAmount !== null && item.paymentAmount !== undefined;
  const initialPayment = hasExactPayment ? parseFloat(item.paymentAmount || "0") : sellingPrice / 2;
  const hasExactRemaining = item.remainingPaymentAmount !== null && item.remainingPaymentAmount !== undefined;
  const remainingPayment = hasExactRemaining ? parseFloat(item.remainingPaymentAmount || "0") : Math.max(0, sellingPrice - initialPayment);
  const commission = parseFloat(item.commissionAmount ?? item.realEstateFee ?? "0");

  const isStep2Approved = item.currentStep >= 3;
  const isStep3Approved = item.currentStep >= 4;

  const initialReceived = isStep2Approved ? initialPayment : 0;
  const remainingReceived = isStep3Approved ? remainingPayment : 0;
  const totalReceived = initialReceived + remainingReceived;
  const balanceDue = Math.max(0, sellingPrice - totalReceived);
  const percentPaid = sellingPrice > 0 ? Math.round((totalReceived / sellingPrice) * 100) : 0;
  const isFullyPaid = percentPaid === 100;

  const invoiceNo = `INV-${String(item.id).padStart(5, "0")}`;
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const statusColor = isFullyPaid ? "#10b981" : percentPaid >= 50 ? "#f59e0b" : "#6366f1";
  const statusBg = isFullyPaid ? "#ecfdf5" : percentPaid >= 50 ? "#fffbeb" : "#eef2ff";
  const statusText = isFullyPaid ? "Fully Paid" : percentPaid >= 50 ? "Partially Paid" : "Payment Pending";

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
          <td><strong>Total Selling Price</strong></td>
          <td class="amount"><strong>${fmtPlain(item.sellingPrice)}</strong></td>
        </tr>
        <tr>
          <td>02</td>
          <td>Initial Payment <span class="status-tag ${isStep2Approved ? 'paid' : 'due'}">${isStep2Approved ? 'Received' : 'Due'}</span></td>
          <td class="amount">${fmtPlain(String(initialPayment))}</td>
        </tr>
        <tr>
          <td>03</td>
          <td>Remaining Payment <span class="status-tag ${isStep3Approved ? 'paid' : 'due'}">${isStep3Approved ? 'Received' : 'Due'}</span></td>
          <td class="amount">${fmtPlain(String(remainingPayment))}</td>
        </tr>
        <tr class="highlight">
          <td></td>
          <td><strong>Total Paid</strong></td>
          <td class="amount"><strong style="color:#065f46">${fmtPlain(String(totalReceived))}</strong></td>
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
        <span style="color:#065f46;font-weight:700">${fmtPlain(String(totalReceived))}</span>
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
        <span style="color:#4f46e5">${fmtPlain(String(Math.max(0, sellingPrice - commission)))}</span>
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

function printInvoice(item: BillingItem, branding: { siteName: string; siteLogo?: string }) {
  const html = buildInvoiceHtml(item, branding);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

function downloadInvoice(item: BillingItem, branding: { siteName: string; siteLogo?: string }) {
  const html = buildInvoiceHtml(item, branding);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice-${String(item.id).padStart(5, "0")}-${item.propertyName.replace(/\s+/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface BillingItem {
  id: number;
  propertyName: string;
  ownerName: string;
  buyerName: string | null;
  sellingPrice: string;
  realEstateFee: string;
  currentStep: number;
  approvalStatus: string;
  workflowStatus: string;
  createdAt: Date;
  completedAt: Date | null;
  propertyTypeName: string | null;
  listedByName: string | null;
  commissionAmount: string | null;
  paymentAmount: string | null;
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
    { label: "Initial", step: 3 },
    { label: "Final", step: 4 },
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

// ─── Invoice Card ─────────────────────────────────────────────────────────

function InvoiceCard({ item, branding }: { item: BillingItem; branding: { siteName: string; siteLogo?: string } }) {
  const sellingPrice = parseFloat(item.sellingPrice ?? "0");
  const hasExactPayment = item.paymentAmount !== null && item.paymentAmount !== undefined;
  const initialPayment = hasExactPayment ? parseFloat(item.paymentAmount || "0") : sellingPrice / 2;
  const hasExactRemaining = item.remainingPaymentAmount !== null && item.remainingPaymentAmount !== undefined;
  const remainingPayment = hasExactRemaining ? parseFloat(item.remainingPaymentAmount || "0") : Math.max(0, sellingPrice - initialPayment);
  const commission = parseFloat(item.commissionAmount ?? item.realEstateFee ?? "0");

  const isStep2Approved = item.currentStep >= 3;
  const isStep3Approved = item.currentStep >= 4;

  const initialReceived = isStep2Approved ? initialPayment : 0;
  const remainingReceived = isStep3Approved ? remainingPayment : 0;
  const totalReceived = initialReceived + remainingReceived;
  const balanceDue = Math.max(0, sellingPrice - totalReceived);
  const percentPaid = sellingPrice > 0 ? Math.round((totalReceived / sellingPrice) * 100) : 0;

  const invoiceNo = `INV-${String(item.id).padStart(5, "0")}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${percentPaid === 100 ? "bg-emerald-500" : percentPaid >= 50 ? "bg-amber-500" : "bg-primary"}`} />

      {/* Invoice Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-primary tracking-wide">{invoiceNo}</p>
            <p className="text-sm font-bold text-foreground truncate max-w-[200px]">{item.propertyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={item.workflowStatus} />
          <Link to={`/properties/${item.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
              <FileText className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Payment Progress */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment Progress</span>
          <span className={`text-xs font-bold ${percentPaid === 100 ? "text-emerald-600" : "text-foreground"}`}>{percentPaid}%</span>
        </div>
        <Progress value={percentPaid} className="h-2 bg-muted/60" />
        <div className="flex items-center justify-between mt-2">
          <PaymentSteps currentStep={item.currentStep} />
          <span className="text-[10px] text-muted-foreground">{isStep3Approved ? "Fully Paid" : isStep2Approved ? "Partially Paid" : "Awaiting Payment"}</span>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-3 px-5 py-3 bg-slate-50/60 dark:bg-slate-900/30 border-y border-border/30">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Owner / Seller</p>
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium text-foreground truncate">{item.ownerName}</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Buyer</p>
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium text-foreground truncate">{item.buyerName || <span className="text-muted-foreground italic">Not assigned</span>}</p>
          </div>
        </div>
      </div>

      {/* Billing Breakdown */}
      <div className="px-5 py-4 space-y-3">
        <BillingRow
          label="Total Selling Price"
          value={fmt(item.sellingPrice)}
          accent="text-foreground font-bold"
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          highlight
        />

        <div className="rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/40 p-3 space-y-2">
          <BillingRow
            label={`Initial Payment ${isStep2Approved ? "✓" : ""}`}
            sublabel={isStep2Approved ? "Received" : `Pending${hasExactPayment ? "" : " • est. 50%"}`}
            value={fmt(String(initialPayment))}
            accent={isStep2Approved ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground"}
            icon={<TrendingUp className={`h-3.5 w-3.5 ${isStep2Approved ? "text-emerald-500" : "text-muted-foreground/50"}`} />}
          />
          <BillingRow
            label={`Remaining Payment ${isStep3Approved ? "✓" : ""}`}
            sublabel={isStep3Approved ? "Received" : `Pending${hasExactRemaining ? "" : " • est. 50%"}`}
            value={fmt(String(remainingPayment))}
            accent={isStep3Approved ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400 font-semibold"}
            icon={<TrendingUp className={`h-3.5 w-3.5 ${isStep3Approved ? "text-emerald-500" : "text-amber-500/60"}`} />}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Total Paid</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmt(String(totalReceived))}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 ${balanceDue > 0 ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40" : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${balanceDue > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>Balance Due</p>
            <p className={`text-sm font-bold ${balanceDue > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{fmt(String(balanceDue))}</p>
          </div>
        </div>

        <Separator className="opacity-40" />

        <BillingRow
          label="Agent Commission (3%)"
          sublabel="Paid by seller to agent"
          value={`-${fmt(commission)}`}
          accent="text-red-500 font-semibold"
          icon={<Building2 className="h-3.5 w-3.5 text-red-400" />}
        />

        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50/50 dark:from-emerald-950/30 dark:to-emerald-950/10 border border-emerald-200/70 dark:border-emerald-800/50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Net to Seller</span>
          <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{fmt(String(Math.max(0, sellingPrice - commission)))}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 pb-5 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5 text-xs hover:bg-muted transition-colors"
          onClick={() => printInvoice(item, branding)}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-white shadow-sm"
          onClick={() => downloadInvoice(item, branding)}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </div>
    </motion.div>
  );
}

function BillingRow({
  label,
  sublabel,
  value,
  accent,
  icon,
  highlight,
}: {
  label: string;
  sublabel?: string;
  value: string;
  accent: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${highlight ? "py-0.5" : ""}`}>
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className={`text-sm ${highlight ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground/70">{sublabel}</p>}
        </div>
      </div>
      <p className={`text-xs sm:text-sm shrink-0 truncate max-w-[120px] sm:max-w-none ${accent}`}>{value}</p>
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  sub,
  color,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="group relative overflow-hidden border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
      >
        <Card className="border-0 bg-transparent shadow-none">
          <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 sm:space-y-2 min-w-0">
                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{title}</p>
                <h3 className="text-lg sm:text-2xl font-black tracking-tight text-foreground truncate">{value}</h3>
                {sub && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{sub}</p>}
              </div>
              <div className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${color} bg-opacity-10 dark:bg-opacity/20`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ))}
    </div>
  );
}

function InvoiceSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[520px] rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function Billing() {
  const { isAdmin } = useAuth();
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

  const formatK = (n: number) => `Nu. ${(n / 1000).toFixed(0)}K`;

  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState<null | "csv" | "json" | "pdf">(null);

  const handleExport = async (format: "csv" | "json" | "pdf") => {
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
      }
    } catch (err: any) {
      toast.error(err?.message || "Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="h-7 w-7 text-primary" />
            Billing &amp; Invoices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full financial breakdown for all {isAdmin ? "" : "your "}property transactions
          </p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      {isLoading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard
            title="Total Sales Value"
            value={formatK(totalSellingPrice)}
            sub={`Across ${data?.total ?? 0} propert${(data?.total ?? 0) !== 1 ? "ies" : "y"}`}
            color="bg-primary"
            icon={Landmark}
            delay={0}
          />
          <SummaryCard
            title="Payments Received"
            value={formatK(totalPaymentAmount)}
            sub="Actual payments received"
            color="bg-emerald-500"
            icon={Wallet}
            delay={0.05}
          />
          <SummaryCard
            title="Outstanding Balance"
            value={formatK(totalRemaining)}
            sub="Remaining amount due"
            color="bg-amber-500"
            icon={DollarSign}
            delay={0.1}
          />
          <SummaryCard
            title="Total Commission"
            value={formatK(totalCommission)}
            sub="Real estate fees"
            color="bg-violet-500"
            icon={PiggyBank}
            delay={0.15}
          />
        </div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[140px] sm:min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by property, owner or buyer..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 bg-background/50"
                />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[170px] bg-background/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={isLoading || !!exporting}
                  onClick={() => handleExport("csv")}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {exporting === "csv" ? "Exporting..." : "CSV"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={isLoading || !!exporting}
                  onClick={() => handleExport("json")}
                >
                  <FileJson className="h-3.5 w-3.5" />
                  {exporting === "json" ? "Exporting..." : "JSON"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={isLoading || !!exporting}
                  onClick={() => handleExport("pdf")}
                >
                  <FileType className="h-3.5 w-3.5" />
                  {exporting === "pdf" ? "Exporting..." : "PDF"}
                </Button>
              </div>
              {debouncedSearch && (
                <Badge variant="secondary" className="h-9 px-3 gap-1">
                  <Search className="h-3 w-3" />
                  {debouncedSearch}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invoice Grid */}
      {isLoading ? (
        <InvoiceSkeleton />
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
            <CardContent className="py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-bold text-foreground">No billing records found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Properties with payment data will appear here. Try adjusting your filters or search terms.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${debouncedSearch}-${status}-${page}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {items.map((item) => (
              <InvoiceCard key={item.id} item={item} branding={{ siteName, siteLogo }} />
            ))}
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
            className="gap-1"
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
                    className="h-8 w-8 p-0 text-xs"
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
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
