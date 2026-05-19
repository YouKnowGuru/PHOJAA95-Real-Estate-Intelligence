import { z } from "zod";
import { eq, desc, count, and, gte, lte } from "drizzle-orm";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { activityLogs } from "@db/schema";

export const activityLogRouter = createRouter({
  create: staffQuery
    .input(
      z.object({
        action: z.string(),
        entityType: z.enum(["property", "user", "attendance", "payroll", "setting"]).optional(),
        entityId: z.number().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        ipAddress: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;

      const result = await db.insert(activityLogs).values({
        userId,
        userName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      });

      return { id: Number(result[0].insertId) };
    }),

  list: adminQuery
    .input(
      z.object({
        userId: z.number().optional(),
        action: z.enum(["created", "updated", "deleted", "approved", "rejected", "login", "logout"]).optional(),
        entityType: z.enum(["property", "user", "attendance", "payroll", "setting"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input.userId) conditions.push(eq(activityLogs.userId, input.userId));
      if (input.action) conditions.push(eq(activityLogs.action, input.action));
      if (input.entityType) conditions.push(eq(activityLogs.entityType, input.entityType));
      if (input.dateFrom) conditions.push(gte(activityLogs.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(activityLogs.createdAt, new Date(input.dateTo)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const totalResult = await db.select({ count: count() }).from(activityLogs).where(whereClause);
      const total = totalResult[0]?.count || 0;

      const results = await db.select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        userName: activityLogs.userName,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        metadata: activityLogs.metadata,
        ipAddress: activityLogs.ipAddress,
        createdAt: activityLogs.createdAt,
      })
        .from(activityLogs)
        .where(whereClause)
        .orderBy(desc(activityLogs.createdAt))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  myActivity: staffQuery
    .input(z.object({ page: z.number().default(1), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;

      const results = await db.select().from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);

      return results;
    }),
});
