import { sql, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import { localUsers } from "@db/schema";
import type { TrpcContext } from "../context";
import { logger } from "./logger";

let tableReady = false;

/** Create library_documents on first use if migration was not run on the server. */
export async function ensureLibraryDocumentsTable(): Promise<void> {
  if (tableReady) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS library_documents (
      id int AUTO_INCREMENT PRIMARY KEY,
      title varchar(255) NOT NULL,
      description text,
      category varchar(100) NOT NULL DEFAULT 'General',
      storage_key varchar(512) NOT NULL,
      file_url text NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      file_size int NOT NULL,
      uploaded_by bigint unsigned NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_library_docs_category (category),
      INDEX idx_library_docs_uploaded_by (uploaded_by),
      INDEX idx_library_docs_created (created_at)
    )
  `);
  try {
    await db.execute(
      sql`ALTER TABLE library_documents DROP FOREIGN KEY library_documents_uploaded_by_local_users_id_fk`
    );
    logger.info("Removed library_documents foreign key constraint");
  } catch {
    // Constraint absent or already removed
  }

  tableReady = true;
  logger.info("library_documents table ensured");
}

/** Map signed-in user to a local_users.id (required for uploaded_by). */
export async function resolveUploaderLocalId(ctx: TrpcContext): Promise<number> {
  const user = ctx.unifiedUser;
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const db = getDb();

  if (user.authType === "local") {
    const row = await db
      .select({ id: localUsers.id })
      .from(localUsers)
      .where(eq(localUsers.id, user.id))
      .limit(1);
    if (row.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your staff account was not found. Please contact an administrator.",
      });
    }
    return row[0].id;
  }

  if (user.email) {
    const row = await db
      .select({ id: localUsers.id })
      .from(localUsers)
      .where(eq(localUsers.email, user.email))
      .limit(1);
    if (row.length > 0) return row[0].id;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Document library requires a staff login (email/password). OAuth-only accounts cannot save documents yet.",
  });
}

export function wrapLibraryDbError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("library_documents") && (message.includes("doesn't exist") || message.includes("does not exist"))) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Document library table is missing. Restart the app after deploy, or run db/migrations/0003_library_documents.sql on your database.",
    });
  }
  if (message.includes("foreign key") || message.includes("FOREIGN KEY")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not link document to your staff account. Sign in with your staff email/password, not OAuth.",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not save document: ${message}`,
  });
}
