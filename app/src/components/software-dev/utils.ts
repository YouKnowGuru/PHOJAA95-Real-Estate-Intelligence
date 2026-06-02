/** Display helpers for software-dev entities (API field names vary by type). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEntityDisplayName(entity: any, type?: string): string {
  if (!entity) return "";
  if (type === "customer") {
    return entity.fullName || entity.name || `Customer #${entity.id}`;
  }
  if (type === "document") {
    return entity.title || entity.name || `Document #${entity.id}`;
  }
  if (type === "payment") {
    return entity.paymentNumber || `Payment #${entity.id}`;
  }
  if (type === "sale") {
    return entity.saleNumber || entity.name || `Sale #${entity.id}`;
  }
  if (type === "invoice") {
    return entity.invoiceNumber || `Invoice #${entity.id}`;
  }
  if (type === "certificate") {
    return entity.certificateNumber || `Certificate #${entity.id}`;
  }
  if (type === "project") {
    return entity.name || entity.projectId || `Project #${entity.id}`;
  }
  return (
    entity.name ||
    entity.fullName ||
    entity.title ||
    entity.productName ||
    entity.certificateNumber ||
    entity.invoiceNumber ||
    entity.paymentNumber ||
    (entity.id != null ? `#${entity.id}` : "Untitled")
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function confirmEntityDelete(entity: unknown, type?: string): boolean {
  const name = getEntityDisplayName(entity, type);
  return window.confirm(`Delete "${name}"? This cannot be undone.`);
}

export function getCustomerLabel(customer: any): string {
  if (!customer) return "";
  const name = customer.fullName || customer.name || `Customer #${customer.id}`;
  return customer.companyName ? `${name} (${customer.companyName})` : name;
}

export function getStatusVariant(
  status: string
): "success" | "warning" | "error" | "info" | "neutral" | "primary" {
  switch (status) {
    case "verified":
    case "approved":
    case "published":
    case "completed":
    case "paid":
    case "fully_paid":
    case "delivered":
      return "success";
    case "pending_approval":
    case "pending_verification":
    case "pending":
    case "processing":
    case "partially_paid":
    case "payment_pending":
    case "in_progress":
    case "testing":
    case "uat":
      return "warning";
    case "rejected":
    case "overdue":
      return "error";
    case "draft":
    case "sent":
      return "info";
    case "cancelled":
    case "refunded":
      return "neutral";
    default:
      return "neutral";
  }
}

export function formatStatusLabel(status: string): string {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getInvoiceStatusVariant(
  status: string
): "success" | "warning" | "error" | "info" | "neutral" {
  const map: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
    draft: "neutral",
    sent: "info",
    partially_paid: "warning",
    paid: "success",
    overdue: "error",
    cancelled: "neutral",
  };
  return map[status] ?? "neutral";
}

export const CERTIFICATE_TYPES = [
  { value: "project_completion", label: "Project Completion" },
  { value: "software_ownership", label: "Software Ownership" },
] as const;
