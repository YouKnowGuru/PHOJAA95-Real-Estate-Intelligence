import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getStatusVariant, formatStatusLabel } from "@/components/software-dev/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Briefcase,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "pending_approval", label: "Pending Approval", color: "warning" },
  { value: "approved", label: "Approved", color: "info" },
  { value: "in_progress", label: "In Progress", color: "primary" },
  { value: "testing", label: "Testing", color: "warning" },
  { value: "uat", label: "UAT", color: "warning" },
  { value: "completed", label: "Completed", color: "success" },
  { value: "delivered", label: "Delivered", color: "success" },
  { value: "rejected", label: "Rejected", color: "destructive" },
  { value: "cancelled", label: "Cancelled", color: "secondary" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function SoftwareProjects() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewProject, setViewProject] = useState<any>(null);

  const { data: customers } = trpc.softwareCustomer.list.useQuery({ page: 1, limit: 100 });
  const { data: products } = trpc.softwareProduct.list.useQuery({ page: 1, limit: 100 });
  const { data: developers } = trpc.user.list.useQuery({ page: 1, limit: 100 });

  const { data, isLoading, refetch } = trpc.softwareProject.list.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    page,
    limit: 10,
  });

  const createMutation = trpc.softwareProject.create.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const submitMutation = trpc.softwareProject.submitForApproval.useMutation({
    onSuccess: () => {
      toast.success("Project submitted for approval");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.softwareProject.approve.useMutation({
    onSuccess: () => {
      toast.success("Project status updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const statusMutation = trpc.softwareProject.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Project status updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.softwareProject.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get("name") as string,
      customerId: Number(formData.get("customerId")),
      productId: Number(formData.get("productId")),
      description: formData.get("description") as string,
      scopeOfWork: formData.get("scopeOfWork") as string,
      requirements: formData.get("requirements") as string,
      estimatedBudget: formData.get("estimatedBudget") as string,
      estimatedDuration: formData.get("estimatedDuration") as string,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      priority: formData.get("priority") as any,
      assignedDeveloperId: formData.get("assignedDeveloperId") ? Number(formData.get("assignedDeveloperId")) : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading projects..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Software Projects"
        description="Manage your software development projects"
        icon={<Briefcase className="h-5 w-5" />}
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Name</label>
                  <Input name="name" required placeholder="Enter project name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Customer</label>
                    <Select name="customerId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.items?.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.fullName} {c.companyName ? `(${c.companyName})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Product</label>
                    <Select name="productId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.items?.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    name="description"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Project description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Scope of Work</label>
                    <textarea
                      name="scopeOfWork"
                      className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Scope of work..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Requirements</label>
                    <textarea
                      name="requirements"
                      className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Requirements..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estimated Budget</label>
                    <Input name="estimatedBudget" type="number" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estimated Duration</label>
                    <Input name="estimatedDuration" placeholder="e.g. 3 months" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input name="startDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Input name="endDate" type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select name="priority" defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assigned Developer</label>
                    <Select name="assignedDeveloperId">
                      <SelectTrigger>
                        <SelectValue placeholder="Select developer" />
                      </SelectTrigger>
                      <SelectContent>
                        {developers?.items?.map((d: any) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Projects Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Project ID</th>
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Priority</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((project: any) => (
                  <tr key={project.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-xs">{project.projectId}</td>
                    <td className="py-3 px-4 font-medium">{project.name}</td>
                    <td className="py-3 px-4">
                      <span className={`capitalize ${
                        project.priority === "urgent" ? "text-red-500" :
                        project.priority === "high" ? "text-orange-500" :
                        project.priority === "medium" ? "text-yellow-500" : "text-green-500"
                      }`}>
                        {project.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge variant={getStatusVariant(project.status)}>{formatStatusLabel(project.status)}</StatusBadge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewProject(project)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(project.status === "draft" || project.status === "rejected") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => submitMutation.mutate({ id: project.id })}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && project.status === "pending_approval" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => approveMutation.mutate({ id: project.id, status: "approved" })}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const reason = prompt("Rejection reason:");
                                if (reason) approveMutation.mutate({ id: project.id, status: "rejected", reason });
                              }}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {["approved", "in_progress", "testing", "uat", "completed"].includes(project.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const nextMap: Record<string, "in_progress" | "testing" | "uat" | "completed" | "delivered"> = {
                                approved: "in_progress",
                                in_progress: "testing",
                                testing: "uat",
                                uat: "completed",
                                completed: "delivered",
                              };
                              const nextStatus = nextMap[project.status as string];
                              if (nextStatus) statusMutation.mutate({ id: project.id, status: nextStatus });
                            }}
                            title="Advance status"
                          >
                            <ArrowRight className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this project?")) deleteMutation.mutate({ id: project.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No projects found"
            description="Create your first software project to get started."
            icon={Briefcase}
          />
        )}
      </AppleCard>

      {/* View Project Dialog */}
      <Dialog open={!!viewProject} onOpenChange={() => setViewProject(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewProject?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Project ID:</span>
              <span className="font-mono">{viewProject?.projectId}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Priority:</span>
              <span className="capitalize">{viewProject?.priority}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Status:</span>
              <StatusBadge variant={getStatusVariant(viewProject?.status)}>{formatStatusLabel(viewProject?.status)}</StatusBadge>
            </div>
            {viewProject?.startDate && (
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Start Date:</span>
                <span>{viewProject.startDate}</span>
              </div>
            )}
            {viewProject?.endDate && (
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">End Date:</span>
                <span>{viewProject.endDate}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
