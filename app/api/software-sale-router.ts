import { z } from "zod";
import { eq, like, desc, count, and, or, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, developerQuery, developerOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwareSales, softwareSaleFeatures, softwareProducts, softwareCustomers, softwareProjects, softwareInvoices, softwareInvoiceItems, softwarePayments } from "@db/schema";
import { logActivity, notifyCreator, notifyAdminsForApproval } from "./software-activity-helper";
import {
  actorDisplayName,
  assertDeveloperRecord,
  isDeveloperRole,
  pageInput,
  parsePositiveMoney,
  SOFTWARE_REVENUE_SALE_STATUSES,
} from "./lib/access-control";

function generateSaleNumber(): string {
  const prefix = "SALE";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function generateInvoiceNumber(): string {
  const prefix = "INV";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export const softwareSaleRouter = createRouter({
  list: developerQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
        ...pageInput,
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(softwareSales.deletedAt)];

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(softwareSales.createdBy, ctx.unifiedUser!.id));
      }

      if (input.search) {
        conditions.push(like(softwareSales.saleNumber, `%${input.search}%`));
      }
      if (input.status) conditions.push(eq(softwareSales.status, input.status as any));
      if (input.customerId) conditions.push(eq(softwareSales.customerId, input.customerId));

      const whereClause = and(...conditions);
      const totalResult = await db.select({ count: count() }).from(softwareSales).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: softwareSales.id,
          saleNumber: softwareSales.saleNumber,
          customerId: softwareSales.customerId,
          productId: softwareSales.productId,
          projectId: softwareSales.projectId,
          grandTotal: softwareSales.grandTotal,
          paymentStatus: softwareSales.paymentStatus,
          status: softwareSales.status,
          totalPaid: softwareSales.totalPaid,
          outstandingBalance: softwareSales.outstandingBalance,
          createdAt: softwareSales.createdAt,
        })
        .from(softwareSales)
        .where(whereClause)
        .orderBy(desc(softwareSales.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const sale = await db
        .select()
        .from(softwareSales)
        .where(and(eq(softwareSales.id, input.id), isNull(softwareSales.deletedAt)))
        .limit(1);

      if (sale.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      assertDeveloperRecord(sale[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);

      const features = await db
        .select()
        .from(softwareSaleFeatures)
        .where(eq(softwareSaleFeatures.saleId, input.id));

      return { ...sale[0], features };
    }),

  create: developerOnlyQuery
    .input(
      z.object({
        customerId: z.number(),
        productId: z.number(),
        projectId: z.number().optional(),
        basePrice: z.string(),
        additionalFeaturesCost: z.string().optional(),
        discountAmount: z.string().optional(),
        taxAmount: z.string().optional(),
        grandTotal: z.string().optional(),
        paymentType: z.enum(["full", "advance_50", "milestone"]).default("full"),
        features: z.array(z.object({
          name: z.string(),
          description: z.string().optional(),
          price: z.string(),
        })).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      // Validate product is sellable
      const product = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, input.productId), isNull(softwareProducts.deletedAt)))
        .limit(1);

      if (product.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      if (!["completed", "published"].includes(product[0].status)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This product cannot be sold. Only Completed or Published products are eligible for sale." });
      }

      // Validate customer
      const customer = await db
        .select()
        .from(softwareCustomers)
        .where(and(eq(softwareCustomers.id, input.customerId), isNull(softwareCustomers.deletedAt)))
        .limit(1);
      if (customer.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      assertDeveloperRecord(customer[0].createdBy, userId, ctx.unifiedUser!.role);

      const basePrice = parsePositiveMoney(input.basePrice, "basePrice");
      const additionalCost = input.additionalFeaturesCost ? parseFloat(input.additionalFeaturesCost) : 0;
      const featuresTotal = (input.features || []).reduce((sum, f) => sum + parsePositiveMoney(f.price, "feature price"), 0);
      const discount = input.discountAmount ? Math.max(0, parseFloat(input.discountAmount)) : 0;
      const tax = input.taxAmount ? Math.max(0, parseFloat(input.taxAmount)) : 0;
      const computedTotal = Math.max(0, basePrice + additionalCost + featuresTotal - discount + tax);
      const grandTotal = computedTotal.toFixed(2);

      // Calculate advance if needed
      let advanceAmount = "0";
      let outstandingBalance = grandTotal;
      let paymentStatus: "pending" | "partially_paid" | "paid" | "refunded" | "cancelled" = "pending";

      if (input.paymentType === "advance_50") {
        advanceAmount = (computedTotal * 0.5).toFixed(2);
        outstandingBalance = advanceAmount;
        paymentStatus = "pending";
      }

      const saleNumber = generateSaleNumber();
      const result = await db.insert(softwareSales).values({
        saleNumber,
        customerId: input.customerId,
        productId: input.productId,
        projectId: input.projectId,
        basePrice: basePrice.toFixed(2),
        additionalFeaturesCost: (additionalCost + featuresTotal).toFixed(2),
        discountAmount: discount.toFixed(2),
        taxAmount: tax.toFixed(2),
        grandTotal,
        paymentType: input.paymentType,
        paymentStatus,
        advanceAmount,
        totalPaid: "0",
        outstandingBalance,
        status: "draft",
        createdBy: userId,
      });

      const saleId = Number(result[0].insertId);

      // Insert additional features
      if (input.features && input.features.length > 0) {
        await db.insert(softwareSaleFeatures).values(
          input.features.map((f) => ({ ...f, saleId }))
        );
      }

      await logActivity({
        userId,
        userName,
        action: "sale_created",
        entityType: "sale",
        entityId: saleId,
        newValue: { customerId: input.customerId, productId: input.productId, grandTotal, paymentType: input.paymentType },
      });

      return { id: saleId, saleNumber };
    }),

  submitForApproval: developerOnlyQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareSales)
        .where(and(eq(softwareSales.id, input.id), isNull(softwareSales.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      if (existing[0].createdBy !== userId && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (!["draft", "rejected"].includes(existing[0].status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sale cannot be submitted for approval" });
      }

      // ─── ADVANCE PAYMENT ENFORCEMENT ───────────────────────────────
      if (existing[0].paymentType === "advance_50") {
        const advanceRequired = parseFloat(existing[0].advanceAmount || "0");
        const totalPaid = parseFloat(existing[0].totalPaid || "0");
        if (totalPaid < advanceRequired) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Advance payment of ${advanceRequired.toFixed(2)} is required before approval. Current paid: ${totalPaid.toFixed(2)}`,
          });
        }
      }

      await db
        .update(softwareSales)
        .set({ status: "pending_approval", rejectionReason: null })
        .where(eq(softwareSales.id, input.id));

      await logActivity({
        userId,
        userName,
        action: "sale_submitted_for_approval",
        entityType: "sale",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: { status: "pending_approval" },
      });

      await notifyAdminsForApproval({
        submitterName: userName,
        entityType: "Sale",
        entityName: existing[0].saleNumber || `Sale #${input.id}`,
        entityId: input.id,
      });

      return { success: true };
    }),

  approve: adminQuery
    .input(z.object({
      id: z.number(),
      action: z.enum(["approve", "reject", "request_revision"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareSales)
        .where(and(eq(softwareSales.id, input.id), isNull(softwareSales.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      if (existing[0].status !== "pending_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sale is not pending approval" });
      }

      let status = existing[0].status;
      if (input.action === "approve") status = "approved";
      else if (input.action === "reject") status = "rejected";
      else if (input.action === "request_revision") status = "draft";

      const updateData: any = {
        status,
        approvedBy: userId,
        approvedAt: new Date(),
      };
      if (input.reason) {
        if (input.action === "reject") updateData.rejectionReason = input.reason;
        else updateData.revisionNotes = input.reason;
      }

      await db.update(softwareSales).set(updateData).where(eq(softwareSales.id, input.id));

      // Auto-generate invoice on approval (once per sale)
      if (input.action === "approve") {
        const sale = existing[0];
        const existingInvoice = await db
          .select({ id: softwareInvoices.id })
          .from(softwareInvoices)
          .where(and(eq(softwareInvoices.saleId, input.id), isNull(softwareInvoices.deletedAt)))
          .limit(1);

        if (existingInvoice.length === 0) {
          const invoiceResult = await db.insert(softwareInvoices).values({
            invoiceNumber: generateInvoiceNumber(),
            saleId: input.id,
            customerId: sale.customerId,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            subtotal: sale.grandTotal,
            taxAmount: sale.taxAmount,
            discountAmount: sale.discountAmount,
            totalAmount: sale.grandTotal,
            amountPaid: sale.totalPaid || "0",
            outstandingAmount: sale.outstandingBalance || sale.grandTotal,
            status: "draft",
            generatedBy: userId,
          });

          const invoiceId = Number(invoiceResult[0].insertId);

          await db.insert(softwareInvoiceItems).values({
            invoiceId,
            description: `Software Product Sale`,
            quantity: 1,
            unitPrice: sale.basePrice,
            totalPrice: sale.basePrice,
          });

          const features = await db
            .select()
            .from(softwareSaleFeatures)
            .where(eq(softwareSaleFeatures.saleId, input.id));

          if (features.length > 0) {
            await db.insert(softwareInvoiceItems).values(
              features.map((f) => ({
                invoiceId,
                description: f.name,
                quantity: 1,
                unitPrice: f.price,
                totalPrice: f.price,
              }))
            );
          }
        }
      }

      await logActivity({
        userId,
        userName,
        action: `sale_${input.action}`,
        entityType: "sale",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: updateData,
      });

      // Notify creator
      await notifyCreator({
        creatorId: existing[0].createdBy,
        entityType: "Sale",
        entityName: existing[0].saleNumber,
        action: input.action === "approve" ? "approved" : "rejected",
        reason: input.reason,
        entityId: input.id,
      });

      return { success: true };
    }),

  delete: developerOnlyQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareSales)
        .where(and(eq(softwareSales.id, input.id), isNull(softwareSales.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      assertDeveloperRecord(existing[0].createdBy, userId, ctx.unifiedUser!.role);

      await db.update(softwareSales).set({ deletedAt: new Date() }).where(eq(softwareSales.id, input.id));

      await logActivity({
        userId,
        userName,
        action: "sale_deleted",
        entityType: "sale",
        entityId: input.id,
        previousValue: existing[0],
      });

      return { success: true };
    }),

  stats: developerQuery.query(async ({ ctx }) => {
    const db = getDb();
    const base = isNull(softwareSales.deletedAt);
    const staffFilter = isDeveloperRole(ctx.unifiedUser!.role)
      ? and(base, eq(softwareSales.createdBy, ctx.unifiedUser!.id))
      : base;

    const total = await db.select({ count: count() }).from(softwareSales).where(staffFilter);
    const pending = await db.select({ count: count() }).from(softwareSales).where(and(eq(softwareSales.status, "pending_approval"), staffFilter));
    const approved = await db.select({ count: count() }).from(softwareSales).where(and(eq(softwareSales.status, "approved"), staffFilter));
    const completed = await db
      .select({ count: count() })
      .from(softwareSales)
      .where(and(inArray(softwareSales.status, [...SOFTWARE_REVENUE_SALE_STATUSES]), staffFilter));

    const revenue = await db
      .select({ total: softwareSales.grandTotal })
      .from(softwareSales)
      .where(and(inArray(softwareSales.status, [...SOFTWARE_REVENUE_SALE_STATUSES]), staffFilter));

    const totalRevenue = revenue.reduce((sum, r) => sum + parseFloat(r.total || "0"), 0);

    return {
      total: total[0]?.count || 0,
      pendingApproval: pending[0]?.count || 0,
      approved: approved[0]?.count || 0,
      completed: completed[0]?.count || 0,
      totalRevenue,
    };
  }),
});
