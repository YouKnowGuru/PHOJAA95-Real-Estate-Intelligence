import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppleCard } from "@/components/ui/apple-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { OniLoader } from "@/components/ui/oni-loader";
import { FileUploader } from "@/components/FileUploader";
import { SecureFileLink } from "@/components/SecureFileLink";
import { formatStatusLabel, getStatusVariant, softwareFormDialogClass } from "@/components/software-dev";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { MapPin, User, Calendar, Layers, Ruler, Banknote, FileText } from "lucide-react";

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-border/40 py-2.5 last:border-0 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

interface ProjectDetailDialogProps {
  projectId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage?: boolean;
  staffName?: string;
}

export function ProjectDetailDialog({ projectId, open, onOpenChange, canManage, staffName }: ProjectDetailDialogProps) {
  const utils = trpc.useUtils();
  const [fileCategory, setFileCategory] = useState("image");

  const { data: project, isLoading, refetch } = trpc.architectureProject.getById.useQuery(
    { id: projectId! },
    { enabled: open && projectId != null }
  );

  const addFile = trpc.architectureProject.addFile.useMutation({
    onSuccess: () => {
      toast.success("File uploaded");
      refetch();
      utils.architectureProject.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${softwareFormDialogClass} max-w-2xl`}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {project?.title || "Project Details"}
            {project?.status && (
              <StatusBadge variant={getStatusVariant(project.status)}>{formatStatusLabel(project.status)}</StatusBadge>
            )}
          </DialogTitle>
          {project?.projectCode && (
            <p className="text-sm text-muted-foreground">{project.projectCode}</p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><OniLoader text="Loading project" /></div>
        ) : !project ? (
          <p className="text-sm text-muted-foreground">Project not found.</p>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <AppleCard hover={false} className="p-4">
              <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Layers className="h-4 w-4" />{project.categoryName || "—"}</span>
                {project.projectLocation && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{project.projectLocation}</span>}
                {(staffName || project.createdBy) && <span className="inline-flex items-center gap-1"><User className="h-4 w-4" />{staffName || `Staff #${project.createdBy}`}</span>}
                {project.createdAt && <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(project.createdAt).toLocaleDateString()}</span>}
              </div>
              <DetailRow label="Description" value={project.description} />
              <DetailRow label="Design Concept" value={project.designConcept} />
              <DetailRow label="Land Size" value={project.landSize} />
              <DetailRow label="Building Size" value={project.buildingSize} />
              <DetailRow label="Floors" value={project.numberOfFloors} />
              <DetailRow label="Est. Completion" value={project.estimatedCompletionTime} />
              <DetailRow label="Est. Cost" value={project.estimatedCost ? `Nu. ${project.estimatedCost}` : undefined} />
              <DetailRow label="Special Features" value={project.specialFeatures} />
              <DetailRow label="Notes" value={project.notes} />
              {project.rejectionReason && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  <span className="font-semibold">Rejection reason: </span>{project.rejectionReason}
                </div>
              )}
            </AppleCard>

            <AppleCard hover={false} className="p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" /> Project Files ({project.files?.length || 0})
              </h4>
              {!project.files?.length ? (
                <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.files.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{f.fileName}</p>
                        <p className="text-xs text-muted-foreground">{formatStatusLabel(f.category)}</p>
                      </div>
                      <SecureFileLink url={f.fileUrl} label="Open" />
                    </div>
                  ))}
                </div>
              )}

              {canManage && ["draft", "rejected", "approved", "in_progress"].includes(project.status) && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <p className="text-sm font-medium">Upload design file</p>
                  <div className="space-y-1">
                    <Label>File category</Label>
                    <Select value={fileCategory} onValueChange={setFileCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf_drawing">PDF Drawing</SelectItem>
                        <SelectItem value="autocad">AutoCAD</SelectItem>
                        <SelectItem value="floor_plan">Floor Plan</SelectItem>
                        <SelectItem value="design_2d">2D Design</SelectItem>
                        <SelectItem value="design_3d">3D Design</SelectItem>
                        <SelectItem value="render">Render</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="document">Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FileUploader
                    folder="architecture"
                    mode="architecture"
                    hint="Upload drawings, renders, floor plans, or payment screenshots"
                    onChange={(url, meta) => {
                      if (!meta) return;
                      addFile.mutate({
                        projectId: project.id,
                        fileName: meta.fileName,
                        fileUrl: url,
                        fileType: meta.mimeType,
                        fileSize: meta.fileSize,
                        category: fileCategory as any,
                      });
                    }}
                  />
                </div>
              )}
            </AppleCard>

            <div className="grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground">
              <div className="rounded-lg border p-3"><Ruler className="mx-auto mb-1 h-4 w-4" />Land & building specs</div>
              <div className="rounded-lg border p-3"><Banknote className="mx-auto mb-1 h-4 w-4" />Est. cost tracking</div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
