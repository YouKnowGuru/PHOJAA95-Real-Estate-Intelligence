import { z } from "zod";
import { eq, like, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, architectureStaffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { architectureCategories } from "@db/schema";
import { logArchitectureActivity } from "./architecture-activity-helper";
import { actorDisplayName } from "./lib/access-control";

export const architectureCategoryRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({ search: z.string().optional(), includeInactive: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [isNull(architectureCategories.deletedAt)];
      if (!input?.includeInactive) conditions.push(eq(architectureCategories.isActive, true));
      if (input?.search) conditions.push(like(architectureCategories.name, `%${input.search}%`));

      const results = await db
        .select()
        .from(architectureCategories)
        .where(and(...conditions))
        .orderBy(architectureCategories.name);

      return results;
    }),

  create: adminQuery
    .input(z.object({ name: z.string().min(2).max(255), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const result = await db.insert(architectureCategories).values(input);
      const id = Number(result[0].insertId);

      await logArchitectureActivity({
        userId,
        userName,
        action: "category_created",
        entityType: "category",
        entityId: id,
        newValue: input,
      });

      return { id };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).max(255).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const existing = await db
        .select()
        .from(architectureCategories)
        .where(and(eq(architectureCategories.id, id), isNull(architectureCategories.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });

      await db.update(architectureCategories).set(data).where(eq(architectureCategories.id, id));

      await logArchitectureActivity({
        userId,
        userName,
        action: "category_updated",
        entityType: "category",
        entityId: id,
        previousValue: existing[0],
        newValue: data,
      });

      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      await db
        .update(architectureCategories)
        .set({ deletedAt: new Date(), isActive: false })
        .where(eq(architectureCategories.id, input.id));

      await logArchitectureActivity({
        userId,
        userName,
        action: "category_deleted",
        entityType: "category",
        entityId: input.id,
      });

      return { success: true };
    }),
});
