import { z } from "zod";
import { eq, desc, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, verifyRateLimitedPublicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  architectureCustomers,
  architectureOrders,
  architectureOrderProgress,
  architecturePayments,
  architectureInvoices,
  architectureCertificates,
  architectureDocuments,
} from "@db/schema";

async function validatePortalToken(token: string) {
  const db = getDb();
  const customer = await db
    .select()
    .from(architectureCustomers)
    .where(and(
      eq(architectureCustomers.portalToken, token),
      isNull(architectureCustomers.deletedAt)
    ))
    .limit(1);

  if (customer.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid portal access" });

  if (customer[0].portalTokenExpiresAt && customer[0].portalTokenExpiresAt < new Date()) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Portal access has expired" });
  }

  return customer[0];
}

export const architecturePortalRouter = createRouter({
  getDashboard: publicQuery
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const customer = await validatePortalToken(input.token);
      const db = getDb();

      const orders = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.customerId, customer.id), isNull(architectureOrders.deletedAt)))
        .orderBy(desc(architectureOrders.createdAt));

      const payments = await db
        .select()
        .from(architecturePayments)
        .where(eq(architecturePayments.customerId, customer.id))
        .orderBy(desc(architecturePayments.createdAt));

      const invoices = await db
        .select()
        .from(architectureInvoices)
        .where(and(eq(architectureInvoices.customerId, customer.id), isNull(architectureInvoices.deletedAt)))
        .orderBy(desc(architectureInvoices.createdAt));

      const certificates = await db
        .select()
        .from(architectureCertificates)
        .where(eq(architectureCertificates.customerId, customer.id))
        .orderBy(desc(architectureCertificates.createdAt));

      return {
        customer: {
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
        },
        orders,
        payments,
        invoices,
        certificates,
      };
    }),

  getOrderProgress: publicQuery
    .input(z.object({ token: z.string(), orderId: z.number() }))
    .query(async ({ input }) => {
      const customer = await validatePortalToken(input.token);
      const db = getDb();

      const order = await db
        .select()
        .from(architectureOrders)
        .where(and(
          eq(architectureOrders.id, input.orderId),
          eq(architectureOrders.customerId, customer.id),
          isNull(architectureOrders.deletedAt)
        ))
        .limit(1);

      if (order.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      const progress = await db
        .select()
        .from(architectureOrderProgress)
        .where(eq(architectureOrderProgress.orderId, input.orderId))
        .orderBy(desc(architectureOrderProgress.createdAt));

      const documents = await db
        .select()
        .from(architectureDocuments)
        .where(and(
          eq(architectureDocuments.entityType, "order"),
          eq(architectureDocuments.entityId, input.orderId),
          isNull(architectureDocuments.deletedAt)
        ));

      return { order: order[0], progress, documents };
    }),

  getInvoice: publicQuery
    .input(z.object({ token: z.string(), invoiceId: z.number() }))
    .query(async ({ input }) => {
      const customer = await validatePortalToken(input.token);
      const db = getDb();

      const invoice = await db
        .select()
        .from(architectureInvoices)
        .where(and(
          eq(architectureInvoices.id, input.invoiceId),
          eq(architectureInvoices.customerId, customer.id),
          isNull(architectureInvoices.deletedAt)
        ))
        .limit(1);

      if (invoice.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      return invoice[0];
    }),

  getCertificate: publicQuery
    .input(z.object({ token: z.string(), certificateId: z.number() }))
    .query(async ({ input }) => {
      const customer = await validatePortalToken(input.token);
      const db = getDb();

      const cert = await db
        .select()
        .from(architectureCertificates)
        .where(and(
          eq(architectureCertificates.id, input.certificateId),
          eq(architectureCertificates.customerId, customer.id)
        ))
        .limit(1);

      if (cert.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      return cert[0];
    }),

  verifyCertificate: verifyRateLimitedPublicQuery
    .input(z.object({ verificationNumber: z.string().min(5).max(100) }))
    .query(async ({ input }) => {
      const db = getDb();
      const cert = await db
        .select()
        .from(architectureCertificates)
        .where(eq(architectureCertificates.verificationNumber, input.verificationNumber))
        .limit(1);

      if (cert.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid certificate" });
      return {
        valid: true,
        certificateNumber: cert[0].certificateNumber,
        customerName: cert[0].customerName,
        projectName: cert[0].projectName,
        projectCategory: cert[0].projectCategory,
        completionDate: cert[0].completionDate,
        companyName: cert[0].companyName,
      };
    }),
});
