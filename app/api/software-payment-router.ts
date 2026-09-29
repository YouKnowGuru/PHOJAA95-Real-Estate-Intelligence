import { z } from "zod";
import { eq, desc, count, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, developerQuery, developerOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwarePayments, softwareSales, softwareInvoices, softwareCustomers, softwareProjects, softwareCertificates, softwareProducts, localUsers } from "@db/schema";
import { logActivity, notifyCreator } from "./software-activity-helper";
import {
  actorDisplayName,
  assertDeveloperRecord,
  isDeveloperRole,
  pageInput,
  parsePositiveMoney,
} from "./lib/access-control";

function generatePaymentNumber(): string {
  const prefix = "PAY";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function generateCertificateNumber(): string {
  const prefix = "CERT";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function generateVerificationNumber(): string {
  const prefix = "VER";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Shared certificate generation logic
async function autoGenerateCertificate(
  db: any,
  saleId: number,
  projectId: number | null,
  userId: number,
  userName: string
) {
  try {
    const sale = await db
      .select()
      .from(softwareSales)
      .where(and(eq(softwareSales.id, saleId), isNull(softwareSales.deletedAt)))
      .limit(1);
    if (sale.length === 0) return;

    const outstanding = parseFloat(sale[0].outstandingBalance || "0");
    if (outstanding > 0) return;

    // Check if project is completed
    let projId = projectId;
    if (!projId) {
      const project = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, sale[0].projectId), isNull(softwareProjects.deletedAt)))
        .limit(1);
      if (project.length === 0 || project[0].status !== "completed") return;
      projId = project[0].id;
    } else {
      const project = await db
        .select()
        .from(softwareProjects)
        .where(and(eq(softwareProjects.id, projId), isNull(softwareProjects.deletedAt)))
        .limit(1);
      if (project.length === 0 || project[0].status !== "completed") return;
    }

    // Check if certificate already exists
    const existingCert = await db
      .select()
      .from(softwareCertificates)
      .where(eq(softwareCertificates.saleId, saleId))
      .limit(1);
    if (existingCert.length > 0) return;

    const customer = await db
      .select()
      .from(softwareCustomers)
      .where(and(eq(softwareCustomers.id, sale[0].customerId), isNull(softwareCustomers.deletedAt)))
      .limit(1);

    const product = await db
      .select()
      .from(softwareProducts)
      .where(and(eq(softwareProducts.id, sale[0].productId), isNull(softwareProducts.deletedAt)))
      .limit(1);

    const developer = await db
      .select()
      .from(localUsers)
      .where(eq(localUsers.id, sale[0].createdBy))
      .limit(1);

    const result = await db.insert(softwareCertificates).values({
      certificateNumber: generateCertificateNumber(),
      certificateType: "project_completion",
      saleId,
      projectId: projId,
      customerId: sale[0].customerId,
      productId: sale[0].productId,
      customerName: customer[0]?.fullName || "",
      companyName: customer[0]?.companyName || "",
      productName: product[0]?.name || "",
      productVersion: product[0]?.version || "1.0.0",
      completionDate: new Date().toISOString().split("T")[0],
      warrantyPeriod: product[0]?.warrantyPeriod || 0,
      maintenancePeriod: product[0]?.maintenancePeriod || 0,
      developerName: developer[0]?.fullName || "",
      verificationNumber: generateVerificationNumber(),
      generatedBy: userId,
    });

    const certId = Number(result[0].insertId);

    await logActivity({
      userId,
      userName,
      action: "certificate_auto_generated",
      entityType: "certificate",
      entityId: certId,
      newValue: { saleId, projectId: projId, certificateNumber: generateCertificateNumber() },
    });

    await notifyCreator({
      creatorId: sale[0].createdBy,
      entityType: "Certificate",
      entityName: product[0]?.name || "Project",
      action: "generated",
      entityId: certId,
    });
  } catch {
    // Silently fail — auto-certificate should not break payment flow
  }
}

