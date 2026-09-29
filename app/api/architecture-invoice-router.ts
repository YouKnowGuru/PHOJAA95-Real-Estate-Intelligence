import { z } from "zod";
import { eq, desc, count, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, architectureStaffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  architectureInvoices,
  architectureInvoiceItems,
  architectureOrders,
  architectureCustomers,
  architectureCertificates,
} from "@db/schema";
import {
  assertArchitectureStaffRecord,
  isArchitectureStaffRole,
  pageInput,
  sanitizeArchitectureCustomer,
} from "./lib/access-control";

export const architectureInvoiceRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({
      orderId: z.number().optional(),
      ...pageInput,
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(architectureInvoices.deletedAt)];
      const userId = ctx.unifiedUser!.id;
      const role = ctx.unifiedUser!.role;

      if (input.orderId) {
        const order = await db
          .select({ createdBy: architectureOrders.createdBy })
          .from(architectureOrders)
          .where(and(eq(architectureOrders.id, input.orderId), isNull(architectureOrders.deletedAt)))
          .limit(1);
        if (order.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        assertArchitectureStaffRecord(order[0].createdBy, userId, role);
        conditions.push(eq(architectureInvoices.orderId, input.orderId));
      }

      if (isArchitectureStaffRole(role)) {
        conditions.push(eq(architectureOrders.createdBy, userId));
      }

      const whereClause = and(...conditions);
      const totalResult = await db
        .select({ count: count() })
        .from(architectureInvoices)
        .innerJoin(architectureOrders, eq(architectureInvoices.orderId, architectureOrders.id))
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: architectureInvoices.id,
          invoiceNumber: architectureInvoices.invoiceNumber,
          orderId: architectureInvoices.orderId,
          orderNumber: architectureOrders.orderNumber,
          customerId: architectureInvoices.customerId,
          customerName: architectureCustomers.fullName,
          customerEmail: architectureCustomers.email,
          customerPhone: architectureCustomers.phone,
          projectName: architectureOrders.projectName,
          subtotal: architectureInvoices.subtotal,
          taxAmount: architectureInvoices.taxAmount,
          discountAmount: architectureInvoices.discountAmount,
          totalAmount: architectureInvoices.totalAmount,
          amountPaid: architectureInvoices.amountPaid,
          remainingAmount: architectureInvoices.remainingAmount,
          paymentStatus: architectureInvoices.paymentStatus,
          status: architectureInvoices.status,
          issueDate: architectureInvoices.issueDate,
          dueDate: architectureInvoices.dueDate,
          createdAt: architectureInvoices.createdAt,
        })
        .from(architectureInvoices)
        .innerJoin(architectureOrders, eq(architectureInvoices.orderId, architectureOrders.id))
        .leftJoin(architectureCustomers, eq(architectureInvoices.customerId, architectureCustomers.id))
        .where(whereClause)
        .orderBy(desc(architectureInvoices.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const invoice = await db
        .select()
        .from(architectureInvoices)
        .where(and(eq(architectureInvoices.id, input.id), isNull(architectureInvoices.deletedAt)))
        .limit(1);

      if (invoice.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      const order = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.id, invoice[0].orderId), isNull(architectureOrders.deletedAt)))
        .limit(1);

      if (order.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      assertArchitectureStaffRecord(order[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);

      const items = await db
        .select()
        .from(architectureInvoiceItems)
        .where(eq(architectureInvoiceItems.invoiceId, input.id));

      const customer = await db
        .select()
        .from(architectureCustomers)
        .where(eq(architectureCustomers.id, invoice[0].customerId))
        .limit(1);

      return {
        ...invoice[0],
        items,
        customer: customer[0] ? sanitizeArchitectureCustomer(customer[0] as Record<string, unknown>) : undefined,
        order: order[0],
      };
    }),

  stats: architectureStaffQuery.query(async ({ ctx }) => {
    const db = getDb();
    const baseConditions = [isNull(architectureInvoices.deletedAt)];
    if (isArchitectureStaffRole(ctx.unifiedUser!.role)) {
      baseConditions.push(eq(architectureOrders.createdBy, ctx.unifiedUser!.id));
    }
    const base = and(...baseConditions);

    const joinFrom = db
      .select({ count: count() })
      .from(architectureInvoices)
      .innerJoin(architectureOrders, eq(architectureInvoices.orderId, architectureOrders.id))
      .where(base);

    const total = await joinFrom;
    const unpaid = await db
      .select({ count: count() })
      .from(architectureInvoices)
      .innerJoin(architectureOrders, eq(architectureInvoices.orderId, architectureOrders.id))
      .where(and(eq(architectureInvoices.paymentStatus, "unpaid"), base));
    const partiallyPaid = await db
      .select({ count: count() })
      .from(architectureInvoices)
      .innerJoin(architectureOrders, eq(architectureInvoices.orderId, architectureOrders.id))
      .where(and(eq(architectureInvoices.paymentStatus, "partially_paid"), base));
    const paid = await db
      .select({ count: count() })
      .from(architectureInvoices)
      .innerJoin(architectureOrders, eq(architectureInvoices.orderId, architectureOrders.id))
      .where(and(eq(architectureInvoices.paymentStatus, "fully_paid"), base));

    return {
      total: total[0]?.count || 0,
      unpaid: unpaid[0]?.count || 0,
      partiallyPaid: partiallyPaid[0]?.count || 0,
      paid: paid[0]?.count || 0,
    };
  }),
});

export const architectureCertificateRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({ ...pageInput }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions: ReturnType<typeof eq>[] = [];
      if (isArchitectureStaffRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(architectureOrders.createdBy, ctx.unifiedUser!.id));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const totalResult = await db
        .select({ count: count() })
        .from(architectureCertificates)
        .innerJoin(architectureOrders, eq(architectureCertificates.orderId, architectureOrders.id))
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({ certificate: architectureCertificates })
        .from(architectureCertificates)
        .innerJoin(architectureOrders, eq(architectureCertificates.orderId, architectureOrders.id))
        .where(whereClause)
        .orderBy(desc(architectureCertificates.createdAt))
        .limit(input.limit)
        .offset(offset);

      return {
        items: results.map((r) => r.certificate),
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  getById: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select({
          certificate: architectureCertificates,
          orderCreatedBy: architectureOrders.createdBy,
        })
        .from(architectureCertificates)
        .innerJoin(architectureOrders, eq(architectureCertificates.orderId, architectureOrders.id))
        .where(eq(architectureCertificates.id, input.id))
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      assertArchitectureStaffRecord(rows[0].orderCreatedBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return rows[0].certificate;
    }),

  verify: architectureStaffQuery
    .input(z.object({ verificationNumber: z.string().max(100) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select({
          certificate: architectureCertificates,
          orderCreatedBy: architectureOrders.createdBy,
        })
        .from(architectureCertificates)
        .innerJoin(architectureOrders, eq(architectureCertificates.orderId, architectureOrders.id))
        .where(eq(architectureCertificates.verificationNumber, input.verificationNumber))
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid verification number" });
      assertArchitectureStaffRecord(rows[0].orderCreatedBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return rows[0].certificate;
    }),
});
