/** Architecture entity types → tab hash on /architecture */
export const ARCHITECTURE_ENTITY_TABS: Record<string, string> = {
  architecture_project: "projects",
  architecture_order: "orders",
  architecture_payment: "payments",
  architecture_invoice: "invoices",
  architecture_certificate: "certificates",
  architecture_category: "categories",
  architecture_document: "documents",
};

/** Software Dev entity types → tab hash on /software-dev */
export const SOFTWARE_ENTITY_TABS: Record<string, string> = {
  product: "products",
  project: "projects",
  sale: "sales",
  payment: "payments",
  certificate: "certificates",
};

export function getNotificationPath(notif: {
  entityType?: string | null;
  entityId?: number | null;
  type?: string | null;
}): string | null {
  const entityType = notif.entityType?.toLowerCase();

  if (entityType === "property" && notif.entityId) {
    return `/properties/${notif.entityId}`;
  }

  if (entityType && SOFTWARE_ENTITY_TABS[entityType]) {
    return `/software-dev#${SOFTWARE_ENTITY_TABS[entityType]}`;
  }

  if (entityType && ARCHITECTURE_ENTITY_TABS[entityType]) {
    return `/architecture#${ARCHITECTURE_ENTITY_TABS[entityType]}`;
  }

  if (entityType === "payroll") return "/payroll";
  if (entityType === "attendance") return "/attendance";
  if (notif.type === "approval") return "/approvals";

  return null;
}
