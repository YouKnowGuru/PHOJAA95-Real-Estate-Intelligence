import "dotenv/config";
import mysql from "mysql2/promise";

async function test(label, url) {
  console.log(`\n=== ${label} ===`);
  const host = (() => {
    try {
      return new URL(url.replace(/^mysql:/, "http:")).hostname;
    } catch {
      return "?";
    }
  })();
  console.log("Host:", host);

  let conn;
  try {
    conn = await mysql.createConnection(url);
    const [versionRows] = await conn.query("SELECT VERSION() AS v");
    console.log("Connected. MySQL version:", versionRows[0].v);

    const [tables] = await conn.query("SHOW TABLES LIKE 'local_users'");
    console.log("local_users table:", tables.length ? "EXISTS" : "MISSING");

    if (tables.length) {
      const [cols] = await conn.query("SHOW COLUMNS FROM local_users");
      console.log("Columns:", cols.map((c) => c.Field).join(", "));
      const [users] = await conn.query(
        "SELECT id, email, role, status FROM local_users LIMIT 5"
      );
      console.log("Sample users:", JSON.stringify(users, null, 2));
    }

    const [allTables] = await conn.query("SHOW TABLES");
    console.log("Total tables in database:", allTables.length);
    await conn.end();
    return true;
  } catch (err) {
    console.log("FAILED:", err.code ?? err.errno, err.message);
    if (conn) {
      try {
        await conn.end();
      } catch {
        /* ignore */
      }
    }
    return false;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const localhostUrl = url.replace(/@[^/]+/, "@localhost:3306");
const remoteOk = await test("DATABASE_URL (from .env)", url);
await test("localhost (Hostinger on-server)", localhostUrl);

process.exit(remoteOk ? 0 : 1);
