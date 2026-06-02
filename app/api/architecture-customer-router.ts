import { z } from "zod";
import { eq, like, desc, count, and, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, architectureStaffQuery, architectureStaffOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { architectureCustomers } from "@db/schema";
import { logArchitectureActivity, generateArchitectureCode, generatePortalToken } from "./architecture-activity-helper";
import {
  actorDisplayName,
  assertArchitectureStaffRecord,
  isAdminRole,
  isArchitectureStaffRole,
  pageInput,
} from "./lib/access-control";

const customerPublicColumns = {
  id: architectureCustomers.id,
  customerId: architectureCustomers.customerId,
  fullName: architectureCustomers.fullName,
  email: architectureCustomers.email,
  phone: architectureCustomers.phone,
  alternatePhone: architectureCustomers.alternatePhone,
  country: architectureCustomers.country,
  state: architectureCustomers.state,
  city: architectureCustomers.city,
  address: architectureCustomers.address,
  postalCode: architectureCustomers.postalCode,
  mapLocation: architectureCustomers.mapLocation,
  notes: architectureCustomers.notes,
  createdBy: architectureCustomers.createdBy,
  createdAt: architectureCustomers.createdAt,
  updatedAt: architectureCustomers.updatedAt,
};

export const architectureCustomerRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({
      search: z.string().optional(),
      ...pageInput,
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(architectureCustomers.deletedAt)];

      if (isArchitectureStaffRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(architectureCustomers.createdBy, ctx.unifiedUser!.id));
      }

      if (input.search) {
        conditions.push(or(
          like(architectureCustomers.fullName, `%${input.search}%`),
          like(architectureCustomers.email, `%${input.search}%`),
          like(architectureCustomers.phone, `%${input.search}%`),
          like(architectureCustomers.customerId, `%${input.search}%`)
        ) as any);
      }

      const whereClause = and(...conditions);
      const totalResult = await db.select({ count: count() }).from(architectureCustomers).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select(customerPublicColumns)
        .from(architectureCustomers)
        .where(whereClause)
        .orderBy(desc(architectureCustomers.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const customer = await db
        .select(customerPublicColumns)
        .from(architectureCustomers)
        .where(and(eq(architectureCustomers.id, input.id), isNull(architectureCustomers.deletedAt)))
        .limit(1);

      if (customer.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      assertArchitectureStaffRecord(customer[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);
      return customer[0];
    }),

  create: architectureStaffOnlyQuery
    .input(z.object({
      fullName: z.string().min(2).max(255),
      email: z.string().email(),
      phone: z.string().min(5).max(20),
      alternatePhone: z.string().optional(),
      country: z.string().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      mapLocation: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const customerId = generateArchitectureCode("ACUST");
      const portalToken = generatePortalToken();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const result = await db.insert(architectureCustomers).values({
        ...input,
        customerId,
        portalToken,
        portalTokenExpiresAt: expiresAt,
        createdBy: userId,
      });

      const id = Number(result[0].insertId);

      await logArchitectureActivity({
        userId,
        userName,
        action: "customer_created",
        entityType: "customer",
        entityId: id,
        newValue: { fullName: input.fullName, email: input.email },
      });

      return { id, customerId, portalToken };
    }),

  update: architectureStaffOnlyQuery
    .input(z.object({
      id: z.number(),
      fullName: z.string().min(2).max(255).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(5).max(20).optional(),
      alternatePhone: z.string().optional(),
      country: z.string().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      mapLocation: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const db = getDb();

      const existing = await db
        .select()
        .from(architectureCustomers)
        .where(and(eq(architectureCustomers.id, id), isNull(architectureCustomers.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      assertArchitectureStaffRecord(existing[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);

      await db.update(architectureCustomers).set(data).where(eq(architectureCustomers.id, id));
      return { success: true };
    }),

  regeneratePortalToken: architectureStaffOnlyQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db
        .select({ id: architectureCustomers.id, createdBy: architectureCustomers.createdBy })
        .from(architectureCustomers)
        .where(and(eq(architectureCustomers.id, input.id), isNull(architectureCustomers.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      assertArchitectureStaffRecord(existing[0].createdBy, ctx.unifiedUser!.id, ctx.unifiedUser!.role);

      const portalToken = generatePortalToken();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await db
        .update(architectureCustomers)
        .set({ portalToken, portalTokenExpiresAt: expiresAt })
        .where(eq(architectureCustomers.id, input.id));

      return { portalToken };
    }),

  delete: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const role = ctx.unifiedUser!.role;

      const existing = await db
        .select()
        .from(architectureCustomers)
        .where(and(eq(architectureCustomers.id, input.id), isNull(architectureCustomers.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      if (!isAdminRole(role)) {
        if (existing[0].createdBy == null || existing[0].createdBy !== userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }

      await db.update(architectureCustomers).set({ deletedAt: new Date() }).where(eq(architectureCustomers.id, input.id));
      return { success: true };
    }),
});
