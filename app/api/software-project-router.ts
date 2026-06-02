import { z } from "zod";
import { eq, like, desc, count, and, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, developerQuery, developerOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwareProjects, softwareCustomers, softwareProducts, localUsers, softwareSales, softwareInvoices } from "@db/schema";
import { logActivity, notifyCreator, notifyAdminsForApproval } from "./software-activity-helper";
import {
  assertDeveloperRecord,
  isDeveloperRole,
  pageInput,
  softwareProjectVisibleToDeveloper,
  assertSoftwareDeveloperProjectAccess,
} from "./lib/access-control";

function generateProjectId(): string {
  const prefix = "PRJ";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export const softwareProjectRouter = createRouter({
  list: developerQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
        developerId: z.number().optional(),
        ...pageInput,
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(softwareProjects.deletedAt)];

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(softwareProjectVisibleToDeveloper(ctx.unifiedUser!.id));
      }

      if (input.search) {
        conditions.push(
          or(
            like(softwareProjects.name, `%${input.search}%`),
            like(softwareProjects.projectId, `%${input.search}%`)
          ) as any
        );
      }
      if (input.status) conditions.push(eq(softwareProjects.status, input.status as any));
      if (input.customerId) conditions.push(eq(softwareProjects.customerId, input.customerId));
      if (input.developerId) conditions.push(eq(softwareProjects.assignedDeveloperId, input.developerId));

      const whereClause = and(...conditions);
      const totalResult = await db.select({ count: count() }).from(softwareProjects).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const developerAlias = localUsers;
      const results = await db
        .select({
          id: softwareProjects.id,
          projectId: softwareProjects.projectId,
          name: softwareProjects.name,
          customerId: softwareProjects.customerId,
          customerName: softwareCustomers.fullName,
          productId: softwareProjects.productId,
          productName: softwareProducts.name,
          priority: softwareProjects.priority,
          status: softwareProjects.status,
          description: softwareProjects.description,
          startDate: softwareProjects.startDate,
          endDate: softwareProjects.endDate,
          dueDate: softwareProjects.endDate,
          assignedDeveloperId: softwareProjects.assignedDeveloperId,
          assignedDeveloperName: developerAlias.fullName,
          createdBy: softwareProjects.createdBy,
          createdAt: softwareProjects.createdAt,
        })
        .from(softwareProjects)
        .leftJoin(softwareCustomers, eq(softwareProjects.customerId, softwareCustomers.id))
        .leftJoin(softwareProducts, eq(softwareProjects.productId, softwareProducts.id))
        .leftJoin(developerAlias, eq(softwareProjects.assignedDeveloperId, developerAlias.id))
        .where(whereClause)
        .orderBy(desc(softwareProjects.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const project = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, input.id), isNull(softwareProjects.deletedAt)))
        .limit(1);

      if (project.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      assertSoftwareDeveloperProjectAccess(project[0], ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return project[0];
    }),

  create: developerOnlyQuery
    .input(
      z.object({
        name: z.string().min(2).max(255),
        customerId: z.number(),
        productId: z.number(),
        description: z.string().optional(),
        scopeOfWork: z.string().optional(),
        requirements: z.string().optional(),
        estimatedBudget: z.string().optional(),
        estimatedDuration: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        assignedDeveloperId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email;

      // Validate customer exists
      const customer = await db
        .select()
        .from(softwareCustomers)
        .where(and(eq(softwareCustomers.id, input.customerId), isNull(softwareCustomers.deletedAt)))
        .limit(1);
      if (customer.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

      // Validate product exists
      const product = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, input.productId), isNull(softwareProducts.deletedAt)))
        .limit(1);
      if (product.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      const projectId = generateProjectId();
      const result = await db.insert(softwareProjects).values({
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        projectId,
        status: "draft",
        createdBy: userId,
      });

      const newId = Number(result[0].insertId);

      await logActivity({
        userId,
        userName: userName ?? undefined,
        action: "project_created",
        entityType: "project",
        entityId: newId,
        newValue: { name: input.name, customerId: input.customerId, productId: input.productId },
      });

      return { id: newId, projectId };
    }),

  update: developerOnlyQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).max(255).optional(),
        customerId: z.number().optional(),
        productId: z.number().optional(),
        description: z.string().optional(),
        scopeOfWork: z.string().optional(),
        requirements: z.string().optional(),
        estimatedBudget: z.string().optional(),
        estimatedDuration: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignedDeveloperId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email;

      const existing = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, id), isNull(softwareProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      if (existing[0].createdBy !== userId && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (["delivered", "completed", "cancelled"].includes(existing[0].status)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit completed/delivered/cancelled projects" });
      }

      const updatePayload: any = { ...data };
      if (data.startDate) updatePayload.startDate = new Date(data.startDate);
      if (data.endDate) updatePayload.endDate = new Date(data.endDate);
      await db.update(softwareProjects).set(updatePayload).where(eq(softwareProjects.id, id));

      await logActivity({
        userId,
        userName: userName ?? undefined,
        action: "project_updated",
        entityType: "project",
        entityId: id,
        previousValue: existing[0],
        newValue: data,
      });

      return { success: true };
    }),

  submitForApproval: developerOnlyQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email;

      const existing = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, input.id), isNull(softwareProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (existing[0].createdBy !== userId && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (!["draft", "rejected"].includes(existing[0].status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Project cannot be submitted for approval" });
      }

      await db
        .update(softwareProjects)
        .set({ status: "pending_approval", rejectionReason: null })
        .where(eq(softwareProjects.id, input.id));

      await logActivity({
        userId,
        userName: userName ?? undefined,
        action: "project_submitted_for_approval",
        entityType: "project",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: { status: "pending_approval" },
      });

      await notifyAdminsForApproval({
        submitterName: userName || "Developer",
        entityType: "Project",
        entityName: existing[0].name,
        entityId: input.id,
      });

      return { success: true };
    }),

  approve: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["approved", "rejected", "cancelled"]), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email;

      const existing = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, input.id), isNull(softwareProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      const updateData: any = {
        status: input.status === "approved" ? "approved" : input.status,
        approvedBy: userId,
        approvedAt: new Date(),
      };
      if (input.reason) updateData.rejectionReason = input.reason;
      if (input.status === "approved") {
        updateData.startDate = new Date();
      }

      await db.update(softwareProjects).set(updateData).where(eq(softwareProjects.id, input.id));

      await logActivity({
        userId,
        userName: userName ?? undefined,
        action: `project_${input.status}`,
        entityType: "project",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: updateData,
      });

      // Notify creator
      await notifyCreator({
        creatorId: existing[0].createdBy,
        entityType: "Project",
        entityName: existing[0].name,
        action: input.status === "approved" ? "approved" : "rejected",
        reason: input.reason,
        entityId: input.id,
      });

      return { success: true };
    }),

  updateStatus: developerOnlyQuery
    .input(z.object({ id: z.number(), status: z.enum([
      "in_progress", "testing", "uat", "completed", "delivered"
    ]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email;

      const existing = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, input.id), isNull(softwareProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      // Only assigned developer or admin can update status
      if (existing[0].assignedDeveloperId !== userId && existing[0].createdBy !== userId && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Validate status transitions (forward and backward workflow moves)
      const validTransitions: Record<string, string[]> = {
        approved: ["in_progress"],
        in_progress: ["testing"],
        testing: ["uat", "in_progress"],
        uat: ["completed", "testing"],
        completed: ["delivered", "uat"],
        delivered: ["completed"],
      };

      const currentStatus = existing[0].status;
      if (!validTransitions[currentStatus]?.includes(input.status) && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot transition from ${currentStatus} to ${input.status}` });
      }

      // ─── COMPLETION VALIDATION ─────────────────────────────────────
      if (input.status === "completed") {
        // 1. Must be approved
        if (!existing[0].approvedBy) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Project must be approved by an admin before completion" });
        }

        // 2. Customer must exist
        const customer = await db
          .select()
          .from(softwareCustomers)
          .where(and(eq(softwareCustomers.id, existing[0].customerId), isNull(softwareCustomers.deletedAt)))
          .limit(1);
        if (customer.length === 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Associated customer no longer exists" });
        }

        // 3. Product must exist
        const product = await db
          .select()
          .from(softwareProducts)
          .where(and(eq(softwareProducts.id, existing[0].productId), isNull(softwareProducts.deletedAt)))
          .limit(1);
        if (product.length === 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Associated product no longer exists" });
        }

        // 4. Invoice must exist for related sale
        const sale = await db
          .select()
          .from(softwareSales)
          .where(and(eq(softwareSales.projectId, input.id), isNull(softwareSales.deletedAt)))
          .limit(1);
        if (sale.length === 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No sale exists for this project. Create a sale first." });
        }

        const invoice = await db
          .select()
          .from(softwareInvoices)
          .where(and(eq(softwareInvoices.saleId, sale[0].id), isNull(softwareInvoices.deletedAt)))
          .limit(1);
        if (invoice.length === 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No invoice exists for the related sale. Generate an invoice first." });
        }

        // 5. Balance must be zero
        const outstanding = parseFloat(sale[0].outstandingBalance || "0");
        if (outstanding > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Outstanding balance must be zero before completion. Current balance: ${outstanding.toFixed(2)}`,
          });
        }
      }

      const updateData: any = { status: input.status };
      if (input.status === "completed") {
        updateData.completionNotes = updateData.completionNotes || "Project marked as completed";
        updateData.endDate = new Date();
      }

      await db.update(softwareProjects).set(updateData).where(eq(softwareProjects.id, input.id));

      await logActivity({
        userId,
        userName: userName ?? undefined,
        action: "project_status_changed",
        entityType: "project",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: { status: input.status },
      });

      // Notify creator on completion
      if (input.status === "completed") {
        await notifyCreator({
          creatorId: existing[0].createdBy,
          entityType: "Project",
          entityName: existing[0].name,
          action: "completed",
          entityId: input.id,
        });
      }

      return { success: true };
    }),

  delete: developerOnlyQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email;

      const existing = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, input.id), isNull(softwareProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      assertDeveloperRecord(existing[0].createdBy, userId, ctx.unifiedUser!.role);

      await db.update(softwareProjects).set({ deletedAt: new Date() }).where(eq(softwareProjects.id, input.id));

      await logActivity({
        userId,
        userName: userName ?? undefined,
        action: "project_deleted",
        entityType: "project",
        entityId: input.id,
        previousValue: existing[0],
      });

      return { success: true };
    }),

  // Kanban board data
  kanban: developerQuery.query(async ({ ctx }) => {
    const db = getDb();
    const statuses = ["pending_approval", "approved", "in_progress", "testing", "uat", "completed", "delivered"];
    const columns = [];

    for (const status of statuses) {
      const statusConditions = [eq(softwareProjects.status, status as any), isNull(softwareProjects.deletedAt)];
      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        statusConditions.push(softwareProjectVisibleToDeveloper(ctx.unifiedUser!.id));
      }

      const items = await db
        .select({
          id: softwareProjects.id,
          projectId: softwareProjects.projectId,
          name: softwareProjects.name,
          priority: softwareProjects.priority,
          customerId: softwareProjects.customerId,
          assignedDeveloperId: softwareProjects.assignedDeveloperId,
          endDate: softwareProjects.endDate,
        })
        .from(softwareProjects)
        .where(and(...statusConditions))
        .orderBy(desc(softwareProjects.updatedAt));

      columns.push({ status, items });
    }

    return columns;
  }),

  stats: developerQuery.query(async ({ ctx }) => {
    const db = getDb();
    const base = isNull(softwareProjects.deletedAt);
    const scope = isDeveloperRole(ctx.unifiedUser!.role)
      ? and(base, softwareProjectVisibleToDeveloper(ctx.unifiedUser!.id))
      : base;

    const total = await db.select({ count: count() }).from(softwareProjects).where(scope);
    const pending = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(and(eq(softwareProjects.status, "pending_approval"), scope));
    const active = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(and(eq(softwareProjects.status, "in_progress"), scope));
    const completed = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(and(eq(softwareProjects.status, "completed"), scope));

    return {
      total: total[0]?.count || 0,
      pendingApproval: pending[0]?.count || 0,
      active: active[0]?.count || 0,
      completed: completed[0]?.count || 0,
    };
  }),
});
