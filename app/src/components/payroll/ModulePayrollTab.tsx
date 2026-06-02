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
    { month: selectedMonth },
    { enabled: !isAdmin }
  );

  const { data: teamPayroll, isLoading: adminLoading } = trpc.payroll.list.useQuery(
    { month: selectedMonth, role: teamRole, limit: 100 },
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 w-[140px]"
          />
          {isAdmin && (
            <>
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add payroll
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/payroll">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Full payroll
                </Link>
              </Button>
            </>
          )}
          {!isAdmin && (
            <Button size="sm" variant="outline" asChild>
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
          <div className="overflow-x-auto">
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
                    <td className="px-4 py-3">{item.month}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {parseFloat(item.netSalary).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={item.paymentStatus === "paid" ? "default" : "secondary"}>
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
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && item.paymentStatus === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => markPaidMutation.mutate({ id: item.id })}
                            disabled={markPaidMutation.isPending}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Pay
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {teamName.toLowerCase()} payroll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{teamName} staff *</Label>
              <Select value={payrollForm.userId} onValueChange={(v) => setPayrollForm({ ...payrollForm, userId: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Base salary (Nu.) *</Label>
              <Input
                type="number"
                value={payrollForm.baseSalary}
                onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bonus</Label>
                <Input
                  type="number"
                  value={payrollForm.bonus}
                  onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Deduction</Label>
                <Input
                  type="number"
                  value={payrollForm.deduction}
                  onChange={(e) => setPayrollForm({ ...payrollForm, deduction: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button
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
