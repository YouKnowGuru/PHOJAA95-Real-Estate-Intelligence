import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, like, or, and } from "drizzle-orm";
import { createRouter, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { libraryDocuments, localUsers } from "@db/schema";
import { deleteFile } from "./services/upload";
import {
  ensureLibraryDocumentsTable,
  resolveUploaderLocalId,
  wrapLibraryDbError,
} from "./lib/document-library-db";

export const documentLibraryRouter = createRouter({
  list: staffQuery
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        await ensureLibraryDocumentsTable();
        const db = getDb();
        const search = input?.search?.trim();
        const category = input?.category?.trim();

        const conditions = [];
        if (search) {
          const pattern = `%${search}%`;
          conditions.push(
            or(
              like(libraryDocuments.title, pattern),
              like(libraryDocuments.fileName, pattern),
              like(libraryDocuments.description, pattern)
            )
          );
        }
        if (category && category !== "all") {
          conditions.push(eq(libraryDocuments.category, category));
        }

        const rows = await db
          .select({
            id: libraryDocuments.id,
            title: libraryDocuments.title,
            description: libraryDocuments.description,
            category: libraryDocuments.category,
            storageKey: libraryDocuments.storageKey,
            fileUrl: libraryDocuments.fileUrl,
            fileName: libraryDocuments.fileName,
            mimeType: libraryDocuments.mimeType,
            fileSize: libraryDocuments.fileSize,
            uploadedBy: libraryDocuments.uploadedBy,
            uploaderName: localUsers.fullName,
            createdAt: libraryDocuments.createdAt,
            updatedAt: libraryDocuments.updatedAt,
          })
          .from(libraryDocuments)
          .leftJoin(localUsers, eq(libraryDocuments.uploadedBy, localUsers.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(libraryDocuments.createdAt));

        return { items: rows };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        wrapLibraryDbError(err);
      }
    }),

  categories: staffQuery.query(async () => {
    try {
      await ensureLibraryDocumentsTable();
      const db = getDb();
      const rows = await db
        .selectDistinct({ category: libraryDocuments.category })
        .from(libraryDocuments)
        .orderBy(libraryDocuments.category);
      return rows.map((r) => r.category);
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      wrapLibraryDbError(err);
    }
  }),

  create: staffQuery
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        category: z.string().min(1).max(100).default("General"),
        storageKey: z.string().min(1).max(512),
        fileUrl: z.string().min(1),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(100),
        fileSize: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await ensureLibraryDocumentsTable();
        const db = getDb();
        const uploadedBy = await resolveUploaderLocalId(ctx);

        const result = await db.insert(libraryDocuments).values({
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          storageKey: input.storageKey,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          uploadedBy,
        });

        return {
          id: Number(result[0].insertId),
          ...input,
          uploadedBy,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        wrapLibraryDbError(err);
      }
    }),

  update: staffQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        category: z.string().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await ensureLibraryDocumentsTable();
        const { id, ...data } = input;
        const db = getDb();
        const localUserId = await resolveUploaderLocalId(ctx);
        const isAdmin = ctx.unifiedUser!.role === "admin";

        const existing = await db
          .select({ uploadedBy: libraryDocuments.uploadedBy })
          .from(libraryDocuments)
          .where(eq(libraryDocuments.id, id))
          .limit(1);

        if (existing.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }
        if (existing[0].uploadedBy !== localUserId && !isAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to edit this document" });
        }

        await db.update(libraryDocuments).set(data).where(eq(libraryDocuments.id, id));
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        wrapLibraryDbError(err);
      }
    }),

  delete: staffQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await ensureLibraryDocumentsTable();
        const db = getDb();
        const localUserId = await resolveUploaderLocalId(ctx);
        const isAdmin = ctx.unifiedUser!.role === "admin";

        const existing = await db
          .select()
          .from(libraryDocuments)
          .where(eq(libraryDocuments.id, input.id))
          .limit(1);

        if (existing.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }

        const doc = existing[0];
        if (doc.uploadedBy !== localUserId && !isAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to delete this document" });
        }

        await deleteFile(doc.storageKey);
        await db.delete(libraryDocuments).where(eq(libraryDocuments.id, input.id));
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        wrapLibraryDbError(err);
      }
    }),
});
