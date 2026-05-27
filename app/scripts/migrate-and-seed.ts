import "dotenv/config";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../db/migrations");

async function runMigrations(conn: mysql.Connection) {
  // Ensure migrations table exists
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get already applied migrations
  const [appliedRows] = await conn.execute<any[]>(
    `SELECT hash FROM __drizzle_migrations`
  );
  const appliedHashes = new Set(appliedRows.map((r) => r.hash));

  // Read SQL migration files
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const hash = file.replace(".sql", "");
    if (appliedHashes.has(hash)) {
      console.log(`Skipping already applied: ${file}`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sqlContent = fs.readFileSync(filePath, "utf-8");

    // Split by statement-breakpoint
    const statements = sqlContent
      .split(/-->\s*statement-breakpoint/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Applying ${file} (${statements.length} statements)...`);

    for (let stmt of statements) {
      // Fix invalid 'serial AUTO_INCREMENT' syntax for MariaDB compatibility
      stmt = stmt.replace(/\bserial\s+AUTO_INCREMENT\s+NOT\s+NULL\b/gi, "bigint unsigned AUTO_INCREMENT NOT NULL");

      // Skip comment-only statements
      const cleaned = stmt
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (!cleaned) continue;

      try {
        await conn.execute(stmt);
      } catch (err: any) {
        // Ignore "already exists" errors for CREATE TABLE IF NOT EXISTS
        if (
          err.code === "ER_TABLE_EXISTS_ERROR" ||
          err.message?.includes("Duplicate") ||
          err.message?.includes("already exists")
        ) {
          console.log(`  (skipped: ${err.message})`);
          continue;
        }
        // Ignore "duplicate column" errors for ALTER TABLE ADD
        if (
          err.code === "ER_DUP_FIELDNAME" ||
          err.message?.includes("Duplicate column")
        ) {
          console.log(`  (skipped: ${err.message})`);
          continue;
        }
        // Ignore drop foreign key if it doesn't exist
        if (
          err.code === "ER_CANT_DROP_FIELD_OR_KEY" ||
          stmt.toLowerCase().includes("drop foreign key")
        ) {
          console.log(`  (skipped: ${err.message})`);
          continue;
        }
        throw err;
      }
    }

    await conn.execute(
      `INSERT INTO __drizzle_migrations (hash) VALUES (?)`,
      [hash]
    );
    console.log(`Applied ${file}`);
  }

  console.log("All migrations applied!");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  console.log("Connecting to database...");
  const conn = await mysql.createConnection(url);
  console.log("Connected!");

  await runMigrations(conn);
  await conn.end();

  console.log("\nRunning seed script...");
  // Import and run seed
  const { spawn } = await import("child_process");
  const seedProcess = spawn("npx", ["tsx", "db/seed.ts"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  });

  await new Promise<void>((resolve, reject) => {
    seedProcess.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Seed exited with code ${code}`));
    });
  });

  console.log("Done!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
