import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KanbanSquare, Calendar, User, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Kanban columns aligned with schema statuses
const KANBAN_COLUMNS = [
  { id: "pending_approval", label: "Pending Approval", color: "bg-slate-500" },
  { id: "approved", label: "Approved", color: "bg-blue-500" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-500" },
  { id: "testing", label: "Testing", color: "bg-pink-500" },
  { id: "uat", label: "UAT", color: "bg-purple-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
  { id: "delivered", label: "Delivered", color: "bg-emerald-600" },
];

// Valid status transitions for the move buttons
const VALID_NEXT: Record<string, string | null> = {
  pending_approval: "approved",
  approved: "in_progress",
  in_progress: "testing",
  testing: "uat",
  uat: "completed",
  completed: "delivered",
  delivered: null,
};

const VALID_PREV: Record<string, string | null> = {
  pending_approval: null,
  approved: null, // can't go back from approved
  in_progress: null, // can't go back from in_progress
  testing: "in_progress",
  uat: "testing",
  completed: "uat",
  delivered: "completed",
};

export default function SoftwareKanban() {
  const { isAdmin } = useAuth();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [moveDialog, setMoveDialog] = useState<{ project: any; newStatus: string } | null>(null);

  const { data: projects, isLoading, refetch } = trpc.softwareProject.list.useQuery({
    page: 1,
    limit: 100,
  });
  const updateStatus = trpc.softwareProject.updateStatus.useMutation({
    onSuccess: () => {
      setMoveDialog(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const approveMutation = trpc.softwareProject.approve.useMutation({
    onSuccess: () => {
      setMoveDialog(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmMove = () => {
    if (!moveDialog) return;
    const { project, newStatus } = moveDialog;
    if (newStatus === "approved") {
      if (!isAdmin) {
        toast.error("Only admins can approve projects");
        return;
      }
      approveMutation.mutate({ id: project.id, status: "approved" });
      return;
    }
    updateStatus.mutate({
      id: project.id,
      status: newStatus as "in_progress" | "testing" | "uat" | "completed" | "delivered",
    });
  };

  const isBusy = updateStatus.isPending || approveMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading Kanban board..." />
      </div>
    );
  }

  const projectsByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = (projects?.items || []).filter((p: any) => p.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <AnimatedPage>
      <PageHeader
        title="Kanban Board"
        description="Manage development workflow — move projects through approval → development → delivery"
        icon={<KanbanSquare className="h-5 w-5" />}
      />

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-72">
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-3 w-3 rounded-full ${col.color}`} />
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {projectsByStatus[col.id]?.length || 0}
              </span>
            </div>
            <div className="space-y-2">
              {projectsByStatus[col.id]?.map((project: any) => (
                <div
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedProject(project)}
                >
                <AppleCard className="hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm line-clamp-2">{project.name}</h4>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        #{project.projectId}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {project.assignedDeveloperName || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {project.startDate || "-"}
                      </span>
                      {project.endDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {project.endDate}
                        </span>
                      )}
                    </div>
                    {/* Move buttons — only show valid transitions */}
                    <div className="flex items-center gap-1 pt-1">
                      {VALID_PREV[project.status] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            const prev = VALID_PREV[project.status];
                            if (prev) setMoveDialog({ project, newStatus: prev });
                          }}
                        >
                          <ArrowLeft className="h-3 w-3 mr-1" />
                          Back
                        </Button>
                      )}
                      {VALID_NEXT[project.status] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs ml-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = VALID_NEXT[project.status];
                            if (next) setMoveDialog({ project, newStatus: next });
                          }}
                        >
                          Next
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </AppleCard>
                </div>
              ))}
              {(!projectsByStatus[col.id] || projectsByStatus[col.id].length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                  No projects
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Project Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KanbanSquare className="h-5 w-5 text-primary" />
              {selectedProject?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Project ID:</span>
              <span className="font-mono">{selectedProject?.projectId}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="capitalize">{selectedProject?.status?.replace(/_/g, " ")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Customer:</span>
              <span>{selectedProject?.customerName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Product:</span>
              <span>{selectedProject?.productName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Assigned Developer:</span>
              <span>{selectedProject?.assignedDeveloperName || "Unassigned"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Start Date:</span>
              <span>{selectedProject?.startDate || "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Due Date:</span>
              <span>{selectedProject?.dueDate || "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Progress:</span>
              <span>{selectedProject?.progress || 0}%</span>
            </div>
            {selectedProject?.description && (
              <div className="pt-2">
                <span className="text-muted-foreground block mb-1">Description:</span>
                <p className="text-muted-foreground">{selectedProject.description}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Confirmation Dialog */}
      <Dialog open={!!moveDialog} onOpenChange={() => setMoveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move <strong>{moveDialog?.project?.name}</strong> to{" "}
            <strong className="capitalize">{moveDialog?.newStatus?.replace(/_/g, " ")}</strong>?
          </p>
          {moveDialog?.newStatus === "completed" && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              This will validate: admin approval, customer exists, product exists, invoice exists, and balance = 0.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setMoveDialog(null)}>Cancel</Button>
            <Button
              onClick={confirmMove}
              disabled={isBusy}
            >
              {isBusy ? "Moving..." : "Move"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
