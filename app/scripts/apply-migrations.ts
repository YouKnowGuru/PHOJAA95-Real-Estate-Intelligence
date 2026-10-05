/**
 * Applies pending SQL migrations from db/migrations without seeding.
 *
 * Why this exists: `drizzle-kit migrate` cannot run on this database —
 * drizzle-kit generates `serial AUTO_INCREMENT NOT NULL` DDL for `serial()`
 * primary keys, which this MariaDB server rejects (existing tables use
 * `bigint unsigned AUTO_INCREMENT`). `scripts/migrate-and-seed.ts` fixes the
 * syntax too, but always runs the seed script afterwards. This runner is the
 * seed-free variant and records both conventions in `__drizzle_migrations`:
 *   - hash      = file name (what migrate-and-seed.ts checks)
 *   - created_at = journal `when` (what drizzle-kit migrate checks)
 *
 * Run: npx tsx scripts/apply-migrations.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../db/migrations");

interface JournalEntry {
  tag: string;
  when: number;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const journal: JournalEntry[] = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf-8"),
  ).entries;
  const whenByTag = new Map(journal.map((e) => [e.tag, e.when]));

  const conn = await mysql.createConnection(url);
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash VARCHAR(255) NOT NULL UNIQUE,
        created_at BIGINT
      )
    `);

    const [appliedRows] = await conn.execute<any[]>("SELECT hash FROM __drizzle_migrations");
    const applied = new Set(appliedRows.map((r) => r.hash));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      const tag = file.replace(".sql", "");
      if (applied.has(tag)) {
        console.log(`Skipping already applied: ${file}`);
        continue;
      }

      const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      const statements = sqlContent
        .split(/-->\s*statement-breakpoint/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(`Applying ${file} (${statements.length} statements)...`);

      for (let stmt of statements) {
        // Fix invalid 'serial AUTO_INCREMENT' syntax (MariaDB/MySQL reject it)
        stmt = stmt.replace(/\bserial\s+AUTO_INCREMENT\s+NOT\s+NULL\b/gi, "bigint unsigned AUTO_INCREMENT NOT NULL");

        const cleaned = stmt
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim();
        if (!cleaned) continue;

        try {
          await conn.execute(stmt);
        } catch (err: any) {
          const msg = err.message ?? "";
          if (
            err.code === "ER_TABLE_EXISTS_ERROR" ||
            err.code === "ER_DUP_FIELDNAME" ||
            err.code === "ER_CANT_DROP_FIELD_OR_KEY" ||
            msg.includes("Duplicate") ||
            msg.includes("already exists")
          ) {
            console.log(`  (skipped: ${msg})`);
            continue;
          }
          throw err;
        }
      }

      const when = whenByTag.get(tag) ?? null;
      await conn.execute("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [tag, when]);
      console.log(`Applied ${file}${when ? ` (recorded when=${when})` : ""}`);
      appliedCount++;
    }

    console.log(appliedCount ? `Done: ${appliedCount} migration(s) applied.` : "No pending migrations.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
