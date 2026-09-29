import { TRPCError } from "@trpc/server";
import { eq, and, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { getDb } from "../queries/connection";
import {
  architectureOrders,
  architectureProjects,
  softwareCustomers,
  softwareProjects,
  softwareSales,
} from "@db/schema";

/** Sale statuses that count toward recognized revenue. */
export const SOFTWARE_REVENUE_SALE_STATUSES = ["fully_paid", "completed"] as const;

export function isAdminRole(role: string): boolean {
  return role === "admin";
}

/**
 * Real-estate property module roles.
 * Admin sees/edits everything; real-estate staff can now also see and edit
 * ALL properties (not just the ones they listed). Software developers and
 * architecture staff are explicitly excluded from this module.
 */
export function isRealEstateStaffRole(role: string): boolean {
  return role === "staff" || isAdminRole(role);
}

export function assertRealEstateModuleAccess(role: string): void {
  if (!isRealEstateStaffRole(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action is restricted to real-estate staff and admins.",
    });
  }
}

export function isArchitectureStaffRole(role: string): boolean {
  return role === "architecture_staff";
}

export function actorDisplayName(user?: { name?: string; email?: string | null }): string {
  return user?.name || user?.email || "Unknown";
}

export function assertCreatorOrAdmin(createdBy: number, userId: number, role: string): void {
  if (createdBy !== userId && !isAdminRole(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
}

export function assertArchitectureStaffRecord(createdBy: number | null, userId: number, role: string): void {
  if (isAdminRole(role)) return;
  if (!isArchitectureStaffRole(role)) return;
  if (createdBy == null || createdBy !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
}

export function isDeveloperRole(role: string): boolean {
  return role === "developer";
}

export function assertDeveloperRecord(createdBy: number | null, userId: number, role: string): void {
  if (isAdminRole(role)) return;
  if (!isDeveloperRole(role)) return;
  if (createdBy == null || createdBy !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
}

export function assertSoftwareDeveloperProjectAccess(
  project: { createdBy: number; assignedDeveloperId: number | null },
  userId: number,
  role: string
): void {
  if (isAdminRole(role)) return;
  if (!isDeveloperRole(role)) return;
  if (project.createdBy === userId || project.assignedDeveloperId === userId) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
}

/** Customers owned by the developer or linked through their sales/projects. */
export function softwareCustomerVisibleToDeveloper(userId: number): SQL {
  return or(
    eq(softwareCustomers.createdBy, userId),
    sql`${softwareCustomers.id} IN (
      SELECT customer_id FROM software_sales
      WHERE created_by = ${userId} AND deleted_at IS NULL
    )`,
    sql`${softwareCustomers.id} IN (
      SELECT customer_id FROM software_projects
      WHERE created_by = ${userId} AND deleted_at IS NULL
    )`
  ) as SQL;
}

/** Projects created by or assigned to the developer. */
export function softwareProjectVisibleToDeveloper(userId: number): SQL {
  return or(
    eq(softwareProjects.createdBy, userId),
    eq(softwareProjects.assignedDeveloperId, userId)
  ) as SQL;
}

export async function assertSoftwareDeveloperCustomerAccess(
  db: ReturnType<typeof getDb>,
  customerId: number,
  userId: number,
  role: string
): Promise<void> {
  if (isAdminRole(role)) return;
  if (!isDeveloperRole(role)) return;

  const customer = await db
    .select({ createdBy: softwareCustomers.createdBy })
    .from(softwareCustomers)
    .where(and(eq(softwareCustomers.id, customerId), isNull(softwareCustomers.deletedAt)))
    .limit(1);

  if (customer.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
  }
  if (customer[0].createdBy === userId) return;

  const linkedSale = await db
    .select({ id: softwareSales.id })
    .from(softwareSales)
    .where(
      and(
        eq(softwareSales.customerId, customerId),
        eq(softwareSales.createdBy, userId),
        isNull(softwareSales.deletedAt)
      )
    )
    .limit(1);
  if (linkedSale.length > 0) return;

  const linkedProject = await db
    .select({ id: softwareProjects.id })
    .from(softwareProjects)
    .where(
      and(
        eq(softwareProjects.customerId, customerId),
        eq(softwareProjects.createdBy, userId),
        isNull(softwareProjects.deletedAt)
      )
    )
    .limit(1);
  if (linkedProject.length > 0) return;

  throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
}

export function parsePositiveMoney(value: string, field = "amount"): number {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid ${field}` });
  }
  return parsed;
}

export const pageInput = {
  page: z.number().min(1).max(1000).default(1),
  limit: z.number().min(1).max(100).default(20),
};

/** Strip portal secrets from customer API responses. */
export function sanitizeArchitectureCustomer<T extends Record<string, unknown>>(customer: T) {
  const { portalToken: _portalToken, portalTokenExpiresAt: _expires, ...safe } = customer;
  return safe;
}

export async function assertArchitectureEntityAccess(
  db: ReturnType<typeof getDb>,
  entityType: string | undefined,
  entityId: number | undefined,
  userId: number,
  role: string
): Promise<void> {
  if (!entityType || entityId == null) return;
  if (isAdminRole(role)) return;

  if (entityType === "order") {
    const rows = await db
      .select({ createdBy: architectureOrders.createdBy })
      .from(architectureOrders)
      .where(and(eq(architectureOrders.id, entityId), isNull(architectureOrders.deletedAt)))
      .limit(1);
    if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    assertArchitectureStaffRecord(rows[0].createdBy, userId, role);
    return;
  }

  if (entityType === "project") {
    const rows = await db
      .select({ createdBy: architectureProjects.createdBy })
      .from(architectureProjects)
      .where(and(eq(architectureProjects.id, entityId), isNull(architectureProjects.deletedAt)))
      .limit(1);
    if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    assertArchitectureStaffRecord(rows[0].createdBy, userId, role);
  }
}

export function assertUploadPath(fileUrl: string): void {
  const normalized = fileUrl.trim();
  if (
    !normalized.startsWith("/uploads/") &&
    !normalized.startsWith("/api/file/")
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "File URL must be an uploaded file path",
    });
  }
}
