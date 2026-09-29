import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppleCard } from "@/components/ui/apple-card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Calendar,
  Tag,
  DollarSign,
  FileText,
  Wrench,
  Shield,
  Package,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getEntityDisplayName, getStatusVariant, formatStatusLabel } from "./utils";

interface DetailViewDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: any;
  type: "product" | "project" | "sale" | "customer" | "invoice" | "certificate" | "document" | "payment";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_ICONS: Record<string, any> = {
  website: Package,
  web_application: Package,
  android_application: Package,
  ios_application: Package,
  desktop_software: Package,
  erp_system: Package,
  pos_system: Package,
  crm_system: Package,
  ecommerce_platform: Package,
  saas_platform: Package,
  api_service: Package,
  custom_software: Package,
};

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-border/40 py-2 last:border-0 sm:grid-cols-[minmax(0,38%)_1fr] sm:gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

function formatDate(value: unknown) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function stripHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function DetailViewDialog({
  open,
  onClose,
  title,
  entity,
  type,
}: DetailViewDialogProps) {
  if (!entity) return null;

  const CategoryIcon = (entity.category && CATEGORY_ICONS[entity.category]) || Package;
  const statusForBadge = type === "certificate" ? undefined : entity.status;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[min(92dvh,900px)] w-[min(100vw-1rem,42rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
            <CategoryIcon className="h-5 w-5 shrink-0 text-primary" />
            <span className="break-words">{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          <AppleCard hover={false} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold break-words">{getEntityDisplayName(entity, type)}</h3>
                {entity.productCode && <p className="text-sm text-muted-foreground">Code: {entity.productCode}</p>}
                {entity.projectId && type === "project" && (
                  <p className="font-mono text-sm text-muted-foreground">{entity.projectId}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {statusForBadge && (
                  <StatusBadge variant={getStatusVariant(entity.status)}>
                    {formatStatusLabel(entity.status)}
                  </StatusBadge>
                )}
                {type === "certificate" && entity.certificateType && (
                  <StatusBadge variant="success">{formatStatusLabel(entity.certificateType)}</StatusBadge>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {entity.category && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  {entity.category.replace(/_/g, " ")}
                </span>
              )}
              {entity.price != null && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  Nu.{entity.price}
                </span>
              )}
              {entity.grandTotal != null && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  Nu.{entity.grandTotal}
                </span>
              )}
              {entity.createdAt && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(entity.createdAt)}
                </span>
              )}
            </div>
          </AppleCard>

          {(type === "customer" ||
            type === "project" ||
            type === "sale" ||
            type === "invoice" ||
            type === "payment" ||
            type === "certificate" ||
            type === "document") && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 text-sm font-medium">Details</h4>
              <div>
                {type === "customer" && (
                  <>
                    <DetailRow label="Email" value={entity.email} />
                    <DetailRow label="Phone" value={entity.phone} />
                    <DetailRow label="Company" value={entity.companyName} />
                    <DetailRow label="Address" value={entity.address} />
                    <DetailRow label="Customer ID" value={entity.customerId} />
                    <DetailRow label="Notes" value={entity.notes} />
                  </>
                )}
                {type === "project" && (
                  <>
                    <DetailRow label="Customer" value={entity.customerName} />
                    <DetailRow label="Product" value={entity.productName} />
                    <DetailRow label="Developer" value={entity.assignedDeveloperName || "Unassigned"} />
                    <DetailRow label="Priority" value={entity.priority ? formatStatusLabel(entity.priority) : undefined} />
                    <DetailRow label="Start Date" value={formatDate(entity.startDate)} />
                    <DetailRow label="End Date" value={formatDate(entity.endDate)} />
                    <DetailRow label="Budget" value={entity.estimatedBudget ? `Nu.${entity.estimatedBudget}` : undefined} />
                    <DetailRow label="Requirements" value={entity.requirements} />
                  </>
                )}
                {type === "sale" && (
                  <>
                    <DetailRow label="Sale Number" value={entity.saleNumber} />
                    <DetailRow label="Customer" value={entity.customerName} />
                    <DetailRow label="Product" value={entity.productName} />
                    <DetailRow label="Base Price" value={entity.basePrice != null ? `Nu.${entity.basePrice}` : undefined} />
                    <DetailRow label="Delivery Date" value={formatDate(entity.deliveryDate)} />
                    <DetailRow label="Payment Terms" value={entity.paymentTerms} />
                    <DetailRow label="Notes" value={entity.notes} />
                  </>
                )}
                {type === "invoice" && (
                  <>
                    <DetailRow label="Invoice Number" value={entity.invoiceNumber} />
                    <DetailRow label="Sale ID" value={entity.saleId} />
                    <DetailRow label="Issue Date" value={formatDate(entity.issueDate)} />
                    <DetailRow label="Due Date" value={formatDate(entity.dueDate)} />
                    <DetailRow label="Total Amount" value={entity.totalAmount != null ? `Nu.${entity.totalAmount}` : undefined} />
                    <DetailRow label="Amount Paid" value={entity.amountPaid != null ? `Nu.${entity.amountPaid}` : undefined} />
                    <DetailRow
                      label="Outstanding"
                      value={entity.outstandingAmount != null ? `Nu.${entity.outstandingAmount}` : undefined}
                    />
                  </>
                )}
                {type === "payment" && (
                  <>
                    <DetailRow label="Payment Number" value={entity.paymentNumber} />
                    <DetailRow label="Amount" value={entity.amount != null ? `Nu.${entity.amount}` : undefined} />
                    <DetailRow label="Payment Date" value={formatDate(entity.paymentDate)} />
                    <DetailRow
                      label="Method"
                      value={entity.paymentMethod ? formatStatusLabel(entity.paymentMethod) : undefined}
                    />
                    <DetailRow label="Reference" value={entity.referenceNumber} />
                    <DetailRow label="Notes" value={entity.notes} />
                  </>
                )}
                {type === "certificate" && (
                  <>
                    <DetailRow label="Certificate Number" value={entity.certificateNumber} />
                    <DetailRow label="Verification Number" value={entity.verificationNumber} />
                    <DetailRow label="Customer" value={entity.customerName} />
                    <DetailRow label="Product" value={entity.productName} />
                    <DetailRow label="Completion Date" value={formatDate(entity.completionDate)} />
                    <DetailRow label="Developer" value={entity.developerName} />
                    <DetailRow
                      label="Warranty"
                      value={entity.warrantyPeriod ? `${entity.warrantyPeriod} months` : undefined}
                    />
                  </>
                )}
                {type === "document" && (
                  <>
                    <DetailRow label="Category" value={entity.category ? formatStatusLabel(entity.category) : undefined} />
                    <DetailRow label="Version" value={entity.version ? `v${entity.version}` : undefined} />
                    <DetailRow label="File Name" value={entity.fileName} />
                    <DetailRow
                      label="File Size"
                      value={entity.fileSize ? `${Math.round(entity.fileSize / 1024)} KB` : undefined}
                    />
                    <DetailRow label="Description" value={entity.description} />
                  </>
                )}
              </div>
              {type === "document" && entity.fileUrl && (
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm" className="min-h-10">
                    <a href={entity.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download File
                    </a>
                  </Button>
                </div>
              )}
            </AppleCard>
          )}

          {entity.detailedDescription && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 text-sm font-medium">Description</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{stripHtml(entity.detailedDescription)}</p>
            </AppleCard>
          )}

          {entity.description && !entity.detailedDescription && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 text-sm font-medium">Description</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{entity.description}</p>
            </AppleCard>
          )}

          {entity.features && Array.isArray(entity.features) && entity.features.length > 0 && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 text-sm font-medium">Features</h4>
              <div className="flex flex-wrap gap-1.5">
                {entity.features.map((f: string, i: number) => (
                  <span key={i} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                    {f}
                  </span>
                ))}
              </div>
            </AppleCard>
          )}

          {entity.technologiesUsed && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Wrench className="h-4 w-4" />
                Technologies Used
              </h4>
              <p className="text-sm text-muted-foreground">{entity.technologiesUsed}</p>
            </AppleCard>
          )}

          {(entity.demoUrl || entity.documentationUrl) && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 text-sm font-medium">Links</h4>
              <div className="space-y-2">
                {entity.demoUrl && (
                  <a
                    href={entity.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 break-all text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    Demo URL
                  </a>
                )}
                {entity.documentationUrl && (
                  <a
                    href={entity.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 break-all text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    Documentation
                  </a>
                )}
              </div>
            </AppleCard>
          )}

          {(entity.warrantyPeriod || entity.maintenancePeriod) && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4" />
                Support
              </h4>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {entity.warrantyPeriod > 0 && (
                  <div>
                    <span className="text-muted-foreground">Warranty:</span>
                    <span className="ml-2 font-medium">{entity.warrantyPeriod} months</span>
                  </div>
                )}
                {entity.maintenancePeriod > 0 && (
                  <div>
                    <span className="text-muted-foreground">Maintenance:</span>
                    <span className="ml-2 font-medium">{entity.maintenancePeriod} months</span>
                  </div>
                )}
              </div>
            </AppleCard>
          )}

          {type === "sale" && (
            <AppleCard hover={false} className="p-4">
              <h4 className="mb-2 text-sm font-medium">Payment Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col justify-between gap-1 sm:flex-row">
                  <span className="text-muted-foreground">Payment Type:</span>
                  <span>{entity.paymentType ? formatStatusLabel(entity.paymentType) : "—"}</span>
                </div>
                <div className="flex flex-col justify-between gap-1 sm:flex-row">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <StatusBadge variant={getStatusVariant(entity.paymentStatus)}>
                    {formatStatusLabel(entity.paymentStatus)}
                  </StatusBadge>
                </div>
                <div className="flex flex-col justify-between gap-1 sm:flex-row">
                  <span className="text-muted-foreground">Total Paid:</span>
                  <span>Nu.{entity.totalPaid ?? 0}</span>
                </div>
                <div className="flex flex-col justify-between gap-1 sm:flex-row">
                  <span className="text-muted-foreground">Outstanding:</span>
                  <span
                    className={cn(
                      "font-medium",
                      Number(entity.outstandingBalance) > 0 ? "text-red-500" : "text-green-500"
                    )}
                  >
                    Nu.{entity.outstandingBalance ?? 0}
                  </span>
                </div>
              </div>
            </AppleCard>
          )}

          {entity.rejectionReason && (
            <AppleCard hover={false} className="border-red-200 p-4 dark:border-red-800">
              <h4 className="mb-1 text-sm font-medium text-red-700 dark:text-red-300">Rejection Reason</h4>
              <p className="text-sm text-red-600 dark:text-red-400">{entity.rejectionReason}</p>
            </AppleCard>
          )}
        </div>

        <div className="shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
