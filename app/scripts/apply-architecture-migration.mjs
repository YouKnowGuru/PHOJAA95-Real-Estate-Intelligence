import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "../db/migrations/0007_architecture_module.sql");

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const sql = fs.readFileSync(sqlPath, "utf8")
    .replace(/`id` serial AUTO_INCREMENT NOT NULL/g, "`id` bigint unsigned NOT NULL AUTO_INCREMENT")
    .replace(/DEFAULT \(now\(\)\)/g, "DEFAULT CURRENT_TIMESTAMP");

  const statements = sql
    .split(/;\s*\n/)
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);

  for (const statement of statements) {
    const preview = statement.slice(0, 80).replace(/\s+/g, " ");
    process.stdout.write(`Running: ${preview}...\n`);
    await conn.query(statement);
  }

  // Record migration if not already present
  const [existing] = await conn.query(
    "SELECT id FROM __drizzle_migrations WHERE hash = ? LIMIT 1",
    ["0007_architecture_module"]
  );
  if (existing.length === 0) {
    await conn.query(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      ["0007_architecture_module", Date.now()]
    );
  }

  // Fix users created with invalid architecture_staff role (stored as empty string)
  const [broken] = await conn.query(
    "SELECT id, email, full_name FROM local_users WHERE role = '' OR role IS NULL"
  );
  if (broken.length > 0) {
    console.log("\nFixing users with empty role -> architecture_staff:");
    for (const user of broken) {
      console.log(`  id=${user.id} email=${user.email}`);
      await conn.query(
        "UPDATE local_users SET role = 'architecture_staff' WHERE id = ?",
        [user.id]
      );
    }
  }

  const [cols] = await conn.query("SHOW COLUMNS FROM local_users LIKE 'role'");
  console.log("\nRole column:", cols[0]?.Type);

  const [arch] = await conn.query("SHOW TABLES LIKE 'architecture_%'");
  console.log("Architecture tables:", arch.length);

  const [users] = await conn.query(
    "SELECT id, email, role FROM local_users ORDER BY id"
  );
  console.log("\nUsers:", JSON.stringify(users, null, 2));
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}

console.log("\nArchitecture migration applied successfully.");
