import { z } from "zod";
import { and, eq, or, like, asc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, staffQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { clients } from "@db/schema";

const clientInsertShape = {
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  groupName: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
};

const MAX_IMPORT = 2000;

export const clientRouter = createRouter({
  list: staffQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          group: z.string().optional(),
          status: z.enum(["active", "unsubscribed"]).optional(),
        })
        .optional()
        .default({}),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      const search = input?.search?.trim();
      if (search) {
        const s = `%${search}%`;
        conds.push(
          or(
            like(clients.fullName, s),
            like(clients.email, s),
            like(clients.phone, s),
            like(clients.groupName, s),
          ),
        );
      }
      if (input?.group) conds.push(eq(clients.groupName, input.group));
      if (input?.status) conds.push(eq(clients.status, input.status));

      const rows = await db
        .select()
        .from(clients)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(asc(clients.fullName))
        .limit(2000);

      const total = await db.select({ n: sql<number>`COUNT(*)` }).from(clients);
      return { rows, total: Number(total[0]?.n ?? 0) };
    }),

  /** Distinct group names for the filter dropdown. */
  groups: staffQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .selectDistinct({ group: clients.groupName })
      .from(clients)
      .orderBy(asc(clients.groupName));
    return rows.map((r) => r.group).filter(Boolean);
  }),

  create: staffQuery.input(z.object(clientInsertShape)).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const existing = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, input.email))
      .limit(1);
    if (existing.length) {
      throw new TRPCError({ code: "CONFLICT", message: `A client with email ${input.email} already exists.` });
    }
    const result = await db.insert(clients).values({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone || null,
      groupName: input.groupName?.trim() || "General",
      notes: input.notes || null,
      createdBy: ctx.unifiedUser?.id ?? null,
    });
    const id = Number(result[0].insertId);
    const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return rows[0];
  }),

  update: staffQuery
    .input(
      z.object({
        id: z.number(),
        ...clientInsertShape,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const dupe = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.email, input.email))
        .limit(2);
      if (dupe.some((r) => r.id !== input.id)) {
        throw new TRPCError({ code: "CONFLICT", message: `A client with email ${input.email} already exists.` });
      }
      await db
        .update(clients)
        .set({
          fullName: input.fullName,
          email: input.email,
          phone: input.phone || null,
          groupName: input.groupName?.trim() || "General",
          notes: input.notes || null,
        })
        .where(eq(clients.id, input.id));
      const rows = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
      return rows[0];
    }),

  setStatus: staffQuery
    .input(z.object({ id: z.number(), status: z.enum(["active", "unsubscribed"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(clients).set({ status: input.status }).where(eq(clients.id, input.id));
      return { success: true };
    }),

  delete: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(clients).where(eq(clients.id, input.id));
    return { success: true };
  }),

  /** Bulk CSV import — dedupes against existing emails and within the batch. */
  importCsv: staffQuery
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              fullName: z.string().trim().min(1).max(255),
              email: z.string().trim().toLowerCase().email().max(320),
              phone: z.string().trim().max(30).optional().or(z.literal("")),
              groupName: z.string().trim().max(100).optional().or(z.literal("")),
            }),
          )
          .min(1)
          .max(MAX_IMPORT),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Dedupe within the batch (first occurrence wins)
      const seen = new Set<string>();
      const batch = input.rows.filter((r) => {
        if (seen.has(r.email)) return false;
        seen.add(r.email);
        return true;
      });

      const emails = batch.map((r) => r.email);
      const existing: Array<{ email: string }> = [];
      for (let i = 0; i < emails.length; i += 500) {
        const chunk = emails.slice(i, i + 500);
        existing.push(
          ...(await db.select({ email: clients.email }).from(clients).where(inArray(clients.email, chunk))),
        );
      }
      const existingSet = new Set(existing.map((r) => r.email));
      const toInsert = batch.filter((r) => !existingSet.has(r.email));

      if (toInsert.length) {
        for (let i = 0; i < toInsert.length; i += 500) {
          await db.insert(clients).values(
            toInsert.slice(i, i + 500).map((r) => ({
              fullName: r.fullName,
              email: r.email,
              phone: r.phone || null,
              groupName: r.groupName?.trim() || "General",
              createdBy: ctx.unifiedUser?.id ?? null,
            })),
          );
        }
      }

      return {
        imported: toInsert.length,
        skipped: batch.length - toInsert.length,
        duplicatesInFile: input.rows.length - batch.length,
      };
    }),
});
