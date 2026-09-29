import { AppleCard } from "@/components/ui/apple-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getEntityDisplayName, getStatusVariant, formatStatusLabel } from "./utils";
import {
  Eye,
  Send,
  CheckCircle,
  Trash2,
  Pencil,
  Calendar,
  User,
  Tag,
  DollarSign,
  Package,
  Building,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Award,
  Printer,
  Download,
} from "lucide-react";

interface EntityCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: any;
  type: "product" | "project" | "sale" | "customer" | "invoice" | "certificate" | "document" | "payment";
  isAdmin?: boolean;
  canManage?: boolean;
  footerSlot?: React.ReactNode;
  onView?: () => void;
  onEdit?: () => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  onDownload?: () => void;
}

const TYPE_CONFIG = {
  product: { icon: Package, color: "text-blue-500" },
  project: { icon: FileText, color: "text-amber-500" },
  sale: { icon: DollarSign, color: "text-green-500" },
  customer: { icon: Building, color: "text-purple-500" },
  invoice: { icon: FileText, color: "text-orange-500" },
  certificate: { icon: Award, color: "text-emerald-500" },
  document: { icon: FileText, color: "text-slate-500" },
  payment: { icon: CreditCard, color: "text-cyan-500" },
};

function stripHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function EntityCard({
  entity,
  type,
  isAdmin = false,
  canManage = true,
  footerSlot,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onDelete,
  onPrint,
  onDownload,
}: EntityCardProps) {
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  const canSubmit =
    canManage &&
    (type === "product" || type === "project" || type === "sale") &&
    (entity.status === "draft" || entity.status === "rejected");

  const canEditEntity =
    canManage &&
    (type === "document" ||
      type === "customer" ||
      (type === "product" && !["approved", "published", "completed"].includes(entity.status)) ||
      (type === "project" && !["completed", "delivered", "cancelled"].includes(entity.status)) ||
      // "document"/"customer" already returned true above, so only these remain
      (type !== "product" &&
        type !== "project" &&
        entity.status === "draft"));

  const canApprove =
    isAdmin &&
    (type === "product" || type === "project" || type === "sale") &&
    entity.status === "pending_approval";

  const showDelete = canManage && Boolean(onDelete);

  const features =
    entity.features && Array.isArray(entity.features)
      ? entity.features
      : entity.features
        ? String(entity.features)
            .split(",")
            .map((f: string) => f.trim())
            .filter(Boolean)
        : [];

  const hasActions = Boolean(
    onView ||
      (onEdit && canEditEntity) ||
      (canSubmit && onSubmit) ||
      (canApprove && onApprove) ||
      onPrint ||
      onDownload ||
      showDelete ||
      footerSlot
  );

  return (
    <AppleCard hover={false} className="entity-card-static p-4">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", "bg-muted")}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold break-words">{getEntityDisplayName(entity, type)}</h4>
              {entity.productCode && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {entity.productCode}
                </span>
              )}
              {entity.projectId && type === "project" && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {entity.projectId}
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {entity.category && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3 shrink-0" />
                  {entity.category.replace(/_/g, " ")}
                </span>
              )}
              {entity.customerName && (type === "project" || type === "sale" || type === "invoice") && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 shrink-0" />
                  {entity.customerName}
                </span>
              )}
              {entity.price !== undefined && entity.price !== null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  Nu.{entity.price}
                </span>
              )}
              {entity.grandTotal !== undefined && entity.grandTotal !== null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  Nu.{entity.grandTotal}
                </span>
              )}
              {entity.totalAmount !== undefined && entity.totalAmount !== null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  Nu.{entity.totalAmount}
                </span>
              )}
              {entity.amount !== undefined && entity.amount !== null && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  Nu.{entity.amount}
                </span>
              )}
              {entity.invoiceNumber && type === "invoice" && (
                <span className="flex items-center gap-1 font-mono text-xs">{entity.invoiceNumber}</span>
              )}
              {entity.email && (
                <span className="flex items-center gap-1 break-all">
                  <Mail className="h-3 w-3 shrink-0" />
                  {entity.email}
                </span>
              )}
              {entity.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" />
                  {entity.phone}
                </span>
              )}
              {entity.companyName && (
                <span className="flex items-center gap-1">
                  <Building className="h-3 w-3 shrink-0" />
                  {entity.companyName}
                </span>
              )}
              {entity.assignedDeveloperName && type === "project" && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 shrink-0" />
                  {entity.assignedDeveloperName}
                </span>
              )}
              {entity.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {new Date(entity.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {(entity.shortDescription || entity.detailedDescription || entity.description) && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {entity.shortDescription ||
                  stripHtml(entity.detailedDescription).substring(0, 120) ||
                  entity.description?.substring(0, 120)}
                {(entity.detailedDescription?.length > 120 || entity.description?.length > 120) && "..."}
              </p>
            )}

            {features.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {features.slice(0, 5).map((f: string, i: number) => (
                  <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {f}
                  </span>
                ))}
                {features.length > 5 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    +{features.length - 5}
                  </span>
                )}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {entity.status && (
                <StatusBadge variant={getStatusVariant(entity.status)}>
                  {formatStatusLabel(entity.status)}
                </StatusBadge>
              )}
              {entity.certificateType && type === "certificate" && (
                <StatusBadge variant="success">{formatStatusLabel(entity.certificateType)}</StatusBadge>
              )}
              {entity.priority && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    entity.priority === "urgent" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                    entity.priority === "high" &&
                      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                    entity.priority === "medium" &&
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                    entity.priority === "low" &&
                      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  {entity.priority}
                </span>
              )}
              {entity.paymentStatus && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {formatStatusLabel(entity.paymentStatus)}
                </span>
              )}
              {entity.version && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">v{entity.version}</span>
              )}
            </div>
          </div>
        </div>

        {hasActions && (
          <div className="space-y-2 border-t border-border/50 pt-2">
            {(onView ||
              (onEdit && canEditEntity) ||
              (canSubmit && onSubmit) ||
              (canApprove && onApprove) ||
              onPrint ||
              onDownload ||
              showDelete) && (
              <div className="software-dev-actions">
                {onView && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onView}
                    title="View"
                    className="h-10 min-w-10 px-3"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="ml-1.5">View</span>
                  </Button>
                )}
                {onEdit && canEditEntity && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onEdit}
                    title="Edit"
                    className="h-10 min-w-10 px-3"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="ml-1.5">Edit</span>
                  </Button>
                )}
                {canSubmit && onSubmit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onSubmit}
                    title="Submit for approval"
                    className="h-10 min-w-10 px-3"
                  >
                    <Send className="h-4 w-4 text-blue-500" />
                    <span className="ml-1.5">Submit</span>
                  </Button>
                )}
                {canApprove && onApprove && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onApprove}
                    title="Review for approval"
                    className="h-10 min-w-10 border-amber-200 bg-amber-50 px-3 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20"
                  >
                    <CheckCircle className="h-4 w-4 text-amber-600" />
                    <span className="ml-1.5">Review</span>
                  </Button>
                )}
                {onPrint && (
                  <Button type="button" size="sm" variant="outline" onClick={onPrint} title="Print" className="h-10 min-w-10 px-3">
                    <Printer className="h-4 w-4" />
                    <span className="ml-1.5">Print</span>
                  </Button>
                )}
                {onDownload && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onDownload}
                    title={type === "certificate" ? "Download PDF" : "Download"}
                    className="h-10 min-w-10 px-3"
                  >
                    <Download className="h-4 w-4" />
                    {type === "certificate" && <span className="ml-1.5">PDF</span>}
                  </Button>
                )}
                {showDelete && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onDelete}
                    title="Delete"
                    className="h-10 min-w-10 px-3 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-1.5">Delete</span>
                  </Button>
                )}
              </div>
            )}
            {footerSlot && <div className="flex flex-wrap gap-2">{footerSlot}</div>}
          </div>
        )}
      </div>
    </AppleCard>
  );
}
