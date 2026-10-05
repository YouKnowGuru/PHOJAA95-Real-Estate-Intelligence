import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import type { PayrollEligibleRole } from "@/lib/role-routing";
import { formatStaffRoleLabel } from "@/lib/role-routing";
import { SoftwareTabPanel } from "@/components/software-dev";
import { AppleCard } from "@/components/ui/apple-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PayslipModal } from "@/components/PayrollTable";
import { toast } from "sonner";
import { CheckCircle2, Eye, ExternalLink, Plus, Trash2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type PayrollItem = RouterOutputs["payroll"]["list"]["items"][number];

export type ModulePayrollTabProps = {
  isAdmin: boolean;
  teamRole: PayrollEligibleRole;
  teamName: string;
  infoCardClassName?: string;
  infoLinkClassName?: string;
};

export function ModulePayrollTab({
  isAdmin,
  teamRole,
  teamName,
  infoCardClassName,
  infoLinkClassName,
}: ModulePayrollTabProps) {
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" }).substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollItem | null>(null);
  const [payrollForm, setPayrollForm] = useState({
    userId: "",
    month: currentMonth,
    baseSalary: "",
    bonus: "0",
    deduction: "0",
    pfPercentage: "",
  });
  const utils = trpc.useUtils();

  const { data: myPayroll, isLoading: myLoading } = trpc.payroll.myPayroll.useQuery(
    { month: selectedMonth === "all" ? undefined : (selectedMonth || undefined) },
    { enabled: !isAdmin }
  );

  const { data: teamPayroll, isLoading: adminLoading } = trpc.payroll.list.useQuery(
    { month: selectedMonth === "all" ? undefined : (selectedMonth || undefined), role: teamRole },
    { enabled: isAdmin }
  );

  const { data: teamStaff } = trpc.user.list.useQuery(
    { role: teamRole, status: "active", limit: 100 },
    { enabled: isAdmin && showAdd }
  );

  const createMutation = trpc.payroll.create.useMutation({
    onSuccess: () => {
      toast.success(`${teamName} payroll entry created`);
      setShowAdd(false);
      utils.payroll.list.invalidate();
      utils.payroll.myPayroll.invalidate();
      setPayrollForm({ userId: "", month: currentMonth, baseSalary: "", bonus: "0", deduction: "0", pfPercentage: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaidMutation = trpc.payroll.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Marked as paid");
      utils.payroll.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.payroll.delete.useMutation({
    onSuccess: () => {
      toast.success("Payroll entry deleted");
      utils.payroll.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = isAdmin ? teamPayroll?.items : myPayroll;
  const loading = isAdmin ? adminLoading : myLoading;

  return (
    <SoftwareTabPanel className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isAdmin ? `${teamName} Staff Payroll` : "My Payslips"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            {isAdmin
              ? `Manage ${teamName.toLowerCase()} team salaries through the central payroll system. Entries also appear on the main Payroll page.`
              : "View your salary records from the company payroll system."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Input
              type="month"
              value={selectedMonth === "all" ? "" : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || "all")}
              className="h-10 sm:h-9 w-full sm:w-[150px]"
            />
            {selectedMonth !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedMonth("all")}
                className="h-10 sm:h-9 text-xs text-muted-foreground whitespace-nowrap"
                title="View all payments till now"
              >
                All time
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setSelectedMonth(currentMonth)}
                className="h-10 sm:h-9 text-xs whitespace-nowrap"
                title="View current month"
              >
                This month
              </Button>
            )}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button size="sm" onClick={() => setShowAdd(true)} className="flex-1 sm:flex-initial h-10 sm:h-9">
                <Plus className="mr-1 h-4 w-4" />
                Add payroll
              </Button>
              <Button size="sm" variant="outline" asChild className="flex-1 sm:flex-initial h-10 sm:h-9">
                <Link to="/payroll">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Full payroll
                </Link>
              </Button>
            </div>
          )}
          {!isAdmin && (
            <Button size="sm" variant="outline" asChild className="w-full sm:w-auto h-10 sm:h-9">
              <Link to="/payroll">Open payslips page</Link>
            </Button>
          )}
        </div>
      </div>

      {isAdmin && (
        <AppleCard
          hover={false}
          className={cn(
            "border-primary/20 bg-primary/5 p-4",
            infoCardClassName
          )}
        >
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Connected to admin payroll.</span>{" "}
            {teamName} staff use the same payroll records as all other teams. Create entries here or on{" "}
            <Link to="/payroll" className={cn("underline text-primary", infoLinkClassName)}>Payroll</Link>.
          </p>
        </AppleCard>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <AppleCard hover={false} className="overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Staff</th>}
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Month</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net (Nu.)</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/20">
                    {isAdmin && <td className="px-4 py-3 font-medium">{item.userName}</td>}
                    <td className="px-4 py-3 font-mono text-xs">{item.month}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      Nu. {parseFloat(item.netSalary).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={item.paymentStatus === "paid" ? "default" : "secondary"}
                        className={`capitalize text-[10px] ${
                          item.paymentStatus === "paid"
                            ? "bg-emerald-600/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}
                      >
                        {item.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={() => setSelectedPayslip(item as PayrollItem)}
                          className="h-8 w-8 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        >
                          <Eye className="h-4 w-4 text-emerald-500" />
                        </Button>
                        {isAdmin && item.paymentStatus === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            onClick={() => markPaidMutation.mutate({ id: item.id })}
                            disabled={markPaidMutation.isPending}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
                            Pay
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Delete"
                            onClick={() => {
                              if (window.confirm("Delete this payroll entry?")) {
                                deleteMutation.mutate({ id: item.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-border/20">
            {items.map((item) => (
              <div key={item.id} className="p-4 space-y-3 hover:bg-muted/15 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {isAdmin && (
                      <div className="font-semibold text-base text-foreground truncate">
                        {item.userName}
                      </div>
                    )}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md font-mono mt-0.5">
                      {item.month}
                    </Badge>
                  </div>
                  <Badge
                    variant={item.paymentStatus === "paid" ? "default" : "secondary"}
                    className={`capitalize text-[10px] px-2.5 py-0.5 rounded-full ${
                      item.paymentStatus === "paid"
                        ? "bg-emerald-600/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}
                  >
                    {item.paymentStatus}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Net Payable</span>
                  <span className="text-base font-bold text-foreground">
                    Nu. {parseFloat(item.netSalary).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9 text-xs rounded-xl"
                    onClick={() => setSelectedPayslip(item as PayrollItem)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    View
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
                      className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                      onClick={() => {
                        if (window.confirm("Delete this payroll entry?")) {
                          deleteMutation.mutate({ id: item.id });
                        }
                      }}
                      title="Delete"
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
          icon={Wallet}
          title={isAdmin ? `No ${teamName.toLowerCase()} payroll for this month` : "No payslips for this month"}
          description={
            isAdmin
              ? `Add a payroll entry for a ${teamName.toLowerCase()} staff member, or open the full Payroll page.`
              : "Your admin will publish payslips here when salary is processed."
          }
        />
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
            <DialogTitle>Add {teamName.toLowerCase()} payroll</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-2">
              <Label>{teamName} staff *</Label>
              <Select value={payrollForm.userId} onValueChange={(v) => setPayrollForm({ ...payrollForm, userId: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {teamStaff?.items.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.fullName} ({formatStaffRoleLabel(u.role)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month *</Label>
              <Input
                type="month"
                value={payrollForm.month}
                onChange={(e) => setPayrollForm({ ...payrollForm, month: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Base salary (Nu.) *</Label>
              <Input
                type="number"
                value={payrollForm.baseSalary}
                onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bonus</Label>
                <Input
                  type="number"
                  value={payrollForm.bonus}
                  onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Deduction</Label>
                <Input
                  type="number"
                  value={payrollForm.deduction}
                  onChange={(e) => setPayrollForm({ ...payrollForm, deduction: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>
          <div className="p-4 sm:px-5 sm:py-3 bg-muted/20 border-t border-border/30 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="w-full sm:w-auto rounded-xl h-10 sm:h-9">Cancel</Button>
            <Button
              className="w-full sm:w-auto rounded-xl h-10 sm:h-9"
              onClick={() => {
                if (!payrollForm.userId || !payrollForm.baseSalary) {
                  toast.error("Staff and base salary are required");
                  return;
                }
                createMutation.mutate({
                  userId: parseInt(payrollForm.userId, 10),
                  month: payrollForm.month,
                  baseSalary: payrollForm.baseSalary,
                  bonus: payrollForm.bonus,
                  deduction: payrollForm.deduction,
                  pfPercentage: payrollForm.pfPercentage || undefined,
                });
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PayslipModal
        open={!!selectedPayslip}
        onOpenChange={(open) => !open && setSelectedPayslip(null)}
        record={selectedPayslip}
      />
    </SoftwareTabPanel>
  );
}
