import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  formatStatusLabel, getStatusVariant, SoftwareTabPanel, SoftwarePagination,
  softwareFormDialogClass, TabToolbar, TabSearchWrap,
} from "@/components/software-dev";
import { ProjectDetailDialog, RejectReasonDialog } from "@/components/architecture";
import { TabSectionHeader } from "../TabSectionHeader";
import { Plus, Search, Eye, MapPin, User, Trash2 } from "lucide-react";
import { confirmEntityDelete } from "@/components/software-dev";

export default function ProjectsTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [viewProjectId, setViewProjectId] = useState<number | null>(null);
  const [viewStaffName, setViewStaffName] = useState<string>();
  const [rejectProjectId, setRejectProjectId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", categoryId: "", description: "", designConcept: "",
    projectLocation: "", landSize: "", buildingSize: "", numberOfFloors: "",
    estimatedCompletionTime: "", estimatedCost: "", specialFeatures: "", notes: "",
  });

  const { data: categories } = trpc.architectureCategory.list.useQuery({});
  const { data, isLoading, refetch } = trpc.architectureProject.list.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 12,
  });

  const createMutation = trpc.architectureProject.create.useMutation({
    onSuccess: () => { toast.success("Project created"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const submitMutation = trpc.architectureProject.submit.useMutation({
    onSuccess: () => { toast.success("Submitted for review"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const reviewMutation = trpc.architectureProject.review.useMutation({
    onSuccess: () => { toast.success("Project updated"); refetch(); setRejectProjectId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.architectureProject.delete.useMutation({
    onSuccess: () => { toast.success("Project deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const openDetail = (id: number, staffName?: string | null) => {
    setViewProjectId(id);
    setViewStaffName(staffName || undefined);
  };

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Architecture Projects"
        description={canManage ? "Create design submissions, upload files, and submit for admin approval." : "Review full project details and approve or reject submissions."}
        actions={canManage ? (
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New Project</Button>
            </DialogTrigger>
            <DialogContent className={softwareFormDialogClass}>
              <DialogHeader><DialogTitle>Create Architecture Project</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  title: form.title,
                  categoryId: Number(form.categoryId),
                  description: form.description || undefined,
                  designConcept: form.designConcept || undefined,
                  projectLocation: form.projectLocation || undefined,
                  landSize: form.landSize || undefined,
                  buildingSize: form.buildingSize || undefined,
                  numberOfFloors: form.numberOfFloors ? Number(form.numberOfFloors) : undefined,
                  estimatedCompletionTime: form.estimatedCompletionTime || undefined,
                  estimatedCost: form.estimatedCost || undefined,
                  specialFeatures: form.specialFeatures || undefined,
                  notes: form.notes || undefined,
                });
              }} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                  <div className="space-y-1">
                    <Label>Category *</Label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>{(categories || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div className="space-y-1"><Label>Design Concept</Label><Textarea value={form.designConcept} onChange={(e) => setForm({ ...form, designConcept: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Location</Label><Input value={form.projectLocation} onChange={(e) => setForm({ ...form, projectLocation: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Land Size</Label><Input value={form.landSize} onChange={(e) => setForm({ ...form, landSize: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Building Size</Label><Input value={form.buildingSize} onChange={(e) => setForm({ ...form, buildingSize: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Floors</Label><Input type="number" value={form.numberOfFloors} onChange={(e) => setForm({ ...form, numberOfFloors: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Est. Completion</Label><Input value={form.estimatedCompletionTime} onChange={(e) => setForm({ ...form, estimatedCompletionTime: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Est. Cost</Label><Input value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Special Features</Label><Textarea value={form.specialFeatures} onChange={(e) => setForm({ ...form, specialFeatures: e.target.value })} /></div>
                <Button type="submit" disabled={createMutation.isPending || !form.categoryId}>Create Project</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <TabToolbar>
        <TabSearchWrap>
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </TabSearchWrap>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </TabToolbar>

      {isLoading ? <OniLoader /> : !data?.items.length ? (
        <EmptyState title="No projects yet" description={canManage ? "Create your first architecture project to get started." : "No projects pending your review."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.items.map((p) => (
            <AppleCard key={p.id} className="group flex flex-col p-4 transition-shadow hover:shadow-md">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.projectCode}</p>
                </div>
                <StatusBadge variant={getStatusVariant(p.status)}>{formatStatusLabel(p.status)}</StatusBadge>
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" />{p.projectLocation || "No location"}</p>
                <p>{p.categoryName || "—"}</p>
                {isAdmin && (
                  <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" />{p.staffName || "—"}</p>
                )}
                {p.estimatedCost && <p className="font-medium text-foreground">Est. Nu. {p.estimatedCost}</p>}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button size="sm" variant="secondary" className="gap-1" onClick={() => openDetail(p.id, p.staffName)}>
                  <Eye className="h-3.5 w-3.5" /> View Details
                </Button>
                {canManage && ["draft", "rejected"].includes(p.status) && (
                  <Button size="sm" variant="outline" onClick={() => submitMutation.mutate({ id: p.id })}>Submit</Button>
                )}
                {isAdmin && ["submitted", "under_review"].includes(p.status) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: p.id, action: "start_review" })}>Review</Button>
                    <Button size="sm" onClick={() => reviewMutation.mutate({ id: p.id, action: "approve" })}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectProjectId(p.id)}>Reject</Button>
                  </>
                )}
                {(isAdmin || canManage) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirmEntityDelete(p, "project")) deleteMutation.mutate({ id: p.id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </AppleCard>
          ))}
        </div>
      )}
      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}

      <ProjectDetailDialog
        projectId={viewProjectId}
        open={viewProjectId !== null}
        onOpenChange={(open) => !open && setViewProjectId(null)}
        canManage={canManage}
        staffName={viewStaffName}
      />

      <RejectReasonDialog
        open={rejectProjectId !== null}
        onOpenChange={(open) => !open && setRejectProjectId(null)}
        title="Reject Project"
        isPending={reviewMutation.isPending}
        onConfirm={(reason) => {
          if (rejectProjectId) reviewMutation.mutate({ id: rejectProjectId, action: "reject", reason });
        }}
      />
    </SoftwareTabPanel>
  );
}
