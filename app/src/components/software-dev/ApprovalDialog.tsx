import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  Clock,
  MessageSquare,
  History,
  Package,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: "product" | "project" | "sale";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: any;
  onApproved: () => void;
}

const ENTITY_TYPE_LABELS = {
  product: "Product",
  project: "Project",
  sale: "Sale",
};

function getStatusVariant(status: string): "success" | "warning" | "error" | "info" | "neutral" | "primary" {
  switch (status) {
    case "approved":
    case "published":
    case "completed":
      return "success";
    case "pending_approval":
    case "pending":
    case "processing":
      return "warning";
    case "rejected":
      return "error";
    case "draft":
      return "info";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString();
}

export function ApprovalDialog({
  open,
  onClose,
  entityType,
  entity,
  onApproved,
}: ApprovalDialogProps) {
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"idle" | "reject">("idle");

  const { data: activityLog, isLoading: logLoading } =
    trpc.softwareProduct.activityLog.useQuery(
      { id: entity?.id },
      { enabled: open && entityType === "product" && !!entity?.id }
    );

  const resetForm = () => {
    setReason("");
    setMode("idle");
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const handleSuccess = (message: string) => {
    toast.success(message);
    onApproved();
    resetForm();
    onClose();
  };

  const productApprove = trpc.softwareProduct.approve.useMutation({
    onSuccess: (_, vars) => {
      const label =
        vars.status === "published" ? "published" : vars.status === "rejected" ? "rejected" : "approved";
      handleSuccess(`Product ${label}`);
    },
    onError: (err) => toast.error(`Approval failed: ${err.message}`),
  });

  const projectApprove = trpc.softwareProject.approve.useMutation({
    onSuccess: (_, vars) => {
      handleSuccess(vars.status === "rejected" ? "Project rejected" : "Project approved");
    },
    onError: (err) => toast.error(`Approval failed: ${err.message}`),
  });

  const saleApprove = trpc.softwareSale.approve.useMutation({
    onSuccess: (_, vars) => {
      handleSuccess(vars.action === "reject" ? "Sale rejected" : "Sale approved");
    },
    onError: (err) => toast.error(`Approval failed: ${err.message}`),
  });

  if (!entity) return null;

  const handleApprove = () => {
    if (entityType === "sale") {
      saleApprove.mutate({ id: entity.id, action: "approve", reason: reason.trim() || undefined });
    } else if (entityType === "project") {
      projectApprove.mutate({ id: entity.id, status: "approved", reason: reason.trim() || undefined });
    } else {
      productApprove.mutate({ id: entity.id, status: "approved", reason: reason.trim() || undefined });
    }
  };

  const handleReject = () => {
    if (!reason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (entityType === "sale") {
      saleApprove.mutate({ id: entity.id, action: "reject", reason: reason.trim() });
    } else if (entityType === "project") {
      projectApprove.mutate({ id: entity.id, status: "rejected", reason: reason.trim() });
    } else {
      productApprove.mutate({ id: entity.id, status: "rejected", reason: reason.trim() });
    }
  };

  const handlePublish = () => {
    productApprove.mutate({
      id: entity.id,
      status: "published",
      reason: reason.trim() || undefined,
    });
  };

  const isPending = productApprove.isPending || projectApprove.isPending || saleApprove.isPending;
  const displayName = entity.name || entity.productName || entity.saleNumber || `#${entity.id}`;
  const plainDescription =
    entity.description ||
    (entity.detailedDescription ? stripHtml(entity.detailedDescription) : "") ||
    entity.shortDescription ||
    "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={!isPending}
        className="flex max-h-[min(92dvh,900px)] w-[min(100vw-1rem,42rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-full"
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
            <span className="truncate">Review {ENTITY_TYPE_LABELS[entityType]}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          <AppleCard hover={false} className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-semibold break-words sm:text-lg">{displayName}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entity.projectId && `ID: ${entity.projectId}`}
                  {entity.productCode && `Code: ${entity.productCode}`}
                  {entity.saleNumber && `Sale: ${entity.saleNumber}`}
                </p>
              </div>
              <StatusBadge variant={getStatusVariant(entity.status)}>
                {formatStatus(entity.status)}
              </StatusBadge>
            </div>

            {entityType === "project" && (
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {entity.customerName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span>
                      Customer: <span className="font-medium text-foreground">{entity.customerName}</span>
                    </span>
                  </div>
                )}
                {entity.productName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="h-4 w-4 shrink-0" />
                    <span>
                      Product: <span className="font-medium text-foreground">{entity.productName}</span>
                    </span>
                  </div>
                )}
                {entity.assignedDeveloperName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span>
                      Developer:{" "}
                      <span className="font-medium text-foreground">{entity.assignedDeveloperName}</span>
                    </span>
                  </div>
                )}
                {(entity.startDate || entity.endDate) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      Timeline: {formatDate(entity.startDate)} – {formatDate(entity.endDate)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {entity.shortDescription && entityType !== "project" && (
              <p className="mt-3 text-sm text-muted-foreground">{entity.shortDescription}</p>
            )}

            {plainDescription && (
              <p className="mt-3 line-clamp-6 text-sm text-muted-foreground">{plainDescription}</p>
            )}

            {entity.features && Array.isArray(entity.features) && entity.features.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entity.features.map((f: string, i: number) => (
                  <span key={i} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                    {f}
                  </span>
                ))}
              </div>
            )}

            {entity.technologiesUsed && (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Technologies: </span>
                {entity.technologiesUsed}
              </p>
            )}
          </AppleCard>

          {(entity.price || entity.grandTotal) && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 text-sm font-medium">Pricing</h4>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {entity.price != null && (
                  <div>
                    <span className="text-muted-foreground">Base Price:</span>
                    <span className="ml-2 font-semibold">Nu.{entity.price}</span>
                  </div>
                )}
                {entity.grandTotal != null && (
                  <div>
                    <span className="text-muted-foreground">Grand Total:</span>
                    <span className="ml-2 font-semibold">Nu.{entity.grandTotal}</span>
                  </div>
                )}
                {entity.outstandingBalance != null && (
                  <div>
                    <span className="text-muted-foreground">Outstanding:</span>
                    <span
                      className={cn(
                        "ml-2 font-semibold",
                        Number(entity.outstandingBalance) > 0 ? "text-red-500" : "text-green-500"
                      )}
                    >
                      Nu.{entity.outstandingBalance}
                    </span>
                  </div>
                )}
              </div>
            </AppleCard>
          )}

          <AppleCard hover={false} className="p-4">
            <h4 className="mb-2 text-sm font-medium">Submission Info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Created by:</span>
                <span className="font-medium">{entity.creatorName || `User #${entity.createdBy}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Submitted:</span>
                <span>{formatDate(entity.createdAt)}</span>
              </div>
              {entity.rejectionReason && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs dark:bg-red-950/30">
                  <span className="font-medium text-red-700 dark:text-red-300">Previous rejection:</span>
                  <p className="mt-1 text-red-600 dark:text-red-400">{entity.rejectionReason}</p>
                </div>
              )}
            </div>
          </AppleCard>

          {entityType === "product" && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" />
                Activity History
              </h4>
              {logLoading ? (
                <OniLoader size="sm" text="Loading activity..." />
              ) : activityLog && activityLog.length > 0 ? (
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {activityLog.map((log: { id: number; userName?: string; action: string; createdAt: string }) => (
                    <div key={log.id} className="flex items-start gap-2 text-sm">
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-1">
                          <span className="font-medium">{log.userName || "System"}</span>
                          <span className="text-muted-foreground">{log.action.replace(/_/g, " ")}</span>
                        </div>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              )}
            </AppleCard>
          )}

          {mode === "idle" && entityType === "product" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Optional notes</label>
              <Textarea
                placeholder="Add notes for the creator (optional)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[72px] text-sm"
                disabled={isPending}
              />
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {mode === "reject" && (
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-medium">
                <MessageSquare className="h-3.5 w-3.5" />
                Rejection reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Explain why this is being rejected..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[88px] text-sm"
                disabled={isPending}
                autoFocus
              />
            </div>
          )}

          {mode === "reject" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => {
                  setMode("idle");
                  setReason("");
                }}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="min-h-11 flex-1"
                onClick={handleReject}
                disabled={isPending || !reason.trim()}
              >
                {isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:flex-1"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="min-h-11 sm:flex-1"
                onClick={() => setMode("reject")}
                disabled={isPending}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Reject
              </Button>
              <Button
                type="button"
                className="min-h-11 sm:flex-[1.2]"
                onClick={handleApprove}
                disabled={isPending}
              >
                {isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          )}

          {mode === "idle" && entityType === "product" && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full"
              onClick={handlePublish}
              disabled={isPending}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Approve & Publish
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
