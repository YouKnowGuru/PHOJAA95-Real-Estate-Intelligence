import { z } from "zod";
import { eq, like, desc, count, and, or, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, developerQuery, developerOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwareProducts, softwareProductFeatures, localUsers, softwareActivityLogs } from "@db/schema";
import { logActivity, notifyCreator, notifyAdminsForApproval } from "./software-activity-helper";
import {
  assertDeveloperRecord,
  isDeveloperRole,
  pageInput,
} from "./lib/access-control";

function generateProductCode(): string {
  const prefix = "PROD";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export const softwareProductRouter = createRouter({
  list: developerQuery
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        ...pageInput,
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(softwareProducts.deletedAt)];

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(softwareProducts.createdBy, ctx.unifiedUser!.id));
      }

      if (input.search) {
        conditions.push(
          or(
            like(softwareProducts.name, `%${input.search}%`),
            like(softwareProducts.productCode, `%${input.search}%`)
          )
        );
      }
      if (input.category) conditions.push(eq(softwareProducts.category, input.category as any));
      if (input.status) conditions.push(eq(softwareProducts.status, input.status as any));

      const whereClause = and(...conditions);

      const totalResult = await db.select({ count: count() }).from(softwareProducts).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: softwareProducts.id,
          productCode: softwareProducts.productCode,
          name: softwareProducts.name,
          category: softwareProducts.category,
          shortDescription: softwareProducts.shortDescription,
          detailedDescription: softwareProducts.detailedDescription,
          price: softwareProducts.price,
          thumbnail: softwareProducts.thumbnail,
          version: softwareProducts.version,
          status: softwareProducts.status,
          features: softwareProducts.features,
          technologiesUsed: softwareProducts.technologiesUsed,
          estimatedDuration: softwareProducts.estimatedDuration,
          demoUrl: softwareProducts.demoUrl,
          documentationUrl: softwareProducts.documentationUrl,
          warrantyPeriod: softwareProducts.warrantyPeriod,
          maintenancePeriod: softwareProducts.maintenancePeriod,
          createdBy: softwareProducts.createdBy,
          approvedBy: softwareProducts.approvedBy,
          approvedAt: softwareProducts.approvedAt,
          rejectionReason: softwareProducts.rejectionReason,
          createdAt: softwareProducts.createdAt,
          creatorName: localUsers.fullName,
        })
        .from(softwareProducts)
        .leftJoin(localUsers, eq(localUsers.id, softwareProducts.createdBy))
        .where(whereClause)
        .orderBy(desc(softwareProducts.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const product = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, input.id), isNull(softwareProducts.deletedAt)))
        .limit(1);

      if (product.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      assertDeveloperRecord(product[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);

      const features = await db
        .select()
        .from(softwareProductFeatures)
        .where(eq(softwareProductFeatures.productId, input.id));

      return { ...product[0], features };
    }),

  getSellable: developerQuery
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [
        isNull(softwareProducts.deletedAt),
        inArray(softwareProducts.status, ["completed", "published"]),
      ];

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(softwareProducts.createdBy, ctx.unifiedUser!.id));
      }

      if (input?.search) {
        conditions.push(
          or(
            like(softwareProducts.name, `%${input.search}%`),
            like(softwareProducts.productCode, `%${input.search}%`)
          ) as any
        );
      }

      const results = await db
        .select({
          id: softwareProducts.id,
          productCode: softwareProducts.productCode,
          name: softwareProducts.name,
          category: softwareProducts.category,
          shortDescription: softwareProducts.shortDescription,
          price: softwareProducts.price,
          thumbnail: softwareProducts.thumbnail,
          version: softwareProducts.version,
        })
        .from(softwareProducts)
        .where(and(...conditions))
        .orderBy(desc(softwareProducts.createdAt));

      return results;
    }),

  create: developerOnlyQuery
    .input(
      z.object({
        name: z.string().min(2).max(255),
        category: z.enum([
          "website", "web_application", "android_application", "ios_application",
          "desktop_software", "erp_system", "pos_system", "crm_system",
          "ecommerce_platform", "saas_platform", "api_service", "custom_software", "other",
        ]),
        shortDescription: z.string().optional(),
        detailedDescription: z.string().optional(),
        features: z.array(z.string()).optional(),
        technologiesUsed: z.string().optional(),
        estimatedDuration: z.string().optional(),
        price: z.string().optional(),
        thumbnail: z.string().optional(),
        screenshots: z.array(z.string()).optional(),
        demoUrl: z.string().optional(),
        documentationUrl: z.string().optional(),
        version: z.string().optional(),
        warrantyPeriod: z.number().optional(),
        maintenancePeriod: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const productCode = generateProductCode();
      const result = await db.insert(softwareProducts).values({
        ...input,
        productCode,
        price: input.price || "0",
        status: "draft",
        createdBy: userId,
      });

      const newId = Number(result[0].insertId);

      await logActivity({
        userId,
        userName,
        action: "product_created",
        entityType: "product",
        entityId: newId,
        newValue: { name: input.name, category: input.category },
      });

      return { id: newId, productCode };
    }),

  update: developerOnlyQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).max(255).optional(),
        category: z.enum([
          "website", "web_application", "android_application", "ios_application",
          "desktop_software", "erp_system", "pos_system", "crm_system",
          "ecommerce_platform", "saas_platform", "api_service", "custom_software", "other",
        ]).optional(),
        shortDescription: z.string().optional(),
        detailedDescription: z.string().optional(),
        features: z.array(z.string()).optional(),
        technologiesUsed: z.string().optional(),
        estimatedDuration: z.string().optional(),
        price: z.string().optional(),
        thumbnail: z.string().optional(),
        screenshots: z.array(z.string()).optional(),
        demoUrl: z.string().optional(),
        documentationUrl: z.string().optional(),
        version: z.string().optional(),
        warrantyPeriod: z.number().optional(),
        maintenancePeriod: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, id), isNull(softwareProducts.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      // Only creator or admin can update
      if (existing[0].createdBy !== userId && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only update your own products" });
      }

      // Cannot edit if already approved/published/completed
      if (["approved", "published", "completed"].includes(existing[0].status)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit approved/published/completed products" });
      }

      await db.update(softwareProducts).set(data).where(eq(softwareProducts.id, id));

      await logActivity({
        userId,
        userName,
        action: "product_updated",
        entityType: "product",
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
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, input.id), isNull(softwareProducts.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      if (existing[0].createdBy !== userId && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (!["draft", "rejected"].includes(existing[0].status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Product cannot be submitted for approval" });
      }

      await db
        .update(softwareProducts)
        .set({ status: "pending_approval", rejectionReason: null })
        .where(eq(softwareProducts.id, input.id));

      await logActivity({
        userId,
        userName,
        action: "product_submitted_for_approval",
        entityType: "product",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: { status: "pending_approval" },
      });

      await notifyAdminsForApproval({
        submitterName: userName,
        entityType: "Product",
        entityName: existing[0].name,
        entityId: input.id,
      });

      return { success: true };
    }),

  approve: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["approved", "rejected", "published", "archived"]), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, input.id), isNull(softwareProducts.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      const updateData: any = { status: input.status, approvedBy: userId, approvedAt: new Date() };
      if (input.reason) updateData.rejectionReason = input.reason;

      await db.update(softwareProducts).set(updateData).where(eq(softwareProducts.id, input.id));

      await logActivity({
        userId,
        userName,
        action: `product_${input.status}`,
        entityType: "product",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: updateData,
      });

      await notifyCreator({
        creatorId: existing[0].createdBy,
        entityType: "Product",
        entityName: existing[0].name,
        action: input.status === "approved" || input.status === "published" ? "approved" : "rejected",
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
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, input.id), isNull(softwareProducts.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      assertDeveloperRecord(existing[0].createdBy, userId, ctx.unifiedUser!.role);

      await db.update(softwareProducts).set({ deletedAt: new Date() }).where(eq(softwareProducts.id, input.id));

      await logActivity({
        userId,
        userName,
        action: "product_deleted",
        entityType: "product",
        entityId: input.id,
        previousValue: existing[0],
      });

      return { success: true };
    }),

  // Activity log for a specific product
  activityLog: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const product = await db
        .select({ createdBy: softwareProducts.createdBy })
        .from(softwareProducts)
        .where(and(eq(softwareProducts.id, input.id), isNull(softwareProducts.deletedAt)))
        .limit(1);
      if (product.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      assertDeveloperRecord(product[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);

      const logs = await db
        .select()
        .from(softwareActivityLogs)
        .where(
          and(
            eq(softwareActivityLogs.entityType, "product"),
            eq(softwareActivityLogs.entityId, input.id)
          )
        )
        .orderBy(desc(softwareActivityLogs.createdAt))
        .limit(50);
      return logs;
    }),

  // Dashboard stats
  stats: developerQuery.query(async () => {
    const db = getDb();
    const total = await db.select({ count: count() }).from(softwareProducts).where(isNull(softwareProducts.deletedAt));
    const pending = await db.select({ count: count() }).from(softwareProducts).where(and(eq(softwareProducts.status, "pending_approval"), isNull(softwareProducts.deletedAt)));
    const completed = await db.select({ count: count() }).from(softwareProducts).where(and(eq(softwareProducts.status, "completed"), isNull(softwareProducts.deletedAt)));
    const published = await db.select({ count: count() }).from(softwareProducts).where(and(eq(softwareProducts.status, "published"), isNull(softwareProducts.deletedAt)));

    return {
      total: total[0]?.count || 0,
      pendingApproval: pending[0]?.count || 0,
      completed: completed[0]?.count || 0,
      published: published[0]?.count || 0,
    };
  }),
});
