import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "../queries/connection";
import { localUsers } from "@db/schema";
import { logger } from "./logger";

let schemaReady = false;

/** Apply Hostinger-safe patches when tables were created from an older/partial SQL import. */
export async function ensureSchemaPatches(): Promise<void> {
  if (schemaReady) return;

  const db = getDb();

  const columnPatches = [
    "ALTER TABLE `local_users` ADD COLUMN IF NOT EXISTS `pf_number` varchar(50)",
    "ALTER TABLE `local_users` ADD COLUMN IF NOT EXISTS `pf_percentage` decimal(5,2) NOT NULL DEFAULT 0",
    "ALTER TABLE `local_users` ADD COLUMN IF NOT EXISTS `employee_id` varchar(50)",
    "ALTER TABLE `attendance` ADD COLUMN IF NOT EXISTS `deduction_notes` text",
    "ALTER TABLE `payroll` ADD COLUMN IF NOT EXISTS `deduction_notes` text",
    "ALTER TABLE `properties` ADD COLUMN IF NOT EXISTS `features` json",
    "ALTER TABLE `property_documents` ADD COLUMN IF NOT EXISTS `remaining_payment_amount` decimal(15,2)",
  ];

  for (const statement of columnPatches) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      logger.warn("Schema patch skipped", { statement, error: String(err) });
    }
  }

  try {
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
  } catch (err) {
    logger.warn("library_documents table patch skipped", { error: String(err) });
  }

  await ensureDefaultAdminUser(db);

  schemaReady = true;
  logger.info("Database schema patches applied");
}

async function ensureDefaultAdminUser(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(localUsers);
    if (Number(rows[0]?.count ?? 0) > 0) return;

    const password = await bcrypt.hash("Admin123", 12);
    await db.insert(localUsers).values({
      fullName: "Admin User",
      email: "admin@phojaa95.com",
      password,
      role: "admin",
      phone: "+975-17123456",
      address: "Thimphu, Bhutan",
      status: "active",
      loginAttempts: 0,
    });

    logger.info("Default admin user created (admin@phojaa95.com / Admin123)");
  } catch (err) {
    logger.error("Could not ensure default admin user", { error: String(err) });
  }
}
