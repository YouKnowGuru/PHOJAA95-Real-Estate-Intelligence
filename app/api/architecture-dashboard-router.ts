import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, count, and, isNull, gte, lte, sql } from "drizzle-orm";
import { createRouter, adminQuery, architectureStaffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  architectureProjects,
  architectureOrders,
  architecturePayments,
  architectureCustomers,
  architectureCategories,
  localUsers,
} from "@db/schema";
import {
  assertArchitectureEntityAccess,
  assertUploadPath,
  isAdminRole,
  isArchitectureStaffRole,
  pageInput,
} from "./lib/access-control";

export const architectureDashboardRouter = createRouter({
  staff: architectureStaffQuery.query(async ({ ctx }) => {
    const db = getDb();
    const isStaff = ctx.unifiedUser!.role === "architecture_staff";
    const userId = ctx.unifiedUser!.id;

    const projectConditions = [isNull(architectureProjects.deletedAt)];
    const orderConditions = [isNull(architectureOrders.deletedAt)];
    if (isStaff) {
      projectConditions.push(eq(architectureProjects.createdBy, userId));
      orderConditions.push(eq(architectureOrders.createdBy, userId));
    }

    const totalProjects = await db.select({ count: count() }).from(architectureProjects).where(and(...projectConditions));
    const pendingProjects = await db.select({ count: count() }).from(architectureProjects).where(and(...projectConditions, eq(architectureProjects.status, "submitted")));
    const approvedProjects = await db.select({ count: count() }).from(architectureProjects).where(and(...projectConditions, eq(architectureProjects.status, "approved")));
    const completedProjects = await db.select({ count: count() }).from(architectureProjects).where(and(...projectConditions, eq(architectureProjects.status, "completed")));

    const totalOrders = await db.select({ count: count() }).from(architectureOrders).where(and(...orderConditions));
    const inProgressOrders = await db.select({ count: count() }).from(architectureOrders).where(and(...orderConditions, eq(architectureOrders.status, "in_progress")));
    const completedOrders = await db.select({ count: count() }).from(architectureOrders).where(and(...orderConditions, eq(architectureOrders.status, "completed")));

    const revenue = await db
      .select({ total: sql`SUM(${architectureOrders.finalAmount})` })
      .from(architectureOrders)
      .where(and(...orderConditions, eq(architectureOrders.paymentStatus, "fully_paid")));

    const pendingRevenue = await db
      .select({ total: sql`SUM(${architectureOrders.remainingPayment})` })
      .from(architectureOrders)
      .where(and(...orderConditions, sql`${architectureOrders.remainingPayment} > 0`));

    return {
      totalProjects: totalProjects[0]?.count || 0,
      pendingProjects: pendingProjects[0]?.count || 0,
      approvedProjects: approvedProjects[0]?.count || 0,
      completedProjects: completedProjects[0]?.count || 0,
      totalOrders: totalOrders[0]?.count || 0,
      inProgressOrders: inProgressOrders[0]?.count || 0,
      completedOrders: completedOrders[0]?.count || 0,
      totalRevenue: Number(revenue[0]?.total || 0),
      pendingRevenue: Number(pendingRevenue[0]?.total || 0),
    };
  }),

  admin: adminQuery.query(async () => {
    const db = getDb();

    const totalStaff = await db
      .select({ count: count() })
      .from(localUsers)
      .where(and(eq(localUsers.role, "architecture_staff"), eq(localUsers.status, "active")));

    const pendingProjectApprovals = await db
      .select({ count: count() })
      .from(architectureProjects)
      .where(and(eq(architectureProjects.status, "submitted"), isNull(architectureProjects.deletedAt)));

    const pendingOrderApprovals = await db
      .select({ count: count() })
      .from(architectureOrders)
      .where(and(eq(architectureOrders.status, "pending_approval"), isNull(architectureOrders.deletedAt)));

    const totalRevenue = await db
      .select({ total: sql`SUM(${architectureOrders.finalAmount})` })
      .from(architectureOrders)
      .where(and(eq(architectureOrders.paymentStatus, "fully_paid"), isNull(architectureOrders.deletedAt)));

    return {
      totalStaff: totalStaff[0]?.count || 0,
      pendingProjectApprovals: pendingProjectApprovals[0]?.count || 0,
      pendingOrderApprovals: pendingOrderApprovals[0]?.count || 0,
      totalRevenue: Number(totalRevenue[0]?.total || 0),
    };
  }),
});

export const architectureDocumentRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      ...pageInput,
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const { architectureDocuments } = await import("@db/schema");
      await assertArchitectureEntityAccess(
        db,
        input.entityType,
        input.entityId,
        ctx.unifiedUser!.id,
        ctx.unifiedUser!.role
      );

      const conditions = [isNull(architectureDocuments.deletedAt)];
      if (isArchitectureStaffRole(ctx.unifiedUser!.role)) {
        if (!input.entityType || input.entityId == null) {
          conditions.push(eq(architectureDocuments.uploadedBy, ctx.unifiedUser!.id));
        }
      }
      if (input.entityType) conditions.push(eq(architectureDocuments.entityType, input.entityType));
      if (input.entityId) conditions.push(eq(architectureDocuments.entityId, input.entityId));

      const whereClause = and(...conditions);
      const totalResult = await db.select({ count: count() }).from(architectureDocuments).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select()
        .from(architectureDocuments)
        .where(whereClause)
        .orderBy(desc(architectureDocuments.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  create: architectureStaffQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum([
        "pdf_drawing", "autocad", "image", "render", "video", "document",
        "floor_plan", "design_2d", "design_3d", "invoice", "certificate", "other",
      ]).default("other"),
      fileUrl: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
      entityType: z.string().optional(),
      entityId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { architectureDocuments } = await import("@db/schema");
      const userId = ctx.unifiedUser!.id;

      assertUploadPath(input.fileUrl);
      await assertArchitectureEntityAccess(
        db,
        input.entityType,
        input.entityId,
        userId,
        ctx.unifiedUser!.role
      );

      const result = await db.insert(architectureDocuments).values({
        ...input,
        uploadedBy: userId,
      });

      return { id: Number(result[0].insertId) };
    }),

  update: architectureStaffQuery
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      category: z.enum([
        "pdf_drawing", "autocad", "image", "render", "video", "document",
        "floor_plan", "design_2d", "design_3d", "invoice", "certificate", "other",
      ]).optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { architectureDocuments } = await import("@db/schema");
      const userId = ctx.unifiedUser!.id;
      const isAdmin = isAdminRole(ctx.unifiedUser!.role);
      const { id, ...data } = input;

      const existing = await db
        .select()
        .from(architectureDocuments)
        .where(and(eq(architectureDocuments.id, id), isNull(architectureDocuments.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      if (!isAdmin && existing[0].uploadedBy !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (data.fileUrl) assertUploadPath(data.fileUrl);

      await db.update(architectureDocuments).set(data).where(eq(architectureDocuments.id, id));
      return { success: true };
    }),

  delete: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { architectureDocuments } = await import("@db/schema");
      const userId = ctx.unifiedUser!.id;
      const isAdmin = isAdminRole(ctx.unifiedUser!.role);

      const existing = await db
        .select()
        .from(architectureDocuments)
        .where(and(eq(architectureDocuments.id, input.id), isNull(architectureDocuments.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      if (!isAdmin && existing[0].uploadedBy !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await db
        .update(architectureDocuments)
        .set({ deletedAt: new Date() })
        .where(eq(architectureDocuments.id, input.id));

      return { success: true };
    }),
});
