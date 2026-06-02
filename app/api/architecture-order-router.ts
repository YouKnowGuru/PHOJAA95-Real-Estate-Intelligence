import { z } from "zod";
import { eq, desc, count, and, isNull, or, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, architectureStaffQuery, architectureStaffOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  architectureOrders,
  architectureCustomers,
  architectureCategories,
  architectureInvoices,
  architectureInvoiceItems,
  architectureOrderProgress,
  localUsers,
} from "@db/schema";
import {
  logArchitectureActivity,
  notifyAdminsForArchitectureApproval,
  notifyArchitectureCreator,
  generateArchitectureCode,
} from "./architecture-activity-helper";
import {
  actorDisplayName,
  assertArchitectureStaffRecord,
  isArchitectureStaffRole,
  pageInput,
  sanitizeArchitectureCustomer,
} from "./lib/access-control";

function generateInvoiceNumber(): string {
  return generateArchitectureCode("AINV");
}

export const architectureOrderRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      customerId: z.number().optional(),
      ...pageInput,
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(architectureOrders.deletedAt)];

      if (input.search) {
        conditions.push(or(
          like(architectureOrders.orderNumber, `%${input.search}%`),
          like(architectureOrders.projectName, `%${input.search}%`)
        )!);
      }
      if (input.status) conditions.push(eq(architectureOrders.status, input.status as any));
      if (input.customerId) conditions.push(eq(architectureOrders.customerId, input.customerId));
      if (ctx.unifiedUser!.role === "architecture_staff") {
        conditions.push(eq(architectureOrders.createdBy, ctx.unifiedUser!.id));
      }

      const whereClause = and(...conditions);
      const totalResult = await db.select({ count: count() }).from(architectureOrders).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: architectureOrders.id,
          orderNumber: architectureOrders.orderNumber,
          customerId: architectureOrders.customerId,
          customerName: architectureCustomers.fullName,
          projectName: architectureOrders.projectName,
          categoryName: architectureCategories.name,
          finalAmount: architectureOrders.finalAmount,
          totalPaid: architectureOrders.totalPaid,
          remainingPayment: architectureOrders.remainingPayment,
          advancePayment: architectureOrders.advancePayment,
          paymentStatus: architectureOrders.paymentStatus,
          status: architectureOrders.status,
          developmentStage: architectureOrders.developmentStage,
          progressPercentage: architectureOrders.progressPercentage,
          createdBy: architectureOrders.createdBy,
          staffName: localUsers.fullName,
          createdAt: architectureOrders.createdAt,
        })
        .from(architectureOrders)
        .leftJoin(architectureCustomers, eq(architectureOrders.customerId, architectureCustomers.id))
        .leftJoin(architectureCategories, eq(architectureOrders.categoryId, architectureCategories.id))
        .leftJoin(localUsers, eq(architectureOrders.createdBy, localUsers.id))
        .where(whereClause)
        .orderBy(desc(architectureOrders.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const order = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.id, input.id), isNull(architectureOrders.deletedAt)))
        .limit(1);

      if (order.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (ctx.unifiedUser!.role === "architecture_staff" && order[0].createdBy !== ctx.unifiedUser!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const progress = await db
        .select()
        .from(architectureOrderProgress)
        .where(eq(architectureOrderProgress.orderId, input.id))
        .orderBy(desc(architectureOrderProgress.createdAt));

      const customer = await db
        .select()
        .from(architectureCustomers)
        .where(eq(architectureCustomers.id, order[0].customerId))
        .limit(1);

      return {
        ...order[0],
        progress,
        customer: customer[0] ? sanitizeArchitectureCustomer(customer[0] as Record<string, unknown>) : undefined,
      };
    }),

  create: architectureStaffOnlyQuery
    .input(z.object({
      customerId: z.number(),
      categoryId: z.number(),
      portfolioProjectId: z.number().optional(),
      projectName: z.string().min(2).max(255),
      projectType: z.string().optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      extraFeatures: z.string().optional(),
      estimatedCompletionDate: z.string().optional(),
      totalPrice: z.string(),
      taxAmount: z.string().optional(),
      discountAmount: z.string().optional(),
      finalAmount: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const customer = await db
        .select()
        .from(architectureCustomers)
        .where(and(eq(architectureCustomers.id, input.customerId), isNull(architectureCustomers.deletedAt)))
        .limit(1);
      if (customer.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      assertArchitectureStaffRecord(customer[0].createdBy, userId, ctx.unifiedUser!.role);

      const finalAmount = parseFloat(input.finalAmount);
      const advancePayment = (finalAmount * 0.5).toFixed(2);
      const remainingPayment = advancePayment;
      const orderNumber = generateArchitectureCode("AORD");

      const result = await db.insert(architectureOrders).values({
        ...input,
        orderNumber,
        estimatedCompletionDate: input.estimatedCompletionDate ? new Date(input.estimatedCompletionDate) : undefined,
        taxAmount: input.taxAmount || "0",
        discountAmount: input.discountAmount || "0",
        advancePayment,
        remainingPayment,
        totalPaid: "0",
        paymentStatus: "unpaid",
        status: "draft",
        createdBy: userId,
      });

      const id = Number(result[0].insertId);

      await logArchitectureActivity({
        userId,
        userName,
        action: "order_created",
        entityType: "order",
        entityId: id,
        newValue: { orderNumber, projectName: input.projectName, finalAmount: input.finalAmount },
      });

      return { id, orderNumber, advancePayment };
    }),

  submitForApproval: architectureStaffOnlyQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const existing = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.id, input.id), isNull(architectureOrders.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (existing[0].createdBy !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      if (!["draft", "rejected"].includes(existing[0].status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order cannot be submitted" });
      }

      await db
        .update(architectureOrders)
        .set({ status: "pending_approval", rejectionReason: null })
        .where(eq(architectureOrders.id, input.id));

      await logArchitectureActivity({
        userId,
        userName,
        action: "order_submitted",
        entityType: "order",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: { status: "pending_approval" },
      });

      await notifyAdminsForArchitectureApproval({
        submitterName: userName,
        entityType: "Order",
        entityName: existing[0].projectName,
        entityId: input.id,
      });

      return { success: true };
    }),

  approve: adminQuery
    .input(z.object({
      id: z.number(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const existing = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.id, input.id), isNull(architectureOrders.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (existing[0].status !== "pending_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not pending approval" });
      }

      const status = input.action === "approve" ? "approved" : "rejected";
      const updateData: Record<string, unknown> = {
        status,
        approvedBy: userId,
        approvedAt: new Date(),
      };
      if (input.reason && input.action === "reject") updateData.rejectionReason = input.reason;

      await db.update(architectureOrders).set(updateData).where(eq(architectureOrders.id, input.id));

      if (input.action === "approve") {
        const order = existing[0];
        const existingInvoice = await db
          .select({ id: architectureInvoices.id })
          .from(architectureInvoices)
          .where(and(eq(architectureInvoices.orderId, input.id), isNull(architectureInvoices.deletedAt)))
          .limit(1);

        if (existingInvoice.length === 0) {
          const invoiceNumber = generateInvoiceNumber();
          const invoiceResult = await db.insert(architectureInvoices).values({
            invoiceNumber,
            orderId: input.id,
            customerId: order.customerId,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            subtotal: order.totalPrice,
            taxAmount: order.taxAmount,
            discountAmount: order.discountAmount,
            totalAmount: order.finalAmount,
            amountPaid: order.totalPaid || "0",
            remainingAmount: order.remainingPayment,
            paymentStatus: "unpaid",
            status: "sent",
            generatedBy: userId,
          });

          const invoiceId = Number(invoiceResult[0].insertId);
          await db.insert(architectureInvoiceItems).values({
            invoiceId,
            description: `Architecture Design: ${order.projectName}`,
            quantity: 1,
            unitPrice: order.totalPrice,
            totalPrice: order.totalPrice,
          });

          await notifyArchitectureCreator({
            creatorId: order.createdBy,
            entityType: "Invoice",
            entityName: order.projectName,
            action: "generated",
            entityId: invoiceId,
          });
        }

        await db
          .update(architectureOrders)
          .set({ status: "payment_pending" })
          .where(eq(architectureOrders.id, input.id));

        await notifyArchitectureCreator({
          creatorId: order.createdBy,
          entityType: "Order",
          entityName: order.projectName,
          action: "payment_request",
          entityId: input.id,
        });
      }

      await logArchitectureActivity({
        userId,
        userName,
        action: `order_${input.action}`,
        entityType: "order",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: updateData,
      });

      await notifyArchitectureCreator({
        creatorId: existing[0].createdBy,
        entityType: "Order",
        entityName: existing[0].projectName,
        action: input.action === "approve" ? "approved" : "rejected",
        reason: input.reason,
        entityId: input.id,
      });

      return { success: true };
    }),

  updateProgress: architectureStaffQuery
    .input(z.object({
      id: z.number(),
      developmentStage: z.enum(["planning", "draft_design", "review", "revision", "final_design", "completed"]),
      progressPercentage: z.number().min(0).max(100),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const existing = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.id, input.id), isNull(architectureOrders.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      assertArchitectureStaffRecord(existing[0].createdBy, userId, ctx.unifiedUser!.role);
      if (!["in_progress", "approved", "payment_pending"].includes(existing[0].status)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Order must be active to update progress" });
      }

      const updateData: Record<string, unknown> = {
        developmentStage: input.developmentStage,
        progressPercentage: input.progressPercentage,
        status: input.developmentStage === "completed" ? "completed" : "in_progress",
      };
      if (input.developmentStage === "completed") updateData.completedAt = new Date();

      await db.update(architectureOrders).set(updateData).where(eq(architectureOrders.id, input.id));

      await db.insert(architectureOrderProgress).values({
        orderId: input.id,
        stage: input.developmentStage,
        progressPercentage: input.progressPercentage,
        notes: input.notes,
        updatedBy: userId,
      });

      await logArchitectureActivity({
        userId,
        userName,
        action: "order_progress_updated",
        entityType: "order",
        entityId: input.id,
        newValue: updateData,
      });

      if (input.developmentStage === "completed") {
        await notifyArchitectureCreator({
          creatorId: existing[0].createdBy,
          entityType: "Order",
          entityName: existing[0].projectName,
          action: "completed",
          entityId: input.id,
        });

        await notifyArchitectureCreator({
          creatorId: existing[0].createdBy,
          entityType: "Order",
          entityName: existing[0].projectName,
          action: "payment_request",
          entityId: input.id,
        });
      }

      return { success: true };
    }),

  delete: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const isAdmin = ctx.unifiedUser!.role === "admin";
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.id, input.id), isNull(architectureOrders.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (!isAdmin && existing[0].createdBy !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await db.update(architectureOrders).set({ deletedAt: new Date() }).where(eq(architectureOrders.id, input.id));

      await logArchitectureActivity({
        userId,
        userName,
        action: "order_deleted",
        entityType: "order",
        entityId: input.id,
      });

      return { success: true };
    }),

  stats: architectureStaffQuery.query(async ({ ctx }) => {
    const db = getDb();
    const conditions = [isNull(architectureOrders.deletedAt)];
    if (ctx.unifiedUser!.role === "architecture_staff") {
      conditions.push(eq(architectureOrders.createdBy, ctx.unifiedUser!.id));
    }

    const whereClause = and(...conditions);
    const total = await db.select({ count: count() }).from(architectureOrders).where(whereClause);
    const pending = await db.select({ count: count() }).from(architectureOrders).where(and(whereClause, eq(architectureOrders.status, "pending_approval")));
    const inProgress = await db.select({ count: count() }).from(architectureOrders).where(and(whereClause, eq(architectureOrders.status, "in_progress")));
    const completed = await db.select({ count: count() }).from(architectureOrders).where(and(whereClause, eq(architectureOrders.status, "completed")));

    return {
      total: total[0]?.count || 0,
      pending: pending[0]?.count || 0,
      inProgress: inProgress[0]?.count || 0,
      completed: completed[0]?.count || 0,
    };
  }),
});
