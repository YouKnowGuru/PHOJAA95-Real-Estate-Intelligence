import { z } from "zod";
import { eq, desc, count, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, developerQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwareCertificates, softwareSales, softwareProjects, softwareInvoices, softwareCustomers, softwareProducts, localUsers } from "@db/schema";
import { logActivity, notifyCreator } from "./software-activity-helper";
import {
  assertDeveloperRecord,
  actorDisplayName,
  isDeveloperRole,
  pageInput,
} from "./lib/access-control";

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

export const softwareCertificateRouter = createRouter({
  list: developerQuery
    .input(
      z.object({
        type: z.string().optional(),
        customerId: z.number().optional(),
        ...pageInput,
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [];

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(softwareSales.createdBy, ctx.unifiedUser!.id));
      }

      if (input.type) conditions.push(eq(softwareCertificates.certificateType, input.type));
      if (input.customerId) conditions.push(eq(softwareCertificates.customerId, input.customerId));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const totalResult = await db
        .select({ count: count() })
        .from(softwareCertificates)
        .innerJoin(softwareSales, eq(softwareCertificates.saleId, softwareSales.id))
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({ certificate: softwareCertificates })
        .from(softwareCertificates)
        .innerJoin(softwareSales, eq(softwareCertificates.saleId, softwareSales.id))
        .where(whereClause)
        .orderBy(desc(softwareCertificates.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results.map((r) => r.certificate), total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select({ certificate: softwareCertificates, saleCreatedBy: softwareSales.createdBy })
        .from(softwareCertificates)
        .innerJoin(softwareSales, eq(softwareCertificates.saleId, softwareSales.id))
        .where(eq(softwareCertificates.id, input.id))
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      assertDeveloperRecord(rows[0].saleCreatedBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return rows[0].certificate;
    }),

  verify: developerQuery
    .input(z.object({ verificationNumber: z.string().max(100) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select({ certificate: softwareCertificates, saleCreatedBy: softwareSales.createdBy })
        .from(softwareCertificates)
        .innerJoin(softwareSales, eq(softwareCertificates.saleId, softwareSales.id))
        .where(eq(softwareCertificates.verificationNumber, input.verificationNumber))
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid verification number" });
      assertDeveloperRecord(rows[0].saleCreatedBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return rows[0].certificate;
    }),

  generate: adminQuery
    .input(z.object({
      saleId: z.number(),
      projectId: z.number().optional(),
      certificateType: z.enum(["project_completion", "software_ownership"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      // Validate sale
      const sale = await db
        .select()
        .from(softwareSales)
        .where(and(eq(softwareSales.id, input.saleId), isNull(softwareSales.deletedAt)))
        .limit(1);

      if (sale.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      if (sale[0].status !== "completed" && sale[0].status !== "fully_paid") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sale must be completed/fully paid before generating certificate" });
      }

      // Check outstanding balance
      const outstanding = parseFloat(sale[0].outstandingBalance || "0");
      if (outstanding > 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Outstanding balance must be zero before generating certificate" });
      }

      // Get customer
      const customer = await db
        .select()
        .from(softwareCustomers)
        .where(and(eq(softwareCustomers.id, sale[0].customerId), isNull(softwareCustomers.deletedAt)))
        .limit(1);

      // Get product
      const product = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, sale[0].productId), isNull(softwareProducts.deletedAt)))
        .limit(1);

      // Get developer info
      const developer = await db
        .select()
        .from(localUsers)
        .where(eq(localUsers.id, sale[0].createdBy))
        .limit(1);

      const certificateNumber = generateCertificateNumber();
      const verificationNumber = generateVerificationNumber();

      const result = await db.insert(softwareCertificates).values({
        certificateNumber,
        certificateType: input.certificateType,
        saleId: input.saleId,
        projectId: input.projectId,
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
        verificationNumber,
        generatedBy: userId,
      });

      const certId = Number(result[0].insertId);

      await logActivity({
        userId,
        userName,
        action: "certificate_generated",
        entityType: "certificate",
        entityId: certId,
        newValue: { saleId: input.saleId, certificateType: input.certificateType, certificateNumber },
      });

      await notifyCreator({
        creatorId: sale[0].createdBy,
        entityType: "Certificate",
        entityName: product[0]?.name || "Project",
        action: "generated",
        entityId: certId,
      });

      return { id: certId, certificateNumber, verificationNumber };
    }),

  stats: developerQuery.query(async ({ ctx }) => {
    const db = getDb();
    const conditions = [];
    if (isDeveloperRole(ctx.unifiedUser!.role)) {
      conditions.push(eq(softwareSales.createdBy, ctx.unifiedUser!.id));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const total = await db
      .select({ count: count() })
      .from(softwareCertificates)
      .innerJoin(softwareSales, eq(softwareCertificates.saleId, softwareSales.id))
      .where(whereClause);
    const completion = await db
      .select({ count: count() })
      .from(softwareCertificates)
      .innerJoin(softwareSales, eq(softwareCertificates.saleId, softwareSales.id))
      .where(and(eq(softwareCertificates.certificateType, "project_completion"), whereClause));
    const ownership = await db
      .select({ count: count() })
      .from(softwareCertificates)
      .innerJoin(softwareSales, eq(softwareCertificates.saleId, softwareSales.id))
      .where(and(eq(softwareCertificates.certificateType, "software_ownership"), whereClause));

    return {
      total: total[0]?.count || 0,
      completion: completion[0]?.count || 0,
      ownership: ownership[0]?.count || 0,
    };
  }),
});