export const softwarePaymentRouter = createRouter({
  list: developerQuery
    .input(
      z.object({
        saleId: z.number().optional(),
        customerId: z.number().optional(),
        ...pageInput,
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [];

      if (input.saleId) {
        const sale = await db
          .select({ createdBy: softwareSales.createdBy })
          .from(softwareSales)
          .where(and(eq(softwareSales.id, input.saleId), isNull(softwareSales.deletedAt)))
          .limit(1);
        if (sale.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
        assertDeveloperRecord(sale[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
        conditions.push(eq(softwarePayments.saleId, input.saleId));
      }

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(softwareSales.createdBy, ctx.unifiedUser!.id));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const totalResult = await db
        .select({ count: count() })
        .from(softwarePayments)
        .innerJoin(softwareSales, eq(softwarePayments.saleId, softwareSales.id))
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({ payment: softwarePayments })
        .from(softwarePayments)
        .innerJoin(softwareSales, eq(softwarePayments.saleId, softwareSales.id))
        .where(whereClause)
        .orderBy(desc(softwarePayments.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results.map((r) => r.payment), total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select({ payment: softwarePayments, saleCreatedBy: softwareSales.createdBy })
        .from(softwarePayments)
        .innerJoin(softwareSales, eq(softwarePayments.saleId, softwareSales.id))
        .where(eq(softwarePayments.id, input.id))
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
      assertDeveloperRecord(rows[0].saleCreatedBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return rows[0].payment;
    }),

  create: developerOnlyQuery
    .input(
      z.object({
        saleId: z.number(),
        invoiceId: z.number().optional(),
        paymentDate: z.string(),
        paymentMethod: z.enum(["cash", "bank_transfer", "mobile_banking", "cheque", "online_payment"]),
        referenceNumber: z.string().optional(),
        amount: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const sale = await db
        .select()
        .from(softwareSales)
        .where(and(eq(softwareSales.id, input.saleId), isNull(softwareSales.deletedAt)))
        .limit(1);

      if (sale.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      assertDeveloperRecord(sale[0].createdBy, userId, ctx.unifiedUser!.role);

      const paymentAmount = parsePositiveMoney(input.amount, "amount");
      const currentTotalPaid = parseFloat(sale[0].totalPaid || "0");
      const grandTotal = parseFloat(sale[0].grandTotal);
      const newTotalPaid = Math.min(grandTotal, currentTotalPaid + paymentAmount);
      const newOutstanding = Math.max(0, grandTotal - newTotalPaid);

      // Determine payment status
      let paymentStatus: "paid" | "partially_paid" = "partially_paid";
      let saleStatus = sale[0].status;
      if (newOutstanding <= 0) {
        paymentStatus = "paid";
        if (sale[0].status === "approved" || sale[0].status === "partially_paid") {
          saleStatus = "fully_paid";
        }
      } else if (newTotalPaid > 0) {
        paymentStatus = "partially_paid";
        if (sale[0].status === "approved") {
          saleStatus = "partially_paid";
        }
      }

      const paymentNumber = generatePaymentNumber();
      const result = await db.insert(softwarePayments).values({
        paymentNumber,
        saleId: input.saleId,
        customerId: sale[0].customerId,
        invoiceId: input.invoiceId,
        paymentDate: input.paymentDate as unknown as Date,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber,
        amount: paymentAmount.toFixed(2),
        notes: input.notes,
        recordedBy: userId,
      });

      // Update sale
      await db
        .update(softwareSales)
        .set({
          totalPaid: newTotalPaid.toFixed(2),
          outstandingBalance: newOutstanding.toFixed(2),
          paymentStatus,
          status: saleStatus,
        })
        .where(eq(softwareSales.id, input.saleId));

      // Update invoice if provided
      if (input.invoiceId) {
        const invoice = await db
          .select()
          .from(softwareInvoices)
          .where(eq(softwareInvoices.id, input.invoiceId))
          .limit(1);

        if (invoice.length > 0) {
          const invTotal = parseFloat(invoice[0].totalAmount);
          const invPaid = parseFloat(invoice[0].amountPaid || "0") + paymentAmount;
          const invOutstanding = Math.max(0, invTotal - invPaid);
          let invStatus: "paid" | "partially_paid" = "partially_paid";
          if (invOutstanding <= 0) invStatus = "paid";

          await db
            .update(softwareInvoices)
            .set({
              amountPaid: invPaid.toFixed(2),
              outstandingAmount: invOutstanding.toFixed(2),
              status: invStatus,
            })
            .where(eq(softwareInvoices.id, input.invoiceId));
        }
      }

      const paymentId = Number(result[0].insertId);

      await logActivity({
        userId,
        userName,
        action: "payment_created",
        entityType: "payment",
        entityId: paymentId,
        newValue: { saleId: input.saleId, amount: input.amount, paymentMethod: input.paymentMethod },
      });

      // Notify sale creator
      await notifyCreator({
        creatorId: sale[0].createdBy,
        entityType: "Payment",
        entityName: sale[0].saleNumber,
        action: "approved", // reusing "approved" as "received"
        entityId: paymentId,
      });

      // ─── AUTO-CERTIFICATE TRIGGER ──────────────────────────────────
      if (saleStatus === "fully_paid") {
        await autoGenerateCertificate(db, input.saleId, sale[0].projectId, userId, userName);
      }

      return { id: paymentId, paymentNumber };
    }),

  stats: developerQuery.query(async () => {
    const db = getDb();
    const total = await db.select({ count: count() }).from(softwarePayments);
    const pending = await db
      .select({ count: count() })
      .from(softwareSales)
      .where(and(eq(softwareSales.paymentStatus, "pending"), isNull(softwareSales.deletedAt)));
    const partiallyPaid = await db
      .select({ count: count() })
      .from(softwareSales)
      .where(and(eq(softwareSales.paymentStatus, "partially_paid"), isNull(softwareSales.deletedAt)));

    const outstanding = await db
      .select({ total: softwareSales.outstandingBalance })
      .from(softwareSales)
      .where(and(eq(softwareSales.status, "approved"), isNull(softwareSales.deletedAt)));

    const totalOutstanding = outstanding.reduce((sum, r) => sum + parseFloat(r.total || "0"), 0);

    return {
      totalPayments: total[0]?.count || 0,
      pendingPayments: pending[0]?.count || 0,
      partiallyPaid: partiallyPaid[0]?.count || 0,
      totalOutstanding,
    };
  }),
});
