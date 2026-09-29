import { z } from "zod";
import { eq, like, desc, count, and, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, developerQuery, developerOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwareCustomers } from "@db/schema";
import { logActivity } from "./software-activity-helper";
import {
  isDeveloperRole,
  pageInput,
  softwareCustomerVisibleToDeveloper,
  assertSoftwareDeveloperCustomerAccess,
} from "./lib/access-control";

function generateCustomerId(): string {
  const prefix = "CUST";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export const softwareCustomerRouter = createRouter({
  list: developerQuery
    .input(
      z.object({
        search: z.string().optional(),
        ...pageInput,
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(softwareCustomers.deletedAt)];

      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(softwareCustomerVisibleToDeveloper(ctx.unifiedUser!.id));
      }

      if (input.search) {
        conditions.push(
          or(
            like(softwareCustomers.fullName, `%${input.search}%`),
            like(softwareCustomers.email, `%${input.search}%`),
            like(softwareCustomers.phone, `%${input.search}%`),
            like(softwareCustomers.companyName, `%${input.search}%`)
          ) as any
        );
      }

      const whereClause = and(...conditions);
      const totalResult = await db.select({ count: count() }).from(softwareCustomers).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select()
        .from(softwareCustomers)
        .where(whereClause)
        .orderBy(desc(softwareCustomers.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const customer = await db
        .select()
        .from(softwareCustomers)
        .where(and(eq(softwareCustomers.id, input.id), isNull(softwareCustomers.deletedAt)))
        .limit(1);

      if (customer.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      await assertSoftwareDeveloperCustomerAccess(db, input.id, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return customer[0];
    }),

  create: developerOnlyQuery
    .input(
      z.object({
        fullName: z.string().min(2).max(255),
        companyName: z.string().optional(),
        contactPerson: z.string().optional(),
        phone: z.string().min(5).max(20),
        alternatePhone: z.string().max(20).optional(),
        email: z.string().email(),
        country: z.string().optional(),
        state: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        postalCode: z.string().optional(),
        taxNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const duplicate = await db
        .select()
        .from(softwareCustomers)
        .where(
          and(
            isNull(softwareCustomers.deletedAt),
            or(eq(softwareCustomers.email, input.email), eq(softwareCustomers.phone, input.phone))
          )
        )
        .limit(1);

      if (duplicate.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Customer with this email or phone already exists" });
      }

      const customerId = generateCustomerId();
      const result = await db.insert(softwareCustomers).values({
        ...input,
        customerId,
        createdBy: userId,
      });

      const newId = Number(result[0].insertId);

      await logActivity({
        userId,
        userName,
        action: "customer_created",
        entityType: "customer",
        entityId: newId,
        newValue: { fullName: input.fullName, email: input.email, phone: input.phone },
      });

      return { id: newId, customerId };
    }),

  update: developerOnlyQuery
    .input(
      z.object({
        id: z.number(),
        fullName: z.string().min(2).max(255).optional(),
        companyName: z.string().optional(),
        contactPerson: z.string().optional(),
        phone: z.string().min(5).max(20).optional(),
        alternatePhone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        country: z.string().optional(),
        state: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        postalCode: z.string().optional(),
        taxNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      const existing = await db
        .select()
        .from(softwareCustomers)
        .where(and(eq(softwareCustomers.id, id), isNull(softwareCustomers.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      await assertSoftwareDeveloperCustomerAccess(db, input.id, userId, ctx.unifiedUser!.role);

      if (data.email || data.phone) {
        const dupConditions = [isNull(softwareCustomers.deletedAt)];
        if (data.email) dupConditions.push(eq(softwareCustomers.email, data.email));
        if (data.phone) dupConditions.push(eq(softwareCustomers.phone, data.phone));

        const duplicate = await db
          .select()
          .from(softwareCustomers)
          .where(and(...dupConditions))
          .limit(1);

        if (duplicate.length > 0 && duplicate[0].id !== id) {
          throw new TRPCError({ code: "CONFLICT", message: "Email or phone already in use" });
        }
      }

      await db.update(softwareCustomers).set(data).where(eq(softwareCustomers.id, id));

      await logActivity({
        userId,
        userName,
        action: "customer_updated",
        entityType: "customer",
        entityId: id,
        previousValue: existing[0],
        newValue: data,
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
        .from(softwareCustomers)
        .where(and(eq(softwareCustomers.id, input.id), isNull(softwareCustomers.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      await assertSoftwareDeveloperCustomerAccess(db, input.id, userId, ctx.unifiedUser!.role);

      await db.update(softwareCustomers).set({ deletedAt: new Date() }).where(eq(softwareCustomers.id, input.id));

      await logActivity({
        userId,
        userName,
        action: "customer_deleted",
        entityType: "customer",
        entityId: input.id,
        previousValue: existing[0],
      });

      return { success: true };
    }),
});
