import { useState } from "react";
import type { ElementType } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { toast } from "sonner";
import { LogIn, LogOut, Calendar, Users, Download, Search, Filter, Clock, Trash2, CheckCircle2, XCircle, Timer, PackageOpen } from "lucide-react";
import { motion } from "framer-motion";
import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  absent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  late: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  half_day: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

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

export default function AttendancePage() {
  const { isAdmin } = useAuth();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
  const currentMonth = todayStr.substring(0, 7);
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [markForm, setMarkForm] = useState({
    userId: "",
    date: todayStr,
    status: "present" as "present" | "late" | "absent" | "half_day",
    notes: "",
  });

  const utils = trpc.useUtils();

  const { data: myAttendance, isLoading: myAttendanceLoading } = trpc.attendance.myAttendance.useQuery({
    month: selectedMonth,
    limit: 31,
  });

  const { data: adminList, isLoading: adminListLoading } = trpc.attendance.list.useQuery(
    {
      month: selectedMonth,
      userName: searchName || undefined,
      status: statusFilter === "all" ? undefined : (statusFilter as "present" | "absent" | "late" | "half_day"),
      limit: 50,
    },
    { enabled: isAdmin }
  );

  const { data: dailyStatus } = trpc.attendance.dailyStatus.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 1000 * 60 * 5,
  });

  const { data: staffList } = trpc.user.list.useQuery(
    { role: "staff", limit: 100 },
    { enabled: isAdmin && showMarkDialog }
  );

  const { data: summary } = trpc.attendance.monthlySummary.useQuery(
    { month: selectedMonth },
    { enabled: isAdmin }
  );

  const { data: aggregateStats } = trpc.attendance.allStaffStats.useQuery(
    { month: selectedMonth },
    { enabled: isAdmin }
  );

  const checkInMutation = trpc.attendance.checkIn.useMutation({
    onSuccess: (data) => {
      toast.success(`Checked in! Status: ${data.status}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const checkOutMutation = trpc.attendance.checkOut.useMutation({
    onSuccess: () => {
      toast.success("Checked out successfully");
      utils.attendance.myAttendance.invalidate();
      utils.attendance.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const markAttendanceMutation = trpc.attendance.markAttendance.useMutation({
    onSuccess: () => {
      toast.success("Attendance marked successfully");
      setShowMarkDialog(false);
      utils.attendance.list.invalidate();
      utils.attendance.monthlySummary.invalidate();
      utils.attendance.allStaffStats.invalidate();
      utils.attendance.dailyStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.attendance.delete.useMutation({
    onSuccess: () => {
      toast.success("Attendance record deleted");
      utils.attendance.list.invalidate();
      utils.attendance.monthlySummary.invalidate();
      utils.attendance.allStaffStats.invalidate();
      utils.attendance.dailyStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportToCSV = () => {
    if (!summary || summary.length === 0) return;

    const headers = ["Staff Name", "Present", "Late", "Absent", "Half Day", "Total"];
    const rows = summary.map((s) => [
      s.userName,
      s.present || 0,
      s.late || 0,
      s.absent || 0,
      s.halfDay || 0,
      s.total || 0,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_summary_${selectedMonth}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${currentYear}-${String(m).padStart(2, "0")}`;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage attendance records</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-border bg-white/50 px-3 py-2 text-sm dark:bg-slate-800"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {isAdmin ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white shadow-lg shadow-primary/20">
                    <Clock className="h-4 w-4 mr-2" />
                    Mark Attendance
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manual Attendance Marking</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Staff Member</Label>
                      <Select value={markForm.userId} onValueChange={(val) => setMarkForm({ ...markForm, userId: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Staff" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffList?.items.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={markForm.date} onChange={(e) => setMarkForm({ ...markForm, date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={markForm.status} onValueChange={(val) => setMarkForm({ ...markForm, status: val as "present" | "absent" | "late" | "half_day" })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                            <SelectItem value="half_day">Half Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input placeholder="Reason or remarks..." value={markForm.notes} onChange={(e) => setMarkForm({ ...markForm, notes: e.target.value })} />
                    </div>
                    <Button
                      className="w-full mt-2"
                      disabled={!markForm.userId || markAttendanceMutation.isPending}
                      onClick={() =>
                        markAttendanceMutation.mutate({
                          userId: parseInt(markForm.userId),
                          date: markForm.date,
                          status: markForm.status,
                          notes: markForm.notes,
                        })
                      }
                    >
                      Save Attendance
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => checkInMutation.mutate({})}
                  disabled={checkInMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Check In
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button onClick={() => checkOutMutation.mutate()} disabled={checkOutMutation.isPending} variant="outline">
                  <LogOut className="mr-2 h-4 w-4" />
                  Check Out
                </Button>
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      {(isAdmin ? aggregateStats : myAttendance?.stats) ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isAdmin ? (
            <>
              <SummaryCard title="Present" value={aggregateStats?.present || 0} color="bg-emerald-500" icon={CheckCircle2} delay={0} />
              <SummaryCard title="Late" value={aggregateStats?.late || 0} color="bg-amber-500" icon={Clock} delay={0.1} />
              <SummaryCard title="Absent" value={aggregateStats?.absent || 0} color="bg-red-500" icon={XCircle} delay={0.2} />
              <SummaryCard title="Half Day" value={aggregateStats?.halfDay || 0} color="bg-blue-500" icon={Timer} delay={0.3} />
            </>
          ) : (
            <>
              <SummaryCard title="Present" value={myAttendance?.stats?.present || 0} color="bg-emerald-500" icon={CheckCircle2} delay={0} />
              <SummaryCard title="Late" value={myAttendance?.stats?.late || 0} color="bg-amber-500" icon={Clock} delay={0.1} />
              <SummaryCard title="Absent" value={myAttendance?.stats?.absent || 0} color="bg-red-500" icon={XCircle} delay={0.2} />
              <SummaryCard title="Half Day" value={myAttendance?.stats?.halfDay || 0} color="bg-blue-500" icon={Timer} delay={0.3} />
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {/* Calendar for Staff */}
      {!isAdmin && myAttendance?.records && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AttendanceCalendar
              records={myAttendance.records.map((r) => ({
                date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
                status: r.status as "present" | "late" | "absent" | "half_day",
                checkIn: r.checkIn ? new Date(r.checkIn).toISOString() : undefined,
                checkOut: r.checkOut ? new Date(r.checkOut).toISOString() : undefined,
              }))}
            />
          </div>
          <Card className="border-border/50 h-full">
            <CardHeader>
              <CardTitle className="text-sm">Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Your attendance for {selectedMonth}. Make sure to check in before 9:00 AM to be marked as present.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Working Days</span>
                    <span className="font-medium">{myAttendance.records.length}</span>
                  </div>
                  <div className="flex justify-between text-xs text-primary">
                    <span>On Time</span>
                    <span className="font-medium">{myAttendance.stats?.present || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-600">
                    <span>Late</span>
                    <span className="font-medium">{myAttendance.stats?.late || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Live Overview */}
      {isAdmin && dailyStatus && (
        <Card className="border-border/50 bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Clock className="h-4 w-4" />
              Today's Live Overview ({todayStr})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Checked In</p>
                <p className="text-xl font-bold text-indigo-600">
                  {dailyStatus.breakdown.reduce((acc, curr) => acc + (curr.status !== "absent" ? curr.count : 0), 0)} / {dailyStatus.totalStaff}
                </p>
              </div>
              {["present", "late", "absent", "half_day"].map((status) => {
                const count = dailyStatus.breakdown.find((b) => b.status === status)?.count || 0;
                return (
                  <div key={status} className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground capitalize">{status.replace("_", " ")}</p>
                    <p
                      className={`text-xl font-bold ${
                        status === "present"
                          ? "text-emerald-600"
                          : status === "late"
                          ? "text-amber-600"
                          : status === "absent"
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {count}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{isAdmin ? "Attendance Logs" : "My Attendance Records"}</CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  className="h-8 pl-8 w-[150px] lg:w-[200px] text-xs"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[100px] text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {(isAdmin ? adminListLoading : myAttendanceLoading) ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(isAdmin ? adminList?.items : myAttendance?.records)?.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                      <Calendar className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {record.date instanceof Date ? record.date.toLocaleDateString() : String(record.date)}
                      </p>
                      {isAdmin && "userName" in record && record.userName && (
                        <p className="text-xs text-muted-foreground">{String(record.userName)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {record.checkIn && (
                        <p className="text-xs text-muted-foreground">In: {new Date(record.checkIn).toLocaleTimeString()}</p>
                      )}
                      {record.checkOut && (
                        <p className="text-xs text-muted-foreground">Out: {new Date(record.checkOut).toLocaleTimeString()}</p>
                      )}
                    </div>
                    <Badge className={`${statusColors[record.status]} border-0 text-[10px]`}>{record.status}</Badge>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Are you sure you want to delete this record?")) {
                            deleteMutation.mutate({ id: record.id });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
              {(isAdmin ? adminList?.items : myAttendance?.records)?.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
                    <CardContent className="py-20 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                        <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-bold text-foreground">No records found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        {isAdmin
                          ? "No attendance records match your filters for this month."
                          : "You have no attendance records for this month yet."}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Summary */}
      {isAdmin && summary && summary.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Staff</th>
                    <th className="text-center py-2 px-3 font-medium text-emerald-600">Present</th>
                    <th className="text-center py-2 px-3 font-medium text-amber-600">Late</th>
                    <th className="text-center py-2 px-3 font-medium text-red-600">Absent</th>
                    <th className="text-center py-2 px-3 font-medium text-blue-600">Half Day</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.userId} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{s.userName}</td>
                      <td className="text-center py-2 px-3">{s.present || 0}</td>
                      <td className="text-center py-2 px-3">{s.late || 0}</td>
                      <td className="text-center py-2 px-3">{s.absent || 0}</td>
                      <td className="text-center py-2 px-3">{s.halfDay || 0}</td>
                      <td className="text-center py-2 px-3 font-semibold">{s.total || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
