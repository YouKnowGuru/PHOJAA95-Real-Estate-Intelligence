import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function SummaryCard({ title, value, color, iconBg, icon: Icon, delay = 0 }: { title: string; value: string | number; color: string; iconBg: string; icon: any; delay?: number }) {
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
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

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
    { refetchInterval: 15000 } // Poll every 15 seconds
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
    setAction("approve");
    approveMutation.mutate({ propertyId, step, comments: `Step ${step} approved` });
  };

  const handleReject = (propertyId: number, step: number) => {
    setRejectPropertyId(propertyId);
    setRejectStep(step);
    setRejectComments("");
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!rejectPropertyId || !rejectComments.trim()) {
      toast.error("Please enter rejection comments");
      return;
    }
    setProcessingId(rejectPropertyId);
    setAction("reject");
    rejectMutation.mutate({ 
      propertyId: rejectPropertyId, 
      step: rejectStep, 
      comments: rejectComments 
    });
    setRejectDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary" />
          Approval Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve pending workflow steps
        </p>
      </motion.div>

      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Pending Approvals" value={pendingProperties?.length || 0} color="bg-primary" iconBg="bg-primary/10 dark:bg-primary/20" icon={ClipboardList} delay={0} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50 bg-white/70 dark:bg-slate-800/70 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-10" />
                    <Skeleton className="h-8 w-10" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pendingProperties?.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
            <CardContent className="py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-bold text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">No pending approvals in the queue. Check back later for new submissions.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {pendingProperties?.map((property, index) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Card className="relative border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-primary/5">
                <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Image Thumbnail */}
                    <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-border/50 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-muted-foreground/30" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {property.propertyName || "Untitled Property"}
                        </h3>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          Step {property.currentStep}: {STEP_LABELS[property.currentStep] || "Processing"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium text-foreground">{property.propertyTypeName || "Unknown Type"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Owner:</span>
                          <span className="font-medium text-foreground truncate">{property.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-emerald-500" />
                          <span className="text-muted-foreground">Buyer:</span>
                          <span className="font-medium text-foreground truncate">{property.buyerName || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-medium text-foreground">Nu. {parseFloat(property.sellingPrice).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Owner CID:</span>
                          <span className="font-medium text-foreground">{property.ownerCID}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Listed by: <span className="font-medium text-foreground">{property.listedByName || "System"}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {property.createdAt ? `• ${new Date(property.createdAt).toLocaleDateString()}` : ""}
                        </span>
                        {property.rejectionComments && (
                          <span className="text-red-500 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {property.rejectionComments}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/properties/${property.id}`}>
                        <Button variant="outline" size="sm" className="rounded-lg">
                          View
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleReject(property.id, property.currentStep)}
                        disabled={processingId === property.id}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-lg bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20"
                        onClick={() => handleApprove(property.id, property.currentStep)}
                        disabled={processingId === property.id}
                      >
                        {processingId === property.id && action === "approve" ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Property</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this property. This will be visible to the staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectComments.trim() || processingId === rejectPropertyId}
            >
              {processingId === rejectPropertyId && action === "reject" ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
