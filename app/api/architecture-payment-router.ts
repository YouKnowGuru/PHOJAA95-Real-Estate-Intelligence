import { z } from "zod";
import { eq, desc, count, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, architectureStaffQuery, architectureStaffOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  architecturePayments,
  architecturePaymentVerifications,
  architectureOrders,
  architectureInvoices,
  architectureCertificates,
  architectureCustomers,
  architectureCategories,
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
  parsePositiveMoney,
} from "./lib/access-control";

function generateVerificationNumber(): string {
  return generateArchitectureCode("AVER");
}

function generateCertificateNumber(): string {
  return generateArchitectureCode("ACERT");
}

async function tryGenerateCertificate(
  db: ReturnType<typeof getDb>,
  orderId: number,
  userId: number,
  userName: string
) {
  const order = await db
    .select()
    .from(architectureOrders)
    .where(and(eq(architectureOrders.id, orderId), isNull(architectureOrders.deletedAt)))
    .limit(1);

  if (order.length === 0) return;
  if (order[0].status !== "completed" || order[0].paymentStatus !== "fully_paid") return;

  const existingCert = await db
    .select()
    .from(architectureCertificates)
    .where(eq(architectureCertificates.orderId, orderId))
    .limit(1);
  if (existingCert.length > 0) return;

  const customer = await db
    .select()
    .from(architectureCustomers)
    .where(eq(architectureCustomers.id, order[0].customerId))
    .limit(1);

  const category = await db
    .select({ name: architectureCategories.name })
    .from(architectureCategories)
    .where(eq(architectureCategories.id, order[0].categoryId))
    .limit(1);

  const staff = await db
    .select({ fullName: localUsers.fullName })
    .from(localUsers)
    .where(eq(localUsers.id, order[0].createdBy))
    .limit(1);

  const verificationNumber = generateVerificationNumber();
  const certificateNumber = generateCertificateNumber();
  const validationUrl = `/verify/architecture/${verificationNumber}`;

  const result = await db.insert(architectureCertificates).values({
    certificateNumber,
    orderId,
    customerId: order[0].customerId,
    customerName: customer[0]?.fullName || "",
    projectName: order[0].projectName,
    projectCategory: category[0]?.name || "",
    projectLocation: customer[0]?.address || "",
    // date column is in Date mode, but stores YYYY-MM-DD strings (same runtime result)
    completionDate: new Date().toISOString().split("T")[0] as unknown as Date,
    staffName: staff[0]?.fullName || "",
    companyName: "PHOJAA95 Real Estate",
    verificationNumber,
    validationUrl,
    generatedBy: userId,
  });

  const certId = Number(result[0].insertId);

  await logArchitectureActivity({
    userId,
    userName,
    action: "certificate_auto_generated",
    entityType: "certificate",
    entityId: certId,
    newValue: { orderId, certificateNumber },
  });

  await notifyArchitectureCreator({
    creatorId: order[0].createdBy,
    entityType: "Certificate",
    entityName: order[0].projectName,
    action: "generated",
    entityId: certId,
  });
}

