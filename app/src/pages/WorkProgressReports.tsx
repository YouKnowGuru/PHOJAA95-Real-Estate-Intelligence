import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateWorkProgressPdf, safeArray } from "@/lib/generateWorkProgressPdf";
import { exportWorkProgressListAsCsv } from "@/lib/generateWorkProgressCsv";
import { useDebounce } from "@/lib/optimization";
import type { WorkProgressReport } from "@db/schema";
import {
  FileText, Plus, Download, Eye, Edit3, Trash2, Send,
  CheckCircle2, Clock, AlertCircle, Search, Filter,
  X, Save, ClipboardList, CheckCheck, Loader2, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────
type StatusFilter = "all" | "draft" | "submitted" | "reviewed" | "approved";
type ReportStatus = "draft" | "submitted" | "reviewed" | "approved";

interface ScopeItem { module: string; description: string; }
interface TimelineItem { phase: string; targetCompletion: string; status: "completed" | "pending" | "in_progress"; }

interface ReportFormData {
  project: string;
  feature: string;
  reportDate: string;
  featureOverview: string;
  objectives: string[];
  scopeOfWork: ScopeItem[];
  completedItems: string[];
  inProgressItems: string[];
  timeline: TimelineItem[];
}

const EMPTY_FORM: ReportFormData = {
  project: "",
  feature: "",
  reportDate: "", // set at render time via getToday()
  featureOverview: "",
  objectives: [""],
  scopeOfWork: [{ module: "", description: "" }],
  completedItems: [""],
  inProgressItems: [""],
  timeline: [{ phase: "", targetCompletion: "", status: "pending" }],
};

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Status helpers ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ReportStatus }) {
  const cfg: Record<ReportStatus, { label: string; className: string; icon: React.ReactNode }> = {
    draft:     { label: "Draft",       className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200",   icon: <Edit3 className="h-3 w-3" /> },
    submitted: { label: "Submitted",   className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200",     icon: <Clock className="h-3 w-3" /> },
    reviewed:  { label: "Reviewed",    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200",           icon: <Eye className="h-3 w-3" /> },
    approved:  { label: "Approved",    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
}

// ─── Dynamic list helpers ─────────────────────────────────────────────────
function StringListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n); };
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={e => update(i, e.target.value)} placeholder={`${label} item ${i + 1}`} className="flex-1" />
          {items.length > 1 && (
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500 shrink-0" onClick={() => remove(i)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5 text-xs">
        <Plus className="h-3 w-3" /> Add {label}
      </Button>
    </div>
  );
}

function ScopeEditor({ items, onChange }: { items: ScopeItem[]; onChange: (v: ScopeItem[]) => void }) {
  const add = () => onChange([...items, { module: "", description: "" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof ScopeItem, v: string) => {
    const n = [...items]; n[i] = { ...n[i], [field]: v }; onChange(n);
  };
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold text-foreground">Scope of Work</Label>
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="grid grid-cols-[1fr_2fr_36px] bg-primary/5 px-3 py-2 text-xs font-semibold text-muted-foreground gap-2">
          <span>Module</span><span>Description</span><span />
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_36px] border-t border-border/40 gap-2 px-2 py-1.5 items-center">
            <Input value={item.module} onChange={e => update(i, "module", e.target.value)} placeholder="Module name" className="h-8 text-sm" />
            <Input value={item.description} onChange={e => update(i, "description", e.target.value)} placeholder="Description" className="h-8 text-sm" />
            {items.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => remove(i)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : <div />}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5 text-xs">
        <Plus className="h-3 w-3" /> Add Row
      </Button>
    </div>
  );
}

function TimelineEditor({ items, onChange }: { items: TimelineItem[]; onChange: (v: TimelineItem[]) => void }) {
  const add = () => onChange([...items, { phase: "", targetCompletion: "", status: "pending" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof TimelineItem, v: string) => {
    const n = [...items]; n[i] = { ...n[i], [field]: v as any }; onChange(n);
  };
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold text-foreground">Timeline</Label>
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1.2fr_36px] bg-primary/5 px-3 py-2 text-xs font-semibold text-muted-foreground gap-2">
          <span>Phase</span><span>Target Date</span><span>Status</span><span />
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[2fr_1.5fr_1.2fr_36px] border-t border-border/40 gap-2 px-2 py-1.5 items-center">
            <Input value={item.phase} onChange={e => update(i, "phase", e.target.value)} placeholder="Phase name" className="h-8 text-sm" />
            <Input type="date" value={item.targetCompletion} onChange={e => update(i, "targetCompletion", e.target.value)} className="h-8 text-sm" />
            <Select value={item.status} onValueChange={v => update(i, "status", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            {items.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => remove(i)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : <div />}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5 text-xs">
        <Plus className="h-3 w-3" /> Add Phase
      </Button>
    </div>
  );
}

// ─── Report Form Modal ────────────────────────────────────────────────────
function ReportFormModal({
  open, onClose, editReport,
}: {
  open: boolean;
  onClose: () => void;
  editReport?: WorkProgressReport | null;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ReportFormData>(() => EMPTY_FORM);
  const submitAfterCreateRef = useRef(false);

  // Reset form whenever the modal opens — populate from editReport, else empty.
  // (The modal is always mounted, so useState's initializer only ran once at
  //  mount when editReport was null. This effect fixes the "blank edit form" bug.)
  useEffect(() => {
    if (!open) return;
    submitAfterCreateRef.current = false;
    if (editReport) {
      const obj = safeArray<string>(editReport.objectives);
      const sc = safeArray<ScopeItem>(editReport.scopeOfWork);
      const comp = safeArray<string>(editReport.completedItems);
      const inp = safeArray<string>(editReport.inProgressItems);
      const tl = safeArray<TimelineItem>(editReport.timeline);
      setForm({
        project: editReport.project,
        feature: editReport.feature,
        reportDate: editReport.reportDate || getToday(),
        featureOverview: editReport.featureOverview ?? "",
        objectives: obj.length ? obj : [""],
        scopeOfWork: sc.length ? sc : [{ module: "", description: "" }],
        completedItems: comp.length ? comp : [""],
        inProgressItems: inp.length ? inp : [""],
        timeline: tl.length ? tl : [{ phase: "", targetCompletion: "", status: "pending" }],
      });
    } else {
      setForm({ ...EMPTY_FORM, reportDate: getToday() });
    }
  }, [open, editReport]);

  const setField = <K extends keyof ReportFormData>(key: K, val: ReportFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const cleanList = (arr: string[]) => arr.map(s => s.trim()).filter(Boolean);
  const cleanScope = (arr: ScopeItem[]) => arr.filter(s => s.module.trim() && s.description.trim());
  // Only require phase — targetCompletion may legitimately be blank (was silently dropping rows)
  const cleanTimeline = (arr: TimelineItem[]) => arr.filter(t => t.phase.trim());

  const createMutation = trpc.workProgress.create.useMutation({
    onSuccess: (data) => {
      // If "Save & Submit" was requested, chain into submit using the new id
      if (submitAfterCreateRef.current) {
        submitAfterCreate.mutate({ id: data.id });
        return;
      }
      toast.success("Report saved as draft");
      utils.workProgress.getMyReports.invalidate();
      utils.workProgress.getMyStats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  // Used internally by "Save & Submit" — create then submit
  const submitAfterCreate = trpc.workProgress.submit.useMutation({
    onSuccess: () => {
      toast.success("Report saved and submitted for review");
      utils.workProgress.getMyReports.invalidate();
      utils.workProgress.getMyStats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.workProgress.update.useMutation({
    onSuccess: () => {
      toast.success("Report updated");
      utils.workProgress.getMyReports.invalidate();
      utils.workProgress.getMyStats.invalidate();
      utils.workProgress.getById.invalidate({ id: editReport!.id });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  // Used internally by "Save & Submit" on an existing draft/submitted report
  const submitAfterUpdate = trpc.workProgress.submit.useMutation({
    onSuccess: () => {
      toast.success("Report updated and submitted for review");
      utils.workProgress.getMyReports.invalidate();
      utils.workProgress.getMyStats.invalidate();
      utils.workProgress.getById.invalidate({ id: editReport!.id });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending
    || submitAfterCreate.isPending || submitAfterUpdate.isPending;

  const buildPayload = () => {
    if (!form.project.trim()) { toast.error("Project name is required"); return null; }
    if (!form.feature.trim()) { toast.error("Feature name is required"); return null; }
    if (!form.reportDate) { toast.error("Report date is required"); return null; }

    return {
      project: form.project.trim(),
      feature: form.feature.trim(),
      reportDate: form.reportDate,
      featureOverview: form.featureOverview.trim(),
      objectives: cleanList(form.objectives),
      scopeOfWork: cleanScope(form.scopeOfWork),
      completedItems: cleanList(form.completedItems),
      inProgressItems: cleanList(form.inProgressItems),
      timeline: cleanTimeline(form.timeline),
    };
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (!payload) return;
    if (editReport) {
      updateMutation.mutate({ id: editReport.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Save the report, then immediately submit it for admin review
  const handleSaveAndSubmit = () => {
    const payload = buildPayload();
    if (!payload) return;
    if (editReport) {
      // Update first, then submit once the update resolves
      updateMutation.mutate(
        { id: editReport.id, ...payload },
        {
          onSuccess: () => {
            submitAfterUpdate.mutate({ id: editReport.id });
          },
        }
      );
    } else {
      // Set the flag so createMutation submits after the insert resolves
      submitAfterCreateRef.current = true;
      createMutation.mutate(payload);
    }
  };

  // "Save & Submit" is only meaningful for new or draft/submitted reports
  const canSaveAndSubmit = !editReport || editReport.status === "draft" || editReport.status === "submitted";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            {editReport ? "Edit Progress Report" : "New Progress Report"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Fill in the sections below. You can save as draft and submit when ready.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
          {/* Metadata */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <span className="h-px flex-1 bg-border/60" />Report Information<span className="h-px flex-1 bg-border/60" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="project">Project Name *</Label>
                <Input id="project" value={form.project} onChange={e => setField("project", e.target.value)} placeholder="e.g. Phooja95 Real Estate Website" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feature">Feature / Module *</Label>
                <Input id="feature" value={form.feature} onChange={e => setField("feature", e.target.value)} placeholder="e.g. Business Valuation Module" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rdate">Report Date *</Label>
                <Input id="rdate" type="date" value={form.reportDate} onChange={e => setField("reportDate", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 1 */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <span className="h-px flex-1 bg-border/60" />1. Feature Overview<span className="h-px flex-1 bg-border/60" />
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="overview">Overview Description</Label>
              <Textarea id="overview" value={form.featureOverview} onChange={e => setField("featureOverview", e.target.value)} placeholder="Describe this feature — its purpose, users, and goals..." rows={4} />
            </div>
            <StringListEditor label="Objectives" items={form.objectives} onChange={v => setField("objectives", v)} />
          </div>

          {/* Section 2 */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <span className="h-px flex-1 bg-border/60" />2. Scope of Work<span className="h-px flex-1 bg-border/60" />
            </h3>
            <ScopeEditor items={form.scopeOfWork} onChange={v => setField("scopeOfWork", v)} />
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <span className="h-px flex-1 bg-border/60" />3. Progress Summary<span className="h-px flex-1 bg-border/60" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30">
                <StringListEditor label="Completed Items" items={form.completedItems} onChange={v => setField("completedItems", v)} />
              </div>
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
                <StringListEditor label="In Progress Items" items={form.inProgressItems} onChange={v => setField("inProgressItems", v)} />
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <span className="h-px flex-1 bg-border/60" />4. Timeline<span className="h-px flex-1 bg-border/60" />
            </h3>
            <TimelineEditor items={form.timeline} onChange={v => setField("timeline", v)} />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 min-w-[120px]">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
          {canSaveAndSubmit && (
            <Button
              variant="default"
              onClick={handleSaveAndSubmit}
              disabled={isSaving}
              className="gap-2 min-w-[150px] bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSaving ? "Saving..." : "Save & Submit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Detail Modal ──────────────────────────────────────────────────
function ReportDetailModal({
  reportId, open, onClose, isAdmin, siteName, siteLogo,
}: {
  reportId: number | null;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  siteName?: string;
  siteLogo?: string;
}) {
  const utils = trpc.useUtils();
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"reviewed" | "approved" | "draft">("reviewed");

  // BUG FIX: reset review form state whenever a different report is opened,
  // otherwise the previous report's decision/notes leak into the next one.
  useEffect(() => {
    if (open && reportId !== null) {
      setReviewNotes("");
      setReviewStatus("reviewed");
    }
  }, [open, reportId]);

  const { data: report, isLoading } = trpc.workProgress.getById.useQuery(
    { id: reportId! },
    { enabled: open && reportId !== null }
  );

  const reviewMutation = trpc.workProgress.review.useMutation({
    onSuccess: () => {
      toast.success("Review submitted successfully");
      utils.workProgress.listAll.invalidate();
      utils.workProgress.getAllStats.invalidate();
      utils.workProgress.getMyReports.invalidate();
      utils.workProgress.getMyStats.invalidate();
      utils.workProgress.getById.invalidate({ id: reportId! });
      setReviewNotes("");
    },
    onError: e => toast.error(e.message),
  });

  if (!open || !reportId) return null;

  const scope = safeArray<ScopeItem>(report?.scopeOfWork);
  const completed = safeArray<string>(report?.completedItems);
  const inProgress = safeArray<string>(report?.inProgressItems);
  const timeline = safeArray<TimelineItem>(report?.timeline);
  const objectives = safeArray<string>(report?.objectives);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg">{report?.project ?? "Loading..."}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{report?.reportNumber}</span>
                {report && <StatusBadge status={report.status as ReportStatus} />}
              </div>
            </div>
            {report && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 shrink-0"
                onClick={async () => {
                  toast.info("Generating PDF report...");
                  await generateWorkProgressPdf(report as WorkProgressReport, siteName, siteLogo);
                }}
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {report && (
            <>
              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/40 border border-border/40">
                {[
                  { label: "Feature", value: report.feature },
                  { label: "Report Date", value: report.reportDate || "—" },
                  { label: "Prepared By", value: report.staffName },
                  ...(report.reviewedByName ? [{ label: "Reviewed By", value: report.reviewedByName }] : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>

              {/* Section 1 */}
              {(report.featureOverview || objectives.length > 0) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-primary" /> 1. Feature Overview
                  </h4>
                  {report.featureOverview && <p className="text-sm text-muted-foreground leading-relaxed">{report.featureOverview}</p>}
                  {objectives.length > 0 && (
                    <ul className="space-y-1">
                      {objectives.map((o, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {o}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Section 2 */}
              {scope.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-primary" /> 2. Scope of Work
                  </h4>
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="grid grid-cols-[1fr_2fr] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                      <span>Module</span><span>Description</span>
                    </div>
                    {scope.map((s, i) => (
                      <div key={i} className="grid grid-cols-[1fr_2fr] border-t border-border/40 px-3 py-2 text-sm">
                        <span className="font-medium">{s.module}</span>
                        <span className="text-muted-foreground">{s.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3 */}
              {(completed.length > 0 || inProgress.length > 0) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-primary" /> 3. Progress Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {completed.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </p>
                        <ul className="space-y-1.5">
                          {completed.map((c, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>{c}</li>)}
                        </ul>
                      </div>
                    )}
                    {inProgress.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> In Progress
                        </p>
                        <ul className="space-y-1.5">
                          {inProgress.map((p, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span>{p}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 4 */}
              {timeline.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-primary" /> 4. Timeline
                  </h4>
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="grid grid-cols-[2fr_1.5fr_1fr] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                      <span>Phase</span><span>Target</span><span>Status</span>
                    </div>
                    {timeline.map((t, i) => (
                      <div key={i} className="grid grid-cols-[2fr_1.5fr_1fr] border-t border-border/40 px-3 py-2.5 text-sm items-center">
                        <span className="font-medium">{t.phase}</span>
                        <span className="text-muted-foreground">{t.targetCompletion}</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          t.status === "completed" ? "text-emerald-600" :
                          t.status === "in_progress" ? "text-amber-600" : "text-slate-500"
                        }`}>
                          {t.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> :
                           t.status === "in_progress" ? <Clock className="h-3 w-3" /> :
                           <AlertCircle className="h-3 w-3" />}
                          {t.status === "completed" ? "Completed" : t.status === "in_progress" ? "In Progress" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Notes (display) */}
              {report.adminNotes && (
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1.5">Admin Notes</p>
                  <p className="text-sm text-foreground/80">{report.adminNotes}</p>
                </div>
              )}

              {/* Admin Review Panel — only for submitted or reviewed reports (not draft/approved) */}
              {isAdmin && (report.status === "submitted" || report.status === "reviewed") && (
                <div className="space-y-3 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                  <h4 className="text-sm font-bold text-primary">Admin Review</h4>
                  <div className="space-y-1.5">
                    <Label>Review Decision</Label>
                    <Select value={reviewStatus} onValueChange={v => setReviewStatus(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reviewed">Mark as Reviewed</SelectItem>
                        <SelectItem value="approved">Approve</SelectItem>
                        <SelectItem value="draft">Send Back to Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)}
                      placeholder="Add your review notes or feedback..."
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={() => reviewMutation.mutate({ id: report.id, status: reviewStatus, adminNotes: reviewNotes || undefined })}
                    disabled={reviewMutation.isPending}
                    className="gap-2 w-full"
                  >
                    {reviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Card (Staff View) ─────────────────────────────────────────────
function ReportCard({
  report,
  onView,
  onEdit,
  onSubmit,
  onDelete,
  onDownload,
}: {
  report: WorkProgressReport;
  onView: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground">{report.reportNumber}</span>
            <StatusBadge status={report.status as ReportStatus} />
          </div>
          <h3 className="font-semibold text-foreground mt-1.5 truncate">{report.project}</h3>
          <p className="text-sm text-muted-foreground truncate">{report.feature}</p>
          <p className="text-xs text-muted-foreground mt-1">{report.reportDate || "—"}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
          {(report.status === "draft" || report.status === "submitted") && (
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={onEdit}>
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Download PDF" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Actions */}
      {(report.status === "draft") && (
        <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border/40">
          <Button size="sm" variant="default" className="gap-1.5 h-7 text-xs" onClick={onSubmit}>
            <Send className="h-3 w-3" /> Submit for Review
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      )}
      {report.adminNotes && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg px-2.5 py-1.5 border border-amber-200/50">
          💬 {report.adminNotes.slice(0, 80)}{report.adminNotes.length > 80 ? "..." : ""}
        </div>
      )}
    </motion.div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────
export default function WorkProgressReports() {
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();

  // UI state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editReport, setEditReport] = useState<WorkProgressReport | null>(null);
  const [viewReportId, setViewReportId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [submitId, setSubmitId] = useState<number | null>(null);
  // FEATURE: date-range filter state (staff view)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Debounce search so we don't fire a query per keystroke (bug fix #5)
  const debouncedSearch = useDebounce(search, 350);

  // ── Staff data ──────────────────────────────────────────────────────
  const { data: myData, isLoading: myLoading } = trpc.workProgress.getMyReports.useQuery(
    {
      page, limit: 12, status: statusFilter, search: debouncedSearch,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { enabled: !isAdmin }
  );

  // Staff stats (server-side, accurate — bug fix #3)
  const { data: myStats } = trpc.workProgress.getMyStats.useQuery(
    undefined,
    { enabled: !isAdmin }
  );

  // ── Admin data ──────────────────────────────────────────────────────
  const [adminStatus, setAdminStatus] = useState<StatusFilter>("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [adminStaffId, setAdminStaffId] = useState<number | "all">("all");
  // FEATURE: date-range filter state (admin view)
  const [adminDateFrom, setAdminDateFrom] = useState("");
  const [adminDateTo, setAdminDateTo] = useState("");

  const debouncedAdminSearch = useDebounce(adminSearch, 350);

  const { data: allData, isLoading: allLoading } = trpc.workProgress.listAll.useQuery(
    {
      page: adminPage,
      limit: 15,
      status: adminStatus,
      search: debouncedAdminSearch,
      staffId: adminStaffId === "all" ? undefined : adminStaffId,
      dateFrom: adminDateFrom || undefined,
      dateTo: adminDateTo || undefined,
    },
    { enabled: isAdmin }
  );

  // Admin stats (server-side, accurate — bug fix #3)
  const { data: allStats } = trpc.workProgress.getAllStats.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  // Staff list for admin filter dropdown (feature #9)
  const { data: staffList } = trpc.workProgress.getStaffList.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  const submitMutation = trpc.workProgress.submit.useMutation({
    onSuccess: () => {
      toast.success("Report submitted for admin review");
      utils.workProgress.getMyReports.invalidate();
      utils.workProgress.getMyStats.invalidate();
      utils.workProgress.getAllStats.invalidate();
      setSubmitId(null);
    },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = trpc.workProgress.delete.useMutation({
    onSuccess: () => {
      toast.success("Report deleted");
      // Invalidate both staff and admin caches (admin can delete too — feature #10)
      utils.workProgress.getMyReports.invalidate();
      utils.workProgress.listAll.invalidate();
      utils.workProgress.getMyStats.invalidate();
      utils.workProgress.getAllStats.invalidate();
      setDeleteId(null);
    },
    onError: e => toast.error(e.message),
  });

  const handleOpenForm = useCallback((report?: WorkProgressReport) => {
    setEditReport(report ?? null);
    setFormOpen(true);
  }, []);

  const { data: branding } = trpc.settings.getPublicSettings.useQuery(undefined, {
    staleTime: Infinity,
  });
  const siteName = branding?.site_name || "PHOJAA95";
  const siteLogo = branding?.site_logo;

  const handleDownload = useCallback(async (report: WorkProgressReport) => {
    try {
      toast.info("Generating PDF report...");
      await generateWorkProgressPdf(report, siteName, siteLogo);
    } catch {
      toast.error("Failed to generate PDF");
    }
  }, [siteName, siteLogo]);

  // FEATURE: bulk CSV export — fetches ALL matching reports (not just the current page)
  const { refetch: refetchExportList, isFetching: exportLoading } = trpc.workProgress.exportList.useQuery(
    {
      status: adminStatus,
      search: debouncedAdminSearch || undefined,
      staffId: adminStaffId === "all" ? undefined : adminStaffId,
      dateFrom: adminDateFrom || undefined,
      dateTo: adminDateTo || undefined,
    },
    { enabled: false } // manual trigger only
  );

  const handleExportCsv = useCallback(async () => {
    try {
      toast.info("Preparing CSV export...");
      const res = await refetchExportList();
      const reports = res.data?.reports ?? [];
      if (reports.length === 0) {
        toast.error("No reports match the current filters");
        return;
      }
      exportWorkProgressListAsCsv(reports, siteName);
      toast.success(`Exported ${reports.length} report${reports.length === 1 ? "" : "s"} to CSV`);
    } catch {
      toast.error("Failed to export CSV");
    }
  }, [refetchExportList, siteName]);

  // ── Stats bar (server-side counts — bug fix #3) ───────────────────────
  const reports = isAdmin ? (allData?.reports ?? []) : (myData?.reports ?? []);
  const isLoading = isAdmin ? allLoading : myLoading;
  const stats = isAdmin ? allStats : myStats;

  const STATS = [
    { label: "Total",     value: stats?.total ?? 0,      color: "text-foreground" },
    { label: "Draft",     value: stats?.draft ?? 0,      color: "text-slate-500" },
    { label: "Submitted", value: stats?.submitted ?? 0,  color: "text-amber-600" },
    { label: "Reviewed",  value: stats?.reviewed ?? 0,   color: "text-blue-600" },
    { label: "Approved",  value: stats?.approved ?? 0,   color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            Work Progress Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Review and manage staff progress reports" : "Submit and track your work progress reports"}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => handleOpenForm()} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> New Report
          </Button>
        )}
      </motion.div>

      {/* ── Stats Bar ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-5 divide-x divide-border/40 rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col items-center py-4 px-2 hover:bg-muted/30 transition-colors">
            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by project, feature, or report number..."
            value={isAdmin ? adminSearch : search}
            onChange={e => {
              isAdmin ? setAdminSearch(e.target.value) : setSearch(e.target.value);
              isAdmin ? setAdminPage(1) : setPage(1);
            }}
          />
        </div>
        <Select value={isAdmin ? adminStatus : statusFilter} onValueChange={v => {
          isAdmin ? setAdminStatus(v as StatusFilter) : setStatusFilter(v as StatusFilter);
          isAdmin ? setAdminPage(1) : setPage(1);
        }}>
          <SelectTrigger className="w-full sm:w-44 gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
        {/* Staff filter — admin only (feature #9) */}
        {isAdmin && (
          <Select
            value={String(adminStaffId)}
            onValueChange={v => {
              setAdminStaffId(v === "all" ? "all" : Number(v));
              setAdminPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48 gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filter by staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffList?.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name || `User #${s.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* FEATURE: date-range filter (both staff & admin) */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-full sm:w-40"
            value={isAdmin ? adminDateFrom : dateFrom}
            onChange={e => {
              const v = e.target.value;
              isAdmin ? setAdminDateFrom(v) : setDateFrom(v);
              isAdmin ? setAdminPage(1) : setPage(1);
            }}
            aria-label="From date"
          />
          <span className="text-muted-foreground text-sm shrink-0">to</span>
          <Input
            type="date"
            className="w-full sm:w-40"
            value={isAdmin ? adminDateTo : dateTo}
            onChange={e => {
              const v = e.target.value;
              isAdmin ? setAdminDateTo(v) : setDateTo(v);
              isAdmin ? setAdminPage(1) : setPage(1);
            }}
            aria-label="To date"
          />
          {/* FEATURE: bulk CSV export — admin only */}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={exportLoading}
              className="gap-2 shrink-0"
              title="Export all matching reports to CSV"
            >
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">No reports found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {!isAdmin ? "Create your first progress report to get started." : "No staff reports match your filters."}
          </p>
          {!isAdmin && (
            <Button onClick={() => handleOpenForm()} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> New Report
            </Button>
          )}
        </motion.div>
      ) : (
        <>
          {/* Staff Card Grid */}
          {!isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {reports.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r as WorkProgressReport}
                    onView={() => setViewReportId(r.id)}
                    onEdit={() => handleOpenForm(r as WorkProgressReport)}
                    onSubmit={() => setSubmitId(r.id)}
                    onDelete={() => setDeleteId(r.id)}
                    onDownload={() => handleDownload(r as WorkProgressReport)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Admin Table */}
          {isAdmin && (
            <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Report #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Feature</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <AnimatePresence>
                    {reports.map((r, i) => (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="bg-card hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.reportNumber}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{r.staffName}</td>
                        <td className="px-4 py-3 max-w-[160px] truncate">{r.project}</td>
                        <td className="px-4 py-3 max-w-[140px] truncate text-muted-foreground">{r.feature}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.reportDate || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status as ReportStatus} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View & Review" onClick={() => setViewReportId(r.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {/* BUG FIX: admin could edit/delete via backend but had no UI button */}
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => handleOpenForm(r as WorkProgressReport)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" title="Delete" onClick={() => setDeleteId(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Download PDF" onClick={() => handleDownload(r as WorkProgressReport)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {(isAdmin ? allData?.totalPages : myData?.totalPages) && (isAdmin ? allData!.totalPages : myData!.totalPages) > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline" size="sm"
                disabled={isAdmin ? adminPage <= 1 : page <= 1}
                onClick={() => isAdmin ? setAdminPage(p => p - 1) : setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {isAdmin ? adminPage : page} of {isAdmin ? allData?.totalPages : myData?.totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                disabled={isAdmin ? adminPage >= (allData?.totalPages ?? 1) : page >= (myData?.totalPages ?? 1)}
                onClick={() => isAdmin ? setAdminPage(p => p + 1) : setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <ReportFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditReport(null); }}
        editReport={editReport}
      />

      <ReportDetailModal
        reportId={viewReportId}
        open={viewReportId !== null}
        onClose={() => setViewReportId(null)}
        isAdmin={isAdmin}
        siteName={siteName}
        siteLogo={siteLogo}
      />

      {/* Submit Confirm */}
      <AlertDialog open={submitId !== null} onOpenChange={v => !v && setSubmitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send your report to admin for review. You won't be able to edit it until admin sends it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitMutation.mutate({ id: submitId! })}
              className="gap-2"
            >
              <Send className="h-4 w-4" /> Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The report will be permanently deleted.
              {!isAdmin && " Only draft reports can be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: deleteId! })}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
