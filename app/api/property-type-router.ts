import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, staffQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { propertyTypes, properties } from "@db/schema";

export const propertyTypeRouter = createRouter({
  list: staffQuery.query(async () => {
    const db = getDb();
    return db.select().from(propertyTypes).orderBy(propertyTypes.name);
  }),

  create: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        requiresBuildingDocs: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(propertyTypes).values(input);
      return { id: Number(result[0].insertId), ...input };
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        requiresBuildingDocs: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = getDb();
      await db.update(propertyTypes).set(data).where(eq(propertyTypes.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Guard: prevent deleting types with associated properties
      const associated = await db.select({ count: count() }).from(properties).where(eq(properties.propertyTypeId, input.id));
      if ((associated[0]?.count || 0) > 0) {
        throw new TRPCError({ code: "CONFLICT", message: `Cannot delete: ${associated[0].count} properties use this type. Reassign them first.` });
      }
      await db.delete(propertyTypes).where(eq(propertyTypes.id, input.id));
      return { success: true };
    }),
});
