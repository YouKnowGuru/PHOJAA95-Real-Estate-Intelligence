import { z } from "zod";
import { eq, and, isNull, desc, like, or, sql } from "drizzle-orm";
import { createRouter, developerQuery, developerOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwareDocuments } from "@db/schema";
import { TRPCError } from "@trpc/server";
import { logActivity } from "./software-activity-helper";
import {
  assertUploadPath,
  isAdminRole,
  isDeveloperRole,
  pageInput,
} from "./lib/access-control";

/** Uploads are stored as app-relative paths (/uploads/...) or signed API paths (/api/file/...). */
const fileUrlSchema = z
  .string()
  .min(1)
  .refine(
    (val) =>
      val.startsWith("/uploads/") ||
      val.startsWith("/api/file/") ||
      /^https?:\/\//i.test(val),
    { message: "Invalid file URL" }
  );

export const softwareDocumentRouter = createRouter({
  list: developerQuery
    .input(z.object({
      ...pageInput,
      search: z.string().optional(),
      category: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const offset = (page - 1) * limit;

      const conditions = [isNull(softwareDocuments.deletedAt)];
      if (isDeveloperRole(ctx.unifiedUser!.role)) {
        conditions.push(eq(softwareDocuments.uploadedBy, ctx.unifiedUser!.id));
      }
      if (input?.search) {
        conditions.push(
          or(
            like(softwareDocuments.title, `%${input.search}%`),
            like(softwareDocuments.fileName, `%${input.search}%`)
          )!
        );
      }
      if (input?.category) {
        conditions.push(eq(softwareDocuments.category, input.category as any));
      }

      const items = await db
        .select({
          id: softwareDocuments.id,
          title: softwareDocuments.title,
          description: softwareDocuments.description,
          category: softwareDocuments.category,
          fileUrl: softwareDocuments.fileUrl,
          fileName: softwareDocuments.fileName,
          fileType: softwareDocuments.fileType,
          fileSize: softwareDocuments.fileSize,
          version: softwareDocuments.version,
          entityType: softwareDocuments.entityType,
          entityId: softwareDocuments.entityId,
          uploadedBy: softwareDocuments.uploadedBy,
          createdAt: sql<string>`DATE_FORMAT(${softwareDocuments.createdAt}, '%Y-%m-%d')`,
          updatedAt: sql<string>`DATE_FORMAT(${softwareDocuments.updatedAt}, '%Y-%m-%d')`,
        })
        .from(softwareDocuments)
        .where(and(...conditions))
        .orderBy(desc(softwareDocuments.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(softwareDocuments)
        .where(and(...conditions));

      return { items, total: count, page, limit };
    }),

  getById: developerQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const [doc] = await db
        .select()
        .from(softwareDocuments)
        .where(and(eq(softwareDocuments.id, input.id), isNull(softwareDocuments.deletedAt)))
        .limit(1);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      if (isDeveloperRole(ctx.unifiedUser!.role) && doc.uploadedBy !== ctx.unifiedUser!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return doc;
    }),

  create: developerOnlyQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().default("other"),
      fileUrl: fileUrlSchema,
      fileName: z.string().min(1),
      fileType: z.string().min(1),
      fileSize: z.number().min(0),
      version: z.string().default("1.0"),
      entityType: z.string().optional(),
      entityId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";

      if (!/^https?:\/\//i.test(input.fileUrl)) {
        assertUploadPath(input.fileUrl);
      }

      const [doc] = await db.insert(softwareDocuments).values({
        ...input,
        category: input.category as any,
        uploadedBy: userId,
      });

      const newId = Number(doc.insertId);

      await logActivity({
        userId,
        userName,
        action: "document_created",
        entityType: "document",
        entityId: newId,
        newValue: { title: input.title, category: input.category },
      });

      return { id: newId, success: true };
    }),

  update: developerOnlyQuery
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      version: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name || ctx.unifiedUser!.email || "Unknown";
      const { id, ...data } = input;

      const existing = await db
        .select()
        .from(softwareDocuments)
        .where(and(eq(softwareDocuments.id, id), isNull(softwareDocuments.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      if (!isAdminRole(ctx.unifiedUser!.role) && existing[0].uploadedBy !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await db.update(softwareDocuments).set({ ...data, category: data.category as any }).where(eq(softwareDocuments.id, id));

      await logActivity({
        userId,
        userName,
        action: "document_updated",
        entityType: "document",
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
        .from(softwareDocuments)
        .where(and(eq(softwareDocuments.id, input.id), isNull(softwareDocuments.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      if (!isAdminRole(ctx.unifiedUser!.role) && existing[0].uploadedBy !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await db
        .update(softwareDocuments)
        .set({ deletedAt: new Date() })
        .where(eq(softwareDocuments.id, input.id));

      await logActivity({
        userId,
        userName,
        action: "document_deleted",
        entityType: "document",
        entityId: input.id,
        previousValue: existing[0],
      });

      return { success: true };
    }),

  stats: developerQuery.query(async () => {
    const db = getDb();
    const cats = ["proposal", "quotation", "contract", "agreement", "requirements", "design", "screenshot", "apk", "executable", "zip", "source_code", "invoice", "certificate", "other"];
    const result: Record<string, number> = { total: 0 };
    for (const cat of cats) {
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(softwareDocuments)
        .where(and(eq(softwareDocuments.category, cat as any), isNull(softwareDocuments.deletedAt)));
      result[cat] = count;
      result.total += count;
    }
    return result;
  }),
});
