import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
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
    "ALTER TABLE `software_customers` ADD COLUMN IF NOT EXISTS `created_by` bigint unsigned",
    "ALTER TABLE `software_customers` ADD INDEX IF NOT EXISTS `idx_software_customers_created_by` (`created_by`)",
  ];

  const tablePatches = [
    // Push notifications (salary reminders) — safe to re-run
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id int AUTO_INCREMENT PRIMARY KEY,
      user_id bigint unsigned NOT NULL,
      endpoint varchar(512) NOT NULL,
      p256dh varchar(255) NOT NULL,
      auth varchar(255) NOT NULL,
      user_agent varchar(255),
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_push_endpoint (endpoint),
      KEY idx_push_subs_user (user_id),
      CONSTRAINT fk_push_subs_user FOREIGN KEY (user_id) REFERENCES local_users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS salary_notice_log (
      id int AUTO_INCREMENT PRIMARY KEY,
      user_id bigint unsigned NOT NULL,
      month varchar(7) NOT NULL,
      push_sent boolean NOT NULL DEFAULT false,
      push_sent_at timestamp NULL,
      last_push_at timestamp NULL,
      seen_at timestamp NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_salary_notice_user (user_id),
      KEY idx_salary_notice_month (month),
      CONSTRAINT fk_salary_notice_user FOREIGN KEY (user_id) REFERENCES local_users(id) ON DELETE CASCADE
    )`,
    // Column patch for installs that already created the earlier table shape
    "ALTER TABLE `salary_notice_log` ADD COLUMN IF NOT EXISTS `last_push_at` timestamp NULL",
  ];

  for (const statement of tablePatches) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      logger.warn("Schema patch skipped", { statement: statement.slice(0, 60), error: String(err) });
    }
  }

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
  await backfillSoftwareCustomerOwners(db);
  await backfillPropertyApprovals(db);

  schemaReady = true;
  logger.info("Database schema patches applied");
}

async function backfillPropertyApprovals(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE properties 
      SET currentStep = 2, approvalStatus = 'approved', workflowStatus = 'processing' 
      WHERE currentStep = 1 AND approvalStatus IN ('submitted', 'pending_review');
    `);
    await db.execute(sql`
      UPDATE properties 
      SET currentStep = 3, approvalStatus = 'approved' 
      WHERE currentStep = 2 AND approvalStatus = 'pending_review';
    `);
    await db.execute(sql`
      UPDATE properties 
      SET currentStep = 4, approvalStatus = 'approved' 
      WHERE currentStep = 3 AND approvalStatus = 'pending_review';
    `);
    await db.execute(sql`
      UPDATE properties 
      SET currentStep = 5, approvalStatus = 'approved' 
      WHERE currentStep = 4 AND approvalStatus = 'pending_review';
    `);
    logger.info("Property approvals backfill completed");
  } catch (err) {
    logger.warn("Property approvals backfill skipped", { error: String(err) });
  }
}

async function backfillSoftwareCustomerOwners(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE software_customers sc
      INNER JOIN (
        SELECT sal.entity_id AS customer_id, sal.user_id
        FROM software_activity_logs sal
        INNER JOIN (
          SELECT entity_id, MIN(created_at) AS first_created
          FROM software_activity_logs
          WHERE entity_type = 'customer' AND action = 'customer_created'
          GROUP BY entity_id
        ) first ON first.entity_id = sal.entity_id AND first.first_created = sal.created_at
        WHERE sal.entity_type = 'customer' AND sal.action = 'customer_created'
      ) owners ON owners.customer_id = sc.id
      SET sc.created_by = owners.user_id
      WHERE sc.created_by IS NULL AND sc.deleted_at IS NULL
    `);

    await db.execute(sql`
      UPDATE software_customers sc
      INNER JOIN (
        SELECT customer_id, MIN(created_by) AS created_by
        FROM software_sales
        WHERE deleted_at IS NULL AND created_by IS NOT NULL
        GROUP BY customer_id
      ) ss ON ss.customer_id = sc.id
      SET sc.created_by = ss.created_by
      WHERE sc.created_by IS NULL AND sc.deleted_at IS NULL
    `);

    await db.execute(sql`
      UPDATE software_customers sc
      INNER JOIN (
        SELECT customer_id, MIN(created_by) AS created_by
        FROM software_projects
        WHERE deleted_at IS NULL AND created_by IS NOT NULL
        GROUP BY customer_id
      ) sp ON sp.customer_id = sc.id
      SET sc.created_by = sp.created_by
      WHERE sc.created_by IS NULL AND sc.deleted_at IS NULL
    `);

    logger.info("Software customer created_by backfill completed");
  } catch (err) {
    logger.warn("Software customer created_by backfill skipped", { error: String(err) });
  }
}

async function ensureDefaultAdminUser(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(localUsers);
    if (Number(rows[0]?.count ?? 0) > 0) return;

    // Generate a cryptographically secure random password
    const tempPassword = randomBytes(16).toString("hex");
    const password = await bcrypt.hash(tempPassword, 12);
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

    // Log to stderr (not logger) so it appears in server logs but not structured logging
    // eslint-disable-next-line no-console
    console.error(
      "\n" +
      "╔══════════════════════════════════════════════════════════════════╗\n" +
      "║  DEFAULT ADMIN USER CREATED                                      ║\n" +
      "║  Email: admin@phojaa95.com                                       ║\n" +
      "║  Password: " + tempPassword + "                    ║\n" +
      "╚══════════════════════════════════════════════════════════════════╝\n"
    );
  } catch (err) {
    logger.error("Could not ensure default admin user", { error: String(err) });
  }
}
