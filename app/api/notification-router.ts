import { z } from "zod";
import { eq, and, desc, gt, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { notifications, localUsers, properties } from "@db/schema";

export const notificationRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        unreadOnly: z.boolean().optional(),
        limit: z.number().default(20),
        cursor: z.number().optional(),
      }).default(() => ({ limit: 20 }))
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;

      const conditions = [eq(notifications.userId, userId)];
      if (input.unreadOnly) {
        conditions.push(eq(notifications.isRead, false));
      }
      if (input.cursor) {
        conditions.push(gt(notifications.createdAt, new Date(input.cursor)));
      }

      const items = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit);

      const unreadCount = await db
        .select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

      return {
        items,
        unreadCount: unreadCount[0]?.count || 0,
        nextCursor: items.length > 0 ? items[items.length - 1].createdAt.getTime() : undefined,
        hasMore: items.length === input.limit,
      };
    }),

  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.unifiedUser!.id)));
      if (result[0].affectedRows === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }
      return { success: true };
    }),

  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, ctx.unifiedUser!.id), eq(notifications.isRead, false)));
    return { success: true };
  }),

  clearHistory: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db.delete(notifications)
      .where(and(eq(notifications.userId, ctx.unifiedUser!.id), eq(notifications.isRead, true)));
    return { success: true };
  }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.delete(notifications)
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.unifiedUser!.id)));
      if (result[0].affectedRows === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }
      return { success: true };
    }),

  createNotification: staffQuery
    .input(
      z.object({
        userId: z.number(),
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        type: z.enum(["info", "success", "warning", "error", "approval"]).default("info"),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.unifiedUser!.id !== input.userId && ctx.unifiedUser!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Can only create notifications for yourself" });
      }
      await db.insert(notifications).values(input);
      return { success: true };
    }),

  createBulkNotification: adminQuery
    .input(
      z.object({
        userIds: z.array(z.number()).max(1000),
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        type: z.enum(["info", "success", "warning", "error", "approval"]).default("info"),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.userIds.length === 0) return { success: true, count: 0 };
      const db = getDb();
      const values = input.userIds.map((userId) => ({
        userId,
        title: input.title,
        message: input.message,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
      }));
      await db.insert(notifications).values(values);
      return { success: true, count: values.length };
    }),

  broadcast: adminQuery
    .input(
      z.object({
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        type: z.enum(["info", "success", "warning", "error", "approval"]).default("info"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const allUsers = await db.select({ id: localUsers.id }).from(localUsers).where(eq(localUsers.status, "active"));
      
      if (allUsers.length === 0) return { success: true, count: 0 };

      const values = allUsers.map((u) => ({
        userId: u.id,
        title: input.title,
        message: input.message,
        type: input.type,
      }));
      
      await db.insert(notifications).values(values);
      return { success: true, count: values.length };
    }),

  notifyPropertyApproval: adminQuery
    .input(
      z.object({
        propertyId: z.number(),
        step: z.number(),
        approved: z.boolean(),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const property = await db
        .select({ listedById: properties.listedById, propertyName: properties.propertyName })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      if (property.length === 0) return { success: false };

      const title = input.approved 
        ? `Step ${input.step} Approved` 
        : `Step ${input.step} Rejected`;
      
      const message = input.approved
        ? `Your property "${property[0].propertyName}" - Step ${input.step} has been approved.`
        : `Your property "${property[0].propertyName}" - Step ${input.step} has been rejected.${input.comments ? ` Reason: ${input.comments}` : ""}`;

      const type = input.approved ? "success" : "warning";

      await db.insert(notifications).values({
        userId: property[0].listedById,
        title,
        message,
        type,
        entityType: "property",
        entityId: input.propertyId,
      });

      return { success: true };
    }),

  getUnreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const result = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.unifiedUser!.id), eq(notifications.isRead, false)));
    return { count: result[0]?.count || 0 };
  }),
});