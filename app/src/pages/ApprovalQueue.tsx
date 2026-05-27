import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Building2,
  User,
  DollarSign,
  Layers,
  PackageOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { STEP_LABELS } from "@/constants/workflow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { AppleCard, AppleCardHeader, AppleCardTitle, AppleCardDescription, AppleCardContent } from "@/components/ui/apple-card";
import { KPICard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ApprovalQueue() {
  const utils = trpc.useUtils();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [action, setAction] = useState<string>("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectPropertyId, setRejectPropertyId] = useState<number | null>(null);
  const [rejectStep, setRejectStep] = useState<number>(1);
  const [rejectComments, setRejectComments] = useState("");

  const { data: pendingProperties, isLoading } = trpc.property.pendingApprovals.useQuery(
    undefined,
    { refetchInterval: 15000 }
  );

  const approveMutation = trpc.property.approveStep.useMutation({
    onSuccess: () => {
      toast.success("Property step approved");
      utils.property.pendingApprovals.invalidate();
      utils.property.dashboardStats.invalidate();
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
      setProcessingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setProcessingId(null);
    },
  });

  const rejectMutation = trpc.property.rejectStep.useMutation({
    onSuccess: () => {
      toast.success("Property step rejected");
      utils.property.pendingApprovals.invalidate();
      utils.property.dashboardStats.invalidate();
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
      setProcessingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setProcessingId(null);
    },
  });

  const handleApprove = (propertyId: number, step: number) => {
    setProcessingId(propertyId);
    setAction("approving");
    approveMutation.mutate({ propertyId, step });
  };

  const openRejectDialog = (propertyId: number, step: number) => {
    setRejectPropertyId(propertyId);
    setRejectStep(step);
    setRejectComments("");
    setRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (!rejectPropertyId) return;
    setProcessingId(rejectPropertyId);
    setAction("rejecting");
    setRejectDialogOpen(false);
    rejectMutation.mutate({
      propertyId: rejectPropertyId,
      step: rejectStep,
      comments: rejectComments,
    });
  };

  const totalPending = pendingProperties?.length || 0;

  return (
    <AnimatedPage>
      <PageHeader
        title="Approval Queue"
        description="Review and approve pending property steps"
        icon={<ClipboardList className="h-5 w-5" />}
      />

      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Pending" value={totalPending} icon={ClipboardList} color="bg-amber-500" delay={0} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : pendingProperties?.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No pending approvals"
          description="All property steps have been reviewed. Great job!"
        />
      ) : (
        <div className="space-y-4">
          {pendingProperties?.map((property, index) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <AppleCard>
                <AppleCardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold">{property.propertyName}</h3>
                        <StatusBadge variant="warning" dot pulse>
                          Step {property.currentStep}
                        </StatusBadge>
                        <Badge variant="outline" className="text-[10px] rounded-full">
                          {STEP_LABELS[property.currentStep] || "Unknown"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate">{property.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>Nu. {parseFloat(property.sellingPrice || "0").toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="truncate">{property.propertyTypeName || "Property"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Layers className="h-3.5 w-3.5" />
                          <span className="truncate">{property.listedByName || "Unknown"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRejectDialog(property.id, property.currentStep)}
                        disabled={processingId === property.id}
                        className="gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(property.id, property.currentStep)}
                        disabled={processingId === property.id}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {processingId === property.id && action === "approving" ? "..." : "Approve"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link to={`/properties/${property.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </AppleCardContent>
              </AppleCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reject Property Step</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this step. This will be visible to the staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Comments</label>
              <Textarea
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
