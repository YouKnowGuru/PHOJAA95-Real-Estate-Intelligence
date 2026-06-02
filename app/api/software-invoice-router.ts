import { z } from "zod";
import { eq, desc, count, and, isNull, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, developerQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  softwareInvoices,
  softwareInvoiceItems,
  softwareSales,
  softwareCustomers,
  softwareProducts,
} from "@db/schema";
import { logActivity } from "./software-activity-helper";
import {
  assertDeveloperRecord,
  isDeveloperRole,
  pageInput,
} from "./lib/access-control";

export const softwareInvoiceRouter = createRouter({
  list: developerQuery
    .input(
      z.object({
        status: z.string().optional(),
        search: z.string().optional(),
        saleId: z.number().optional(),
        customerId: z.number().optional(),
        ...pageInput,
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(softwareInvoices.deletedAt)];

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(softwareSales.createdBy, ctx.unifiedUser!.id));
      }

      if (input.status) conditions.push(eq(softwareInvoices.status, input.status as any));
      if (input.search) {
        const term = `%${input.search}%`;
        conditions.push(
          or(
            like(softwareInvoices.invoiceNumber, term),
            like(softwareCustomers.fullName, term),
            like(softwareProducts.name, term),
            like(softwareSales.saleNumber, term)
          ) as any
        );
      }
      if (input.saleId) conditions.push(eq(softwareInvoices.saleId, input.saleId));
      if (input.customerId) conditions.push(eq(softwareInvoices.customerId, input.customerId));

      const whereClause = and(...conditions);
      const totalResult = await db
        .select({ count: count() })
        .from(softwareInvoices)
        .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
        .leftJoin(softwareCustomers, eq(softwareInvoices.customerId, softwareCustomers.id))
        .leftJoin(softwareProducts, eq(softwareSales.productId, softwareProducts.id))
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: softwareInvoices.id,
          invoiceNumber: softwareInvoices.invoiceNumber,
          saleId: softwareInvoices.saleId,
          saleNumber: softwareSales.saleNumber,
          customerId: softwareInvoices.customerId,
          customerName: softwareCustomers.fullName,
          customerEmail: softwareCustomers.email,
          customerPhone: softwareCustomers.phone,
          companyName: softwareCustomers.companyName,
          productName: softwareProducts.name,
          subtotal: softwareInvoices.subtotal,
          taxAmount: softwareInvoices.taxAmount,
          discountAmount: softwareInvoices.discountAmount,
          issueDate: softwareInvoices.issueDate,
          dueDate: softwareInvoices.dueDate,
          totalAmount: softwareInvoices.totalAmount,
          amountPaid: softwareInvoices.amountPaid,
          outstandingAmount: softwareInvoices.outstandingAmount,
          status: softwareInvoices.status,
          createdAt: softwareInvoices.createdAt,
        })
        .from(softwareInvoices)
        .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
        .leftJoin(softwareCustomers, eq(softwareInvoices.customerId, softwareCustomers.id))
        .leftJoin(softwareProducts, eq(softwareSales.productId, softwareProducts.id))
        .where(whereClause)
        .orderBy(desc(softwareInvoices.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select({ invoice: softwareInvoices, saleCreatedBy: softwareSales.createdBy })
        .from(softwareInvoices)
        .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
        .where(and(eq(softwareInvoices.id, input.id), isNull(softwareInvoices.deletedAt)))
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      assertDeveloperRecord(rows[0].saleCreatedBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      const invoice = rows[0].invoice;

      const items = await db
        .select()
        .from(softwareInvoiceItems)
        .where(eq(softwareInvoiceItems.invoiceId, input.id));

      const customer = await db
        .select()
        .from(softwareCustomers)
        .where(eq(softwareCustomers.id, invoice.customerId))
        .limit(1);

      const sale = await db
        .select()
        .from(softwareSales)
        .where(eq(softwareSales.id, invoice.saleId))
        .limit(1);

      const product = sale.length
        ? await db
            .select()
            .from(softwareProducts)
            .where(eq(softwareProducts.id, sale[0].productId))
            .limit(1)
        : [];

      return {
        ...invoice,
        items,
        customer: customer[0],
        sale: sale[0],
        product: product[0],
      };
    }),

  updateStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["sent", "cancelled"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareInvoices)
        .where(and(eq(softwareInvoices.id, input.id), isNull(softwareInvoices.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      const updateData: Record<string, unknown> = { status: input.status };
      if (input.status === "sent") updateData.sentAt = new Date();

      await db.update(softwareInvoices).set(updateData).where(eq(softwareInvoices.id, input.id));

      await logActivity({
        userId,
        userName,
        action: "invoice_status_updated",
        entityType: "invoice",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: updateData,
      });

      return { success: true };
    }),

  stats: developerQuery.query(async ({ ctx }) => {
    const db = getDb();
    const baseConditions = [isNull(softwareInvoices.deletedAt)];
    if (isDeveloperRole(ctx.unifiedUser!.role)) {
      baseConditions.push(eq(softwareSales.createdBy, ctx.unifiedUser!.id));
    }
    const base = and(...baseConditions);

    const total = await db
      .select({ count: count() })
      .from(softwareInvoices)
      .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
      .where(base);
    const paid = await db
      .select({ count: count() })
      .from(softwareInvoices)
      .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
      .where(and(eq(softwareInvoices.status, "paid"), base));
    const partiallyPaid = await db
      .select({ count: count() })
      .from(softwareInvoices)
      .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
      .where(and(eq(softwareInvoices.status, "partially_paid"), base));
    const pending = await db
      .select({ count: count() })
      .from(softwareInvoices)
      .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
      .where(and(eq(softwareInvoices.status, "sent"), base));
    const overdue = await db
      .select({ count: count() })
      .from(softwareInvoices)
      .innerJoin(softwareSales, eq(softwareInvoices.saleId, softwareSales.id))
      .where(and(eq(softwareInvoices.status, "overdue"), base));

    return {
      total: total[0]?.count || 0,
      paid: paid[0]?.count || 0,
      partiallyPaid: partiallyPaid[0]?.count || 0,
      pending: pending[0]?.count || 0,
      overdue: overdue[0]?.count || 0,
    };
  }),
});
