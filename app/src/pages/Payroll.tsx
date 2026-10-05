import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatStaffRoleLabel, PAYROLL_ELIGIBLE_ROLES } from "@/lib/role-routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CheckCircle2, FileText, Trash2, Eye, Wallet, PiggyBank, Banknote, AlertCircle, PackageOpen, Search, Users, BarChart3 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PayslipModal } from "@/components/PayrollTable";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { KPICard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";

export default function PayrollPage() {
  const { user, isAdmin } = useAuth();
  const utils = trpc.useUtils();
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" }).substring(0, 7);
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<"all" | "staff" | "architecture_staff" | "developer">("all");
  const [viewMode, setViewMode] = useState<"entries" | "staff-totals">("entries");
  const [staffTotalsSearch, setStaffTotalsSearch] = useState("");
  const [staffTotalsTeam, setStaffTotalsTeam] = useState<"all" | "staff" | "architecture_staff" | "developer">("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [showAdd, setShowAdd] = useState(false);
  type PayrollItem = RouterOutputs["payroll"]["list"]["items"][number];
  type MyPayrollItem = RouterOutputs["payroll"]["myPayroll"][number];
  type AnyPayrollItem = PayrollItem | MyPayrollItem;
  const [selectedPayslip, setSelectedPayslip] = useState<AnyPayrollItem | null>(null);
  const [payrollForm, setPayrollForm] = useState({
    userId: "",
    month: currentMonth,
    baseSalary: "",
    bonus: "0",
    deduction: "0",
    pfPercentage: "",
    notes: "",
    deductionNotes: "",
  });

  const { data: payrollList, isLoading: payrollLoading } = trpc.payroll.list.useQuery(
    {
      month: selectedMonth === "all" ? undefined : selectedMonth,
      status: statusFilter === "all" ? undefined : statusFilter,
      role: teamFilter === "all" ? undefined : teamFilter,
      search: debouncedSearch || undefined,
    },
    { enabled: isAdmin }
  );

  const { data: myPayroll, isLoading: myPayrollLoading } = trpc.payroll.myPayroll.useQuery(
    {
      month: selectedMonth === "all" ? undefined : selectedMonth,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    { enabled: !isAdmin }
  );

  const { data: summary } = trpc.payroll.salarySummary.useQuery(
    {
      month: selectedMonth === "all" ? undefined : selectedMonth,
      role: teamFilter === "all" ? undefined : teamFilter,
    },
    { enabled: isAdmin }
  );

  const { data: staffList } = trpc.user.list.useQuery(
    { roles: [...PAYROLL_ELIGIBLE_ROLES], limit: 200, status: "active" },
    { enabled: isAdmin }
  );

  const { data: staffTotals, isLoading: staffTotalsLoading } = trpc.payroll.staffTotals.useQuery(
    {
      role: staffTotalsTeam === "all" ? undefined : staffTotalsTeam,
      search: staffTotalsSearch.trim() || undefined,
    },
    { enabled: isAdmin && viewMode === "staff-totals" }
  );

  const payrollItems = isAdmin ? payrollList?.items : myPayroll;

  const createMutation = trpc.payroll.create.useMutation({
    onSuccess: () => {
      toast.success("Payroll entry created");
      setShowAdd(false);
      utils.payroll.list.invalidate();
      utils.payroll.myPayroll.invalidate();
      utils.payroll.salarySummary.invalidate();
      setPayrollForm({
        userId: "",
        month: currentMonth,
        baseSalary: "",
        bonus: "0",
        deduction: "0",
        pfPercentage: "",
        notes: "",
        deductionNotes: "",
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaidMutation = trpc.payroll.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Marked as paid");
      utils.payroll.list.invalidate();
      utils.payroll.salarySummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.payroll.delete.useMutation({
    onSuccess: () => {
      toast.success("Payroll entry deleted");
      utils.payroll.list.invalidate();
      utils.payroll.salarySummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: branding } = trpc.settings.getPublicSettings.useQuery();
  const { data: dbMonths } = trpc.payroll.distinctMonths.useQuery();

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    (dbMonths || []).forEach((m) => set.add(m));
    for (let m = 1; m <= 12; m++) {
      set.add(`${currentYear}-${String(m).padStart(2, "0")}`);
      set.add(`${currentYear - 1}-${String(m).padStart(2, "0")}`);
    }
    return Array.from(set).sort().reverse();
  }, [dbMonths, currentYear]);

  const generatePayslipPDF = async (item: AnyPayrollItem) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const siteName = branding?.site_name || "PHOJAA95";
    const siteLogo = branding?.site_logo;

    const primary: [number, number, number] = [16, 185, 129];
    const primaryDark: [number, number, number] = [5, 150, 105];
    const dark: [number, number, number] = [15, 23, 42];
    const gray: [number, number, number] = [100, 116, 139];
    const lightGray: [number, number, number] = [241, 245, 249];
    const white: [number, number, number] = [255, 255, 255];
    const red: [number, number, number] = [239, 68, 68];
    const redDark: [number, number, number] = [220, 38, 38];

    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, 6, "F");
    doc.setFillColor(...dark);
    doc.rect(0, 6, pageWidth, 42, "F");

    let headerTextY = 20;
    if (siteLogo) {
      try {
        const img = new Image();
        img.src = siteLogo;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          setTimeout(resolve, 2000);
        });
        doc.addImage(img, "PNG", 14, 12, 28, 28, undefined, "FAST");
        headerTextY = 22;
      } catch {
        // Fallback
      }
    }

    doc.setFontSize(20);
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    const logoOffset = siteLogo ? 44 : 14;
    doc.text(siteName.toUpperCase(), logoOffset, headerTextY);

    doc.setFontSize(9);
    doc.setTextColor(...primary);
    doc.setFont("helvetica", "normal");
    doc.text("P A Y S L I P", logoOffset, headerTextY + 7);

    const monthText = (() => {
      const [y, m] = item.month.split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[parseInt(m) - 1]} ${y}`;
    })();
    doc.setFontSize(10);
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    const monthTextWidth = doc.getTextWidth(monthText) + 16;
    const monthX = pageWidth - monthTextWidth - 14;
    doc.setFillColor(...primary);
    doc.roundedRect(monthX, 14, monthTextWidth, 14, 3, 3, "F");
    doc.text(monthText, monthX + monthTextWidth / 2, 23, { align: "center" });

    doc.setDrawColor(...primary);
    doc.setLineWidth(0.8);
    doc.line(14, 50, pageWidth - 14, 50);

    let y = 60;
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "normal");
    doc.text("EMPLOYEE DETAILS", 14, y);
    y += 2;
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(14, y, pageWidth - 14, y);
    y += 7;

    const empName = item.userName || user?.name || "Employee";
    const empId = item.employeeId || "N/A";
    const pfNum = item.pfNumber || "N/A";
    const status = item.paymentStatus?.toUpperCase() || "PENDING";
    const paidDate = item.paidAt ? new Date(item.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

    doc.setFontSize(9);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.text("Name:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(empName, 40, y);

    doc.setFont("helvetica", "bold");
    doc.text("Employee ID:", 110, y);
    doc.setFont("helvetica", "normal");
    doc.text(empId, 145, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("PF Number:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(pfNum, 40, y);

    doc.setFont("helvetica", "bold");
    doc.text("Status:", 110, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...(status === "PAID" ? primary : red));
    doc.text(status, 145, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Paid Date:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(paidDate, 40, y);

    y += 12;
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "normal");
    doc.text("SALARY BREAKDOWN", 14, y);
    y += 2;
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(14, y, pageWidth - 14, y);

    const baseSalary = parseFloat(item.baseSalary) || 0;
    const bonus = parseFloat(item.bonus) || 0;
    const deduction = parseFloat(item.deduction) || 0;
    const pfDeduction = parseFloat(item.pfDeduction || "0") || 0;
    const netSalary = parseFloat(item.netSalary) || 0;
    const totalEarnings = baseSalary + bonus;
    const totalDeductions = deduction + pfDeduction;

    autoTable(doc, {
      startY: y + 4,
      margin: { left: 14, right: 14 },
      head: [["Description", "Amount (Nu.)"]],
      body: [
        [{ content: "EARNINGS", styles: { fillColor: primary, textColor: white, fontStyle: "bold", fontSize: 8 } }, { content: "", styles: { fillColor: primary, textColor: white } }],
        ["Base Salary", baseSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
        ["Bonus / Incentives", bonus.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
        [{ content: "Total Earnings", styles: { fontStyle: "bold", textColor: primaryDark } }, { content: totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 }), styles: { fontStyle: "bold", textColor: primaryDark } }],
        [{ content: "", styles: { fillColor: lightGray } }, { content: "", styles: { fillColor: lightGray } }],
        [{ content: "DEDUCTIONS", styles: { fillColor: red, textColor: white, fontStyle: "bold", fontSize: 8 } }, { content: "", styles: { fillColor: red, textColor: white } }],
        [`PF Deduction (${item.pfPercentage || "0"}%)`, `-${pfDeduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
        ["Other Deductions", `-${deduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
        ...(item.deductionNotes ? [[`  Notes: ${item.deductionNotes}`, ""]] : []),
        [{ content: "Total Deductions", styles: { fontStyle: "bold", textColor: redDark } }, { content: `-${totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, styles: { fontStyle: "bold", textColor: redDark } }],
      ],
      theme: "grid",
      headStyles: { fillColor: dark, textColor: white, fontSize: 9, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: "right", cellWidth: 60 } },
      styles: { fontSize: 9, cellPadding: 3, lineColor: lightGray, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const tableFinalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 60;
    const netBoxY = tableFinalY + 8;
    const netBoxHeight = 22;

    doc.setFillColor(...dark);
    doc.roundedRect(14, netBoxY, pageWidth - 28, netBoxHeight, 3, 3, "F");
    doc.setFillColor(...primary);
    doc.roundedRect(14, netBoxY, 4, netBoxHeight, 3, 3, "F");

    doc.setFontSize(10);
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.text("NET SALARY PAYABLE", 24, netBoxY + 9);

    doc.setFontSize(14);
    doc.setTextColor(...primary);
    doc.text(`Nu. ${netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, pageWidth - 20, netBoxY + 10, { align: "right" });

    const footerY = Math.min(netBoxY + netBoxHeight + 15, pageHeight - 25);
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "italic");
    doc.text(`This is a computer-generated payslip issued by ${siteName} and does not require a signature.`, pageWidth / 2, footerY + 5, { align: "center" });
    doc.text(`Generated on ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, footerY + 10, { align: "center" });

    doc.setFillColor(...primary);
    doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

    doc.save(`Payslip_${empName.replace(/\s+/g, "_")}_${item.month}.pdf`);
    toast.success("PDF Payslip Generated Successfully");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Payroll"
        description="Salary management and payment tracking"
        icon={<Wallet className="h-5 w-5" />}
        actions={
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            {isAdmin && (
              <div className="relative min-w-[160px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search staff..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 sm:h-9 pl-8 pr-3 rounded-xl border border-border/40 bg-background/50 text-xs sm:text-sm font-medium"
                />
              </div>
            )}
            {isAdmin && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value as typeof teamFilter)}
                className="h-10 sm:h-9 rounded-xl border border-border/40 bg-background/50 px-3 text-xs sm:text-sm w-full sm:w-auto font-medium"
              >
                <option value="all">All teams</option>
                <option value="staff">Real Estate</option>
                <option value="architecture_staff">Architecture</option>
                <option value="developer">Software Dev</option>
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-10 sm:h-9 rounded-xl border border-border/40 bg-background/50 px-3 text-xs sm:text-sm w-full sm:w-auto font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid Only</option>
              <option value="pending">Pending Only</option>
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 sm:h-9 rounded-xl border border-border/40 bg-background/50 px-3 text-xs sm:text-sm w-full sm:w-auto font-medium"
            >
              <option value="all">All Months (All Time)</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {isAdmin && viewMode === "entries" && (
              <Button onClick={() => setShowAdd(true)} className="h-10 sm:h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-xl w-full sm:w-auto shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Add Payroll
              </Button>
            )}
          </div>
        }
      />

      {/* View Mode Toggle (Admin only) */}
      {isAdmin && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === "entries" ? "default" : "outline"}
            onClick={() => setViewMode("entries")}
            className="rounded-xl h-9 text-xs gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Payroll Entries
          </Button>
          <Button
            size="sm"
            variant={viewMode === "staff-totals" ? "default" : "outline"}
            onClick={() => setViewMode("staff-totals")}
            className="rounded-xl h-9 text-xs gap-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            Staff Totals
          </Button>
        </div>
      )}

      {/* Staff Totals View */}
      {isAdmin && viewMode === "staff-totals" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff..."
                value={staffTotalsSearch}
                onChange={(e) => setStaffTotalsSearch(e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-xl border border-border/40 bg-background/50 text-xs font-medium outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <select
              value={staffTotalsTeam}
              onChange={(e) => setStaffTotalsTeam(e.target.value as typeof staffTotalsTeam)}
              className="h-9 rounded-xl border border-border/40 bg-background/50 px-3 text-xs font-medium"
            >
              <option value="all">All Teams</option>
              <option value="staff">Real Estate</option>
              <option value="architecture_staff">Architecture</option>
              <option value="developer">Software Dev</option>
            </select>
          </div>

          {/* Table */}
          {staffTotalsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : staffTotals && staffTotals.length > 0 ? (
            <AppleCard hover={false} className="overflow-hidden">
              <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Individual Staff — Total Paid Salary</h3>
                </div>
                <span className="text-xs text-muted-foreground">{staffTotals.length} staff member{staffTotals.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Staff</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Months Paid</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total Base</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total Bonus</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total Ded.</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total PF</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total Net Paid</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Pending Net</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Last Paid Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffTotals.map((row) => (
                      <tr key={row.userId} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium">{row.userName || "—"}</div>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {row.userRole && (
                              <Badge variant="outline" className="text-[10px] rounded-md">
                                {formatStaffRoleLabel(row.userRole as string)}
                              </Badge>
                            )}
                            {row.employeeId && <span className="text-[10px] text-muted-foreground">ID: {row.employeeId}</span>}
                            {row.pfNumber && <span className="text-[10px] text-muted-foreground">PF: {row.pfNumber}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-primary">{row.paidMonthsCount}</span>
                          {(row.pendingMonthsCount ?? 0) > 0 && (
                            <div className="text-[10px] text-amber-500">{row.pendingMonthsCount} pending</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">Nu. {parseFloat(row.totalBase).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-medium">+{parseFloat(row.totalBonus).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-red-500">-{parseFloat(row.totalDeduction).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-amber-600">-{parseFloat(row.totalPF).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-foreground text-base">Nu. {parseFloat(row.totalPaidNet).toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {parseFloat(row.totalPendingNet) > 0 ? (
                            <span className="text-amber-600 font-medium">Nu. {parseFloat(row.totalPendingNet).toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {row.lastPaidMonth ? (
                            <div>
                              <span className="font-mono text-xs">{row.lastPaidMonth}</span>
                              {row.lastPaidAt && (
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(row.lastPaidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-primary/20 bg-primary/5">
                      <td className="py-3 px-4 font-semibold text-sm">Grand Total</td>
                      <td className="py-3 px-4 text-right font-semibold text-primary">
                        {staffTotals.reduce((s, r) => s + (r.paidMonthsCount ?? 0), 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        Nu. {staffTotals.reduce((s, r) => s + parseFloat(r.totalBase || "0"), 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        +{staffTotals.reduce((s, r) => s + parseFloat(r.totalBonus || "0"), 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-red-500">
                        -{staffTotals.reduce((s, r) => s + parseFloat(r.totalDeduction || "0"), 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-600">
                        -{staffTotals.reduce((s, r) => s + parseFloat(r.totalPF || "0"), 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-primary text-base">
                          Nu. {staffTotals.reduce((s, r) => s + parseFloat(r.totalPaidNet || "0"), 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-600">
                        Nu. {staffTotals.reduce((s, r) => s + parseFloat(r.totalPendingNet || "0"), 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="block md:hidden divide-y divide-border/20">
                {staffTotals.map((row) => (
                  <div key={row.userId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-base">{row.userName || "—"}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {row.userRole && (
                            <Badge variant="outline" className="text-[10px] rounded-md">{formatStaffRoleLabel(row.userRole as string)}</Badge>
                          )}
                          {row.employeeId && <span className="text-[10px] text-muted-foreground">ID: {row.employeeId}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground">Months Paid</div>
                        <div className="font-bold text-primary text-lg">{row.paidMonthsCount}</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Net Paid (All Time)</div>
                      <div className="text-xl font-bold text-foreground">Nu. {parseFloat(row.totalPaidNet).toLocaleString()}</div>
                      {parseFloat(row.totalPendingNet) > 0 && (
                        <div className="text-xs text-amber-600 mt-0.5">+ Nu. {parseFloat(row.totalPendingNet).toLocaleString()} pending</div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-xl p-2.5 border border-border/30">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Total Base</span>
                        <span className="font-semibold">Nu. {parseFloat(row.totalBase).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Total Bonus</span>
                        <span className="font-semibold text-emerald-600">+{parseFloat(row.totalBonus).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Deductions</span>
                        <span className="font-semibold text-red-500">-{parseFloat(row.totalDeduction).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">PF</span>
                        <span className="font-semibold text-amber-600">-{parseFloat(row.totalPF).toLocaleString()}</span>
                      </div>
                    </div>
                    {row.lastPaidMonth && (
                      <div className="text-xs text-muted-foreground">
                        Last paid: <span className="font-mono font-medium text-foreground">{row.lastPaidMonth}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AppleCard>
          ) : (
            <EmptyState icon={PackageOpen} title="No staff data" description="No payroll records found for the selected filters." />
          )}
        </div>
      )}

      {/* Summary Cards + Payroll Table — only in Entries mode */}
      {(!isAdmin || viewMode === "entries") && (
        <>
          {/* Summary Cards for Admin */}
          {isAdmin && (
            summary ? (
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
                <KPICard title="Total Base" value={`Nu. ${parseFloat(summary.totalBase).toLocaleString()}`} icon={Wallet} color="bg-primary" delay={0} />
                <KPICard title="Total PF" value={`Nu. ${parseFloat(summary.totalPF || "0").toLocaleString()}`} icon={PiggyBank} color="bg-amber-500" delay={0.05} />
                <KPICard title="Total Net" value={`Nu. ${parseFloat(summary.totalNet).toLocaleString()}`} icon={Banknote} color="bg-emerald-500" delay={0.1} />
                <KPICard title="Paid" value={summary.totalPaid} icon={CheckCircle2} color="bg-blue-500" delay={0.15} />
                <KPICard title="Pending" value={summary.totalPending} icon={AlertCircle} color="bg-red-500" delay={0.2} className="min-[400px]:col-span-2 sm:col-span-1 md:col-span-1 lg:col-span-1" />
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className={`h-28 rounded-2xl ${i === 4 ? "min-[400px]:col-span-2 sm:col-span-1 md:col-span-1 lg:col-span-1" : ""}`} />
                ))}
              </div>
            )
          )}

          {/* Payroll Table & Mobile Cards */}
          {(isAdmin ? payrollLoading : myPayrollLoading) ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : payrollItems && payrollItems.length > 0 ? (
            <AppleCard hover={false} className="overflow-hidden">
              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/30 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {isAdmin
                    ? (selectedMonth === "all" ? "All Payroll Payments" : `Payroll Entries (${selectedMonth})`)
                    : (selectedMonth === "all" ? "All Payslips" : `My Payslips (${selectedMonth})`)}
                </h3>
                <span className="text-xs text-muted-foreground">{payrollItems.length} {payrollItems.length === 1 ? "entry" : "entries"}</span>
              </div>

              {/* Desktop Table View (visible on md+) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm min-w-[780px]">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Staff</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Month</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Base</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Bonus</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ded.</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">PF Ded.</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Net</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollItems.map((item) => (
                      <tr key={item.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium">{item.userName || "You"}</div>
                          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground mt-0.5">
                            {isAdmin && (item as PayrollItem).userRole != null && (
                              <Badge variant="outline" className="text-[10px] rounded-md">
                                {formatStaffRoleLabel((item as PayrollItem).userRole as string)}
                              </Badge>
                            )}
                            {item.employeeId && <span>ID: {item.employeeId}</span>}
                            {item.pfNumber && <span>PF: {item.pfNumber}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{item.month}</td>
                        <td className="py-3 px-4 text-right">Nu. {parseFloat(item.baseSalary).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-medium">+{parseFloat(item.bonus).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-red-500 font-medium">-{parseFloat(item.deduction).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-amber-600">
                          <div>-{parseFloat(item.pfDeduction || "0").toLocaleString()}</div>
                          <div className="text-[10px] text-muted-foreground">({item.pfPercentage || "0"}%)</div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-foreground">Nu. {parseFloat(item.netSalary).toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={item.paymentStatus === "paid" ? "default" : "secondary"}
                            className={`text-[10px] rounded-lg capitalize ${item.paymentStatus === "paid"
                                ? "bg-emerald-600/10 text-emerald-600 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              }`}
                          >
                            {item.paymentStatus}
                          </Badge>
                          {item.paidAt && (
                            <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                              {new Date(item.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              onClick={() => setSelectedPayslip(item)}
                              title="View Payslip"
                            >
                              <Eye className="h-4 w-4 text-emerald-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              onClick={() => generatePayslipPDF(item)}
                              title="Download PDF"
                            >
                              <FileText className="h-4 w-4 text-blue-500" />
                            </Button>

                            {isAdmin && (
                              <>
                                {item.paymentStatus === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-lg text-xs bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                    onClick={() => markPaidMutation.mutate({ id: item.id })}
                                    disabled={markPaidMutation.isPending}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                                    Pay
                                  </Button>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : ""}
                                  </span>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this payroll entry?")) {
                                      deleteMutation.mutate({ id: item.id });
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                  title="Delete Entry"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (visible on < md) */}
              <div className="block md:hidden divide-y divide-border/20">
                {payrollItems.map((item) => (
                  <div key={item.id} className="p-4 space-y-3 hover:bg-muted/15 transition-colors">
                    {/* Employee Info Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-base text-foreground truncate">
                          {item.userName || "You"}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                          {isAdmin && (item as PayrollItem).userRole != null && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">
                              {formatStaffRoleLabel((item as PayrollItem).userRole as string)}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md font-mono">
                            {item.month}
                          </Badge>
                          {item.employeeId && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">ID: {item.employeeId}</span>}
                          {item.pfNumber && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">PF: {item.pfNumber}</span>}
                        </div>
                      </div>
                      <Badge
                        variant={item.paymentStatus === "paid" ? "default" : "secondary"}
                        className={`shrink-0 capitalize text-[10px] px-2.5 py-0.5 rounded-full ${item.paymentStatus === "paid"
                            ? "bg-emerald-600/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          }`}
                      >
                        {item.paymentStatus}
                      </Badge>
                    </div>

                    {/* Net Salary Highlight */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <div>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Net Payable</span>
                        <span className="text-base sm:text-lg font-bold text-foreground">
                          Nu. {parseFloat(item.netSalary).toLocaleString()}
                        </span>
                      </div>
                      {item.paidAt && (
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Paid Date</span>
                          <span className="text-xs font-medium text-foreground">
                            {new Date(item.paidAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Salary Breakdown Mini-Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-xl p-2.5 border border-border/30">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Base</span>
                        <span className="font-semibold text-foreground">Nu. {parseFloat(item.baseSalary).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Bonus</span>
                        <span className="font-semibold text-emerald-600">+{parseFloat(item.bonus).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Deduction</span>
                        <span className="font-semibold text-red-500">-{parseFloat(item.deduction).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">PF ({item.pfPercentage || "0"}%)</span>
                        <span className="font-semibold text-amber-600">-{parseFloat(item.pfDeduction || "0").toLocaleString()}</span>
                      </div>
                    </div>

                    {item.deductionNotes && (
                      <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 border border-border/20">
                        <span className="font-medium text-foreground">Ded. note:</span> {item.deductionNotes}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-xs rounded-xl"
                        onClick={() => setSelectedPayslip(item)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-xs rounded-xl"
                        onClick={() => generatePayslipPDF(item)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                        PDF
                      </Button>
                      {isAdmin && item.paymentStatus === "pending" && (
                        <Button
                          size="sm"
                          className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                          onClick={() => markPaidMutation.mutate({ id: item.id })}
                          disabled={markPaidMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Pay
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl shrink-0"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this payroll entry?")) {
                              deleteMutation.mutate({ id: item.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          title="Delete Entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AppleCard>
          ) : (
            <EmptyState
              icon={PackageOpen}
              title="No records found"
              description={isAdmin ? "No payroll entries found for the selected filter." : "You have no payslips for the selected filter."}
            />
          )}
        </>
      )}

      {/* Add Payroll Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
            <DialogTitle>Add Payroll Entry</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={payrollForm.userId} onValueChange={(v) => setPayrollForm({ ...payrollForm, userId: v })}>
                <SelectTrigger className="rounded-xl border-border/40 bg-background/50 h-10"><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staffList?.items.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.fullName} ({formatStaffRoleLabel(u.role)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month *</Label>
              <Input value={payrollForm.month} onChange={(e) => setPayrollForm({ ...payrollForm, month: e.target.value })} className="rounded-xl border-border/40 bg-background/50 h-10" />
            </div>
            <div className="space-y-2">
              <Label>Base Salary (Nu.) *</Label>
              <Input type="number" value={payrollForm.baseSalary} onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })} className="rounded-xl border-border/40 bg-background/50 h-10" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bonus</Label>
                <Input type="number" value={payrollForm.bonus} onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })} className="rounded-xl border-border/40 bg-background/50 h-10" />
              </div>
              <div className="space-y-2">
                <Label>PF Percentage (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={payrollForm.pfPercentage || (() => {
                      const staff = staffList?.items.find((u) => u.id.toString() === payrollForm.userId);
                      return staff?.pfPercentage || "0";
                    })()}
                    onChange={(e) => setPayrollForm({ ...payrollForm, pfPercentage: e.target.value })}
                    className="flex-1 rounded-xl border-border/40 bg-background/50 h-10"
                  />
                  <div className="flex items-center justify-center px-3 rounded-xl bg-muted/40 border border-border/40 min-w-0">
                    <span className="text-[10px] font-bold text-amber-600">
                      {(() => {
                        const staff = staffList?.items.find((u) => u.id.toString() === payrollForm.userId);
                        const pfPercent = payrollForm.pfPercentage ? parseFloat(payrollForm.pfPercentage) : (staff ? parseFloat(staff.pfPercentage || "0") : 0);
                        const base = parseFloat(payrollForm.baseSalary || "0");
                        return `Nu. ${(base * pfPercent / 100).toLocaleString()}`;
                      })()}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 italic">
                  Defaults to staff's configured rate. You can override it here.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Other Deduction</Label>
              <Input type="number" value={payrollForm.deduction} onChange={(e) => setPayrollForm({ ...payrollForm, deduction: e.target.value })} className="rounded-xl border-border/40 bg-background/50 h-10" />
            </div>
            <div className="space-y-2">
              <Label>Other Deduction Notes</Label>
              <Textarea
                value={payrollForm.deductionNotes}
                onChange={(e) => setPayrollForm({ ...payrollForm, deductionNotes: e.target.value })}
                placeholder="Reason for other deduction (e.g., advance, late fine)"
                rows={2}
                className="rounded-xl border-border/40 bg-background/50"
              />
            </div>
          </div>
          <div className="p-4 sm:px-5 sm:py-3 bg-muted/30 border-t border-border/30 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl h-10 sm:h-9 w-full sm:w-auto">Cancel</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-sm rounded-xl h-10 sm:h-9 w-full sm:w-auto"
              onClick={() => {
                if (!payrollForm.userId || !payrollForm.baseSalary) {
                  toast.error("Please fill required fields");
                  return;
                }
                createMutation.mutate({
                  userId: parseInt(payrollForm.userId),
                  month: payrollForm.month,
                  baseSalary: payrollForm.baseSalary,
                  bonus: payrollForm.bonus,
                  deduction: payrollForm.deduction,
                  pfPercentage: payrollForm.pfPercentage || undefined,
                  notes: payrollForm.notes,
                  deductionNotes: payrollForm.deductionNotes,
                });
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payslip Modal */}
      <PayslipModal
        open={!!selectedPayslip}
        onOpenChange={(open) => {
          if (!open) setSelectedPayslip(null);
        }}
        record={selectedPayslip}
      />
    </div>
  );
}
