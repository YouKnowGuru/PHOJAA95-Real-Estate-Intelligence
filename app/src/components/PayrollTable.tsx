import { Download, X, User, Calendar, Wallet, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import { format, isValid } from "date-fns";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogFooter } from "./ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface PayrollRecord {
  id: number;
  userId: number;
  userName?: string;
  month: string;
  baseSalary: string;
  bonus: string;
  deduction: string;
  netSalary: string;
  pfDeduction?: string;
  pfPercentage?: string;
  paymentStatus: "pending" | "paid";
  paidAt?: Date | string;
  employeeId?: string;
  pfNumber?: string;
  notes?: string;
  deductionNotes?: string;
}

interface PayslipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: PayrollRecord | null;
}

export function PayslipModal({ open, onOpenChange, record }: PayslipModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!record || !mounted) return null;

  const baseSalary = Number(record.baseSalary) || 0;
  const bonus = Number(record.bonus) || 0;
  const deduction = Number(record.deduction) || 0;
  const pfDeduction = Number(record.pfDeduction || "0") || 0;
  const netSalary = Number(record.netSalary) || 0;
  const totalEarnings = baseSalary + bonus;
  const totalDeductions = deduction + pfDeduction;
  const pfPercentage = record.pfPercentage || "0";

  const monthDate = new Date(record.month + "-01");
  const monthLabel = isValid(monthDate) ? format(monthDate, "MMMM yyyy") : record.month;
  const paidDateRaw = record.paidAt ? new Date(record.paidAt) : null;
  const paidDate = paidDateRaw && isValid(paidDateRaw) ? format(paidDateRaw, "MMM d, yyyy") : null;

  const handleDownload = () => {
    const content = `
PHOJAA95 REAL ESTATE - PAYSLIP
=============================

Employee: ${record.userName || `User #${record.userId}`}
Month: ${monthLabel}
Payment Status: ${record.paymentStatus.toUpperCase()}
${paidDate ? `Paid On: ${paidDate}` : ""}

================================
EARNINGS
================================
Base Salary:     ${formatCurrency(record.baseSalary)}
Bonus:          ${formatCurrency(record.bonus)}
                ---------------
Total Earnings:  ${formatCurrency(totalEarnings.toString())}

================================
DEDUCTIONS
================================
PF Deduction (${pfPercentage}%):  ${formatCurrency(pfDeduction.toString())}
Other Deductions:     ${formatCurrency(record.deduction)}
${record.deductionNotes ? `Deduction Notes:      ${record.deductionNotes}` : ""}
                ---------------
Total Deductions:  ${formatCurrency(totalDeductions.toString())}

================================
NET SALARY:     ${formatCurrency(record.netSalary)}
================================

Notes: ${record.notes || "None"}

Generated: ${format(new Date(), "MMMM d, yyyy HH:mm")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${record.userName || record.userId}-${record.month}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const earningItems = [
    { label: "Base Salary", value: baseSalary, icon: Wallet },
    { label: "Bonus / Incentives", value: bonus, icon: TrendingUp },
  ].filter(item => item.value > 0 || item.label === "Base Salary");

  const deductionItems = [
    { label: `PF Deduction (${pfPercentage}%)`, value: pfDeduction },
    { label: "Other Deductions", value: deduction, notes: record.deductionNotes },
  ].filter(item => item.value > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        {/* Gradient Header */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-8">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />

          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>

          {/* Payslip title */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Payslip</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{monthLabel}</h2>
          </div>

          {/* Employee info */}
          <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400">Employee</p>
                <p className="text-sm font-medium text-white truncate">{record.userName || `User #${record.userId}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400">Status</p>
                <Badge variant={record.paymentStatus === "paid" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                  {record.paymentStatus === "paid" ? "Paid" : "Pending"}
                </Badge>
              </div>
            </div>
            {record.employeeId && (
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                <div className="h-3.5 w-3.5 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                  <span className="text-[8px] text-white font-bold">#</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400">Employee ID</p>
                  <p className="text-sm font-medium text-white">{record.employeeId}</p>
                </div>
              </div>
            )}
            {record.pfNumber && (
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                <div className="h-3.5 w-3.5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] text-amber-400 font-bold">PF</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400">PF Number</p>
                  <p className="text-sm font-medium text-white">{record.pfNumber}</p>
                </div>
              </div>
            )}
          </div>

          {paidDate && (
            <p className="relative text-[10px] text-slate-400 mt-3">
              Paid on {paidDate}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 bg-slate-50 dark:bg-slate-900">
          {/* Net Salary Hero */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20"
          >
            <p className="text-xs font-medium text-emerald-100">Net Salary Payable</p>
            <p className="text-3xl font-bold mt-1">Nu. {netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </motion.div>

          {/* Earnings */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Earnings</span>
              <span className="ml-auto text-sm font-bold text-emerald-600 dark:text-emerald-400">
                +Nu. {totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="space-y-2">
              {earningItems.map((item, i) => {
                const percentage = totalEarnings > 0 ? (item.value / totalEarnings) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Nu. {item.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Deductions */}
          {deductionItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Deductions</span>
                <span className="ml-auto text-sm font-bold text-red-600 dark:text-red-400">
                  -Nu. {totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="space-y-2">
                {deductionItems.map((item, i) => {
                  const percentage = totalDeductions > 0 ? (item.value / totalDeductions) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-400">
                          {item.label}
                          {(item as any).notes && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">{(item as any).notes}</span>
                          )}
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          -Nu. {item.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                          className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Notes */}
          {record.notes && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3"
            >
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Notes</p>
              <p className="text-xs text-amber-600 dark:text-amber-300/80">{record.notes}</p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleDownload} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-sm shadow-emerald-500/20">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
