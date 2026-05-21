import { useState } from "react";
import type { ElementType } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CheckCircle2, FileText, Trash2, Eye, Wallet, PiggyBank, Banknote, AlertCircle, PackageOpen } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion } from "framer-motion";
import { PayslipModal } from "@/components/PayrollTable";

function SummaryCard({ title, value, color, icon: Icon, delay = 0 }: { title: string; value: string | number; color: string; icon: ElementType; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      <motion.div whileHover={{ y: -4 }} className="group relative overflow-hidden border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
        <Card className="border-0 bg-transparent shadow-none">
          <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
                <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default function PayrollPage() {
  const { user, isAdmin } = useAuth();
  const utils = trpc.useUtils();
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" }).substring(0, 7);
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
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
    { month: selectedMonth },
    { enabled: isAdmin }
  );

  const { data: myPayroll, isLoading: myPayrollLoading } = trpc.payroll.myPayroll.useQuery(
    { month: selectedMonth },
    { enabled: !isAdmin }
  );

  const { data: summary } = trpc.payroll.salarySummary.useQuery(
    { month: selectedMonth },
    { enabled: isAdmin }
  );

  const { data: staffList } = trpc.user.list.useQuery(
    { role: "staff", limit: 100 },
    { enabled: isAdmin }
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

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${currentYear}-${String(m).padStart(2, "0")}`;
  });

  const generatePayslipPDF = async (item: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const siteName = branding?.site_name || "PHOJAA95";
    const siteLogo = branding?.site_logo;

    // Color palette
    const primary = [16, 185, 129];
    const primaryDark = [5, 150, 105];
    const dark = [15, 23, 42];
    const gray = [100, 116, 139];
    const lightGray = [241, 245, 249];
    const white = [255, 255, 255];

    // Top accent bar
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, 6, "F");

    // Header background
    doc.setFillColor(...dark);
    doc.rect(0, 6, pageWidth, 42, "F");

    // Logo
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
        // Fallback to text
      }
    }

    // Company name
    doc.setFontSize(20);
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    const logoOffset = siteLogo ? 44 : 14;
    doc.text(siteName.toUpperCase(), logoOffset, headerTextY);

    // Subtitle
    doc.setFontSize(9);
    doc.setTextColor(...primary);
    doc.setFont("helvetica", "normal");
    doc.text("P A Y S L I P", logoOffset, headerTextY + 7);

    // Month badge on right
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

    // Divider line
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.8);
    doc.line(14, 50, pageWidth - 14, 50);

    // Employee info section
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
    doc.setTextColor(...(status === "PAID" ? primary : [239, 68, 68]));
    doc.text(status, 145, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Paid Date:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(paidDate, 40, y);

    // Earnings & Deductions table
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
        [{ content: "EARNINGS", styles: { fillColor: [...primary], textColor: white, fontStyle: "bold", fontSize: 8 } }, { content: "", styles: { fillColor: [...primary], textColor: white } }],
        ["Base Salary", baseSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
        ["Bonus / Incentives", bonus.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
        [{ content: "Total Earnings", styles: { fontStyle: "bold", textColor: primaryDark } }, { content: totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 }), styles: { fontStyle: "bold", textColor: primaryDark } }],
        [{ content: "", styles: { fillColor: lightGray } }, { content: "", styles: { fillColor: lightGray } }],
        [{ content: "DEDUCTIONS", styles: { fillColor: [239, 68, 68], textColor: white, fontStyle: "bold", fontSize: 8 } }, { content: "", styles: { fillColor: [239, 68, 68], textColor: white } }],
        [`PF Deduction (${item.pfPercentage || "0"}%)`, `-${pfDeduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
        ["Other Deductions", `-${deduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
        ...(item.deductionNotes ? [[`  Notes: ${item.deductionNotes}`, ""]] : []),
        [{ content: "Total Deductions", styles: { fontStyle: "bold", textColor: [220, 38, 38] } }, { content: `-${totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, styles: { fontStyle: "bold", textColor: [220, 38, 38] } }],
      ],
      theme: "grid",
      headStyles: { fillColor: [...dark], textColor: white, fontSize: 9, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: "right", cellWidth: 60 },
      },
      styles: { fontSize: 9, cellPadding: 3, lineColor: lightGray, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    // Net Salary box
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

    // Footer
    const footerY = Math.min(netBoxY + netBoxHeight + 15, pageHeight - 25);
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "italic");
    doc.text(`This is a computer-generated payslip issued by ${siteName} and does not require a signature.`, pageWidth / 2, footerY + 5, { align: "center" });
    doc.text(`Generated on ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, footerY + 10, { align: "center" });

    // Bottom accent bar
    doc.setFillColor(...primary);
    doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

    doc.save(`Payslip_${empName.replace(/\s+/g, "_")}_${item.month}.pdf`);
    toast.success("PDF Payslip Generated Successfully");
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Payroll
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Salary management and payment tracking</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-border bg-white/50 px-3 py-2 text-sm dark:bg-slate-800"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {isAdmin && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />
                Add Payroll
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Summary Cards for Admin */}
      {isAdmin && (
        summary ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard title="Total Base" value={`Nu. ${parseFloat(summary.totalBase).toLocaleString()}`} color="bg-primary" icon={Wallet} delay={0} />
            <SummaryCard title="Total PF" value={`Nu. ${parseFloat(summary.totalPF || "0").toLocaleString()}`} color="bg-amber-500" icon={PiggyBank} delay={0.1} />
            <SummaryCard title="Total Net" value={`Nu. ${parseFloat(summary.totalNet).toLocaleString()}`} color="bg-emerald-500" icon={Banknote} delay={0.2} />
            <SummaryCard title="Paid" value={summary.totalPaid} color="bg-blue-500" icon={CheckCircle2} delay={0.3} />
            <SummaryCard title="Pending" value={summary.totalPending} color="bg-red-500" icon={AlertCircle} delay={0.4} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )
      )}

      {/* Payroll Table */}
      {(isAdmin ? payrollLoading : myPayrollLoading) ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : payrollItems && payrollItems.length > 0 ? (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isAdmin ? "All Payroll Entries" : "My Payslips"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Staff</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Month</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Base</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Bonus</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ded.</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">PF Ded.</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Net</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollItems.map((item: any) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="py-2 px-3">
                        <div className="font-medium">{item.userName || "You"}</div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                          {item.employeeId && <span>ID: {item.employeeId}</span>}
                          {item.pfNumber && <span>PF: {item.pfNumber}</span>}
                        </div>
                      </td>
                      <td className="py-2 px-3">{item.month}</td>
                      <td className="py-2 px-3 text-right">{parseFloat(item.baseSalary).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-primary">+{parseFloat(item.bonus).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-red-500">-{parseFloat(item.deduction).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-amber-600">
                        <div>-{parseFloat(item.pfDeduction || "0").toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">({item.pfPercentage || "0"}%)</div>
                      </td>
                      <td className="py-2 px-3 text-right font-bold">{parseFloat(item.netSalary).toLocaleString()}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={item.paymentStatus === "paid" ? "default" : "secondary"} className="text-[10px]">
                          {item.paymentStatus}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedPayslip(item)}
                            title="View Payslip"
                          >
                            <Eye className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => generatePayslipPDF(item)}
                            title="Download PDF"
                          >
                            <FileText className="h-4 w-4 text-blue-500" />
                          </Button>

                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              {item.paymentStatus === "pending" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => markPaidMutation.mutate({ id: item.id })}
                                  disabled={markPaidMutation.isPending}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
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
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
            <CardContent className="py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-bold text-foreground">No records found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {isAdmin
                  ? "No payroll entries found for the selected month."
                  : "You have no payslips for the selected month."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add Payroll Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payroll Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={payrollForm.userId} onValueChange={(v) => setPayrollForm({ ...payrollForm, userId: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staffList?.items.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month *</Label>
              <Input value={payrollForm.month} onChange={(e) => setPayrollForm({ ...payrollForm, month: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base Salary (Nu.) *</Label>
              <Input type="number" value={payrollForm.baseSalary} onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bonus</Label>
                <Input type="number" value={payrollForm.bonus} onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>PF Percentage (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={payrollForm.pfPercentage || (() => {
                      const staff = staffList?.items.find((u: any) => u.id.toString() === payrollForm.userId);
                      return staff?.pfPercentage || "0";
                    })()}
                    onChange={(e) => setPayrollForm({ ...payrollForm, pfPercentage: e.target.value })}
                    className="flex-1"
                  />
                  <div className="flex items-center justify-center px-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border min-w-0">
                    <span className="text-[10px] font-bold text-amber-600">
                      {(() => {
                        const staff = staffList?.items.find((u: any) => u.id.toString() === payrollForm.userId);
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
              <Input type="number" value={payrollForm.deduction} onChange={(e) => setPayrollForm({ ...payrollForm, deduction: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Other Deduction Notes</Label>
              <Textarea
                value={payrollForm.deductionNotes}
                onChange={(e) => setPayrollForm({ ...payrollForm, deductionNotes: e.target.value })}
                placeholder="Reason for other deduction (e.g., advance, late fine)"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20"
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