export const architecturePaymentRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({
      orderId: z.number().optional(),
      ...pageInput,
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [];
      const role = ctx.unifiedUser!.role;
      const userId = ctx.unifiedUser!.id;

      if (input.orderId) {
        const order = await db
          .select({ createdBy: architectureOrders.createdBy })
          .from(architectureOrders)
          .where(and(eq(architectureOrders.id, input.orderId), isNull(architectureOrders.deletedAt)))
          .limit(1);
        if (order.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        assertArchitectureStaffRecord(order[0].createdBy, userId, role);
        conditions.push(eq(architecturePayments.orderId, input.orderId));
      }

      if (isArchitectureStaffRole(role)) {
        conditions.push(eq(architectureOrders.createdBy, userId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const totalResult = await db
        .select({ count: count() })
        .from(architecturePayments)
        .innerJoin(architectureOrders, eq(architecturePayments.orderId, architectureOrders.id))
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          payment: architecturePayments,
          verification: architecturePaymentVerifications,
          orderProjectName: architectureOrders.projectName,
          customerName: architectureCustomers.fullName,
        })
        .from(architecturePayments)
        .innerJoin(architectureOrders, eq(architecturePayments.orderId, architectureOrders.id))
        .leftJoin(architecturePaymentVerifications, eq(architecturePaymentVerifications.paymentId, architecturePayments.id))
        .leftJoin(architectureCustomers, eq(architecturePayments.customerId, architectureCustomers.id))
        .where(whereClause)
        .orderBy(desc(architecturePayments.createdAt))
        .limit(input.limit)
        .offset(offset);

      return {
        items: results.map((row) => ({
          ...row.payment,
          verificationStatus: row.verification?.status ?? null,
          verificationNotes: row.verification?.verificationNotes ?? null,
          orderProjectName: row.orderProjectName,
          customerName: row.customerName,
        })),
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  create: architectureStaffOnlyQuery
    .input(z.object({
      orderId: z.number(),
      paymentType: z.enum(["advance", "final", "other"]),
      paymentDate: z.string(),
      paymentMethod: z.enum(["cash", "bank_transfer", "mobile_banking", "cheque", "online_payment"]),
      referenceNumber: z.string().optional(),
      amount: z.string(),
      proofDocumentUrl: z.string().min(1, "Payment proof screenshot is required"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const order = await db
        .select()
        .from(architectureOrders)
        .where(and(eq(architectureOrders.id, input.orderId), isNull(architectureOrders.deletedAt)))
        .limit(1);

      if (order.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      assertArchitectureStaffRecord(order[0].createdBy, userId, ctx.unifiedUser!.role);

      parsePositiveMoney(input.amount, "amount");

      if (input.paymentType === "advance" && order[0].status !== "payment_pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Advance payment can only be recorded when order is awaiting payment" });
      }
      if (input.paymentType === "final" && order[0].status !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Final payment can only be recorded when the order is completed" });
      }

      const pendingExisting = await db
        .select({ id: architecturePaymentVerifications.id })
        .from(architecturePaymentVerifications)
        .innerJoin(architecturePayments, eq(architecturePaymentVerifications.paymentId, architecturePayments.id))
        .where(and(
          eq(architecturePaymentVerifications.orderId, input.orderId),
          eq(architecturePaymentVerifications.status, "pending_verification"),
          eq(architecturePayments.paymentType, input.paymentType)
        ))
        .limit(1);

      if (pendingExisting.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "A payment of this type is already pending verification" });
      }

      const paymentNumber = generateArchitectureCode("APAY");
      const result = await db.insert(architecturePayments).values({
        paymentNumber,
        orderId: input.orderId,
        customerId: order[0].customerId,
        paymentType: input.paymentType,
        // date column is in Date mode, but stores YYYY-MM-DD strings (same runtime result)
        paymentDate: input.paymentDate as unknown as Date,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber,
        amount: input.amount,
        proofDocumentUrl: input.proofDocumentUrl,
        notes: input.notes,
        recordedBy: userId,
      });

      const paymentId = Number(result[0].insertId);

      await db.insert(architecturePaymentVerifications).values({
        paymentId,
        orderId: input.orderId,
        status: "pending_verification",
      });

      await logArchitectureActivity({
        userId,
        userName,
        action: "payment_submitted",
        entityType: "payment",
        entityId: paymentId,
        newValue: { orderId: input.orderId, amount: input.amount, paymentType: input.paymentType },
      });

      await notifyAdminsForArchitectureApproval({
        submitterName: userName,
        entityType: "Payment",
        entityName: order[0].projectName,
        entityId: paymentId,
      });

      return { id: paymentId, paymentNumber };
    }),

  verify: adminQuery
    .input(z.object({
      paymentId: z.number(),
      action: z.enum(["verify", "reject"]),
      verificationNotes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const payment = await db
        .select()
        .from(architecturePayments)
        .where(eq(architecturePayments.id, input.paymentId))
        .limit(1);

      if (payment.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });

      const verification = await db
        .select()
        .from(architecturePaymentVerifications)
        .where(eq(architecturePaymentVerifications.paymentId, input.paymentId))
        .limit(1);

      if (verification.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Verification record not found" });

      if (verification[0].status !== "pending_verification") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This payment has already been processed" });
      }

      const status = input.action === "verify" ? "verified" : "rejected";

      await db
        .update(architecturePaymentVerifications)
        .set({
          status,
          verificationNotes: input.verificationNotes,
          verifiedBy: userId,
          verifiedAt: new Date(),
        })
        .where(eq(architecturePaymentVerifications.paymentId, input.paymentId));

      if (input.action === "verify") {
        const order = await db
          .select()
          .from(architectureOrders)
          .where(eq(architectureOrders.id, payment[0].orderId))
          .limit(1);

        if (order.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        const paymentAmount = parsePositiveMoney(payment[0].amount, "amount");
        const currentPaid = parseFloat(order[0].totalPaid || "0");
        const finalAmount = parseFloat(order[0].finalAmount);
        const newTotalPaid = Math.min(finalAmount, currentPaid + paymentAmount);
        const newRemaining = Math.max(0, finalAmount - newTotalPaid);

        let paymentStatus: "unpaid" | "partially_paid" | "fully_paid" = "partially_paid";
        let orderStatus = order[0].status;

        if (newRemaining <= 0) {
          paymentStatus = "fully_paid";
        } else if (newTotalPaid > 0) {
          paymentStatus = "partially_paid";
        }

        if (payment[0].paymentType === "advance" && paymentStatus !== "fully_paid") {
          orderStatus = "in_progress";
        }

        await db
          .update(architectureOrders)
          .set({
            totalPaid: newTotalPaid.toFixed(2),
            remainingPayment: newRemaining.toFixed(2),
            paymentStatus,
            status: orderStatus === "payment_pending" ? "in_progress" : orderStatus,
          })
          .where(eq(architectureOrders.id, payment[0].orderId));

        const invoices = await db
          .select()
          .from(architectureInvoices)
          .where(and(eq(architectureInvoices.orderId, payment[0].orderId), isNull(architectureInvoices.deletedAt)));

        if (invoices.length > 0) {
          await db
            .update(architectureInvoices)
            .set({
              amountPaid: newTotalPaid.toFixed(2),
              remainingAmount: newRemaining.toFixed(2),
              paymentStatus,
              status: paymentStatus === "fully_paid" ? "paid" : "partially_paid",
            })
            .where(eq(architectureInvoices.id, invoices[0].id));
        }

        await notifyArchitectureCreator({
          creatorId: order[0].createdBy,
          entityType: "Order",
          entityName: order[0].projectName,
          action: "verified",
          entityId: order[0].id,
        });

        if (paymentStatus === "fully_paid") {
          await tryGenerateCertificate(db, payment[0].orderId, userId, userName);
        }
      }

      await logArchitectureActivity({
        userId,
        userName,
        action: `payment_${input.action}`,
        entityType: "payment",
        entityId: input.paymentId,
        newValue: { status, verificationNotes: input.verificationNotes },
      });

      return { success: true };
    }),

  pendingVerifications: adminQuery
    .input(z.object({ page: z.number().default(1), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          verification: architecturePaymentVerifications,
          payment: architecturePayments,
          order: architectureOrders,
          customer: architectureCustomers,
        })
        .from(architecturePaymentVerifications)
        .innerJoin(architecturePayments, eq(architecturePaymentVerifications.paymentId, architecturePayments.id))
        .innerJoin(architectureOrders, eq(architecturePaymentVerifications.orderId, architectureOrders.id))
        .innerJoin(architectureCustomers, eq(architectureOrders.customerId, architectureCustomers.id))
        .where(eq(architecturePaymentVerifications.status, "pending_verification"))
        .orderBy(desc(architecturePaymentVerifications.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results };
    }),
});
