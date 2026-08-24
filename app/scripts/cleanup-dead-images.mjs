/**
 * cleanup-dead-images.mjs
 *
 * Finds and removes property_images rows whose Cloudinary URLs return 404
 * (i.e., the Cloudinary asset was permanently deleted due to the now-fixed bug).
 *
 * Usage:
 *   node scripts/cleanup-dead-images.mjs           <- dry run (shows what WOULD be deleted)
 *   node scripts/cleanup-dead-images.mjs --delete  <- actually deletes the dead rows
 */

import mysql from "mysql2/promise";

const DRY_RUN = !process.argv.includes("--delete");

const DB = {
  host: "82.197.82.197",
  port: 3306,
  user: "u880151399_PhojaaSystem",
  password: "Password@2026phojaa",
  database: "u880151399_PhojaaSystem",
};

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return res.ok ? "ok" : res.status;
  } catch {
    return "ERR";
  }
}

async function main() {
  console.log(`\n Cloudinary dead-image cleanup  [${DRY_RUN ? "DRY RUN -- no changes" : "LIVE DELETE MODE"}]\n`);

  const conn = await mysql.createConnection(DB);
  console.log("Connected to MySQL\n");

  // Fetch all rows
  const [rows] = await conn.query(
    "SELECT id, property_id, url, public_id FROM property_images ORDER BY id"
  );
  console.log(`Total property_images rows: ${rows.length}`);

  // Check all URLs in parallel (batches of 20 to avoid flooding)
  const BATCH = 20;
  const results = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const statuses = await Promise.all(batch.map((r) => checkUrl(r.url)));
    batch.forEach((r, j) => results.push({ ...r, status: statuses[j] }));
    process.stdout.write(`  checked ${Math.min(i + BATCH, rows.length)}/${rows.length}...\r`);
  }
  console.log("\n");

  const alive = results.filter((r) => r.status === "ok");
  const dead  = results.filter((r) => r.status !== "ok");

  console.log(`ALIVE (Cloudinary URL reachable): ${alive.length}`);
  console.log(`DEAD  (404/error -- asset gone):  ${dead.length}\n`);

  if (dead.length === 0) {
    console.log("No dead rows found. Database is clean!\n");
    await conn.end();
    return;
  }

  console.log("Dead rows to be removed:");
  console.log("-".repeat(80));
  dead.forEach((r) =>
    console.log(`  id=${r.id}  property_id=${r.property_id}  status=${r.status}\n  url=${r.url}\n`)
  );
  console.log("-".repeat(80));

  if (DRY_RUN) {
    console.log(`\nDRY RUN: ${dead.length} rows would be deleted.`);
    console.log(`Re-run with --delete flag to actually remove them:\n`);
    console.log(`  node scripts/cleanup-dead-images.mjs --delete\n`);
  } else {
    const deadIds = dead.map((r) => r.id);
    const [result] = await conn.query(
      `DELETE FROM property_images WHERE id IN (${deadIds.map(() => "?").join(",")})`,
      deadIds
    );
    console.log(`\nDeleted ${result.affectedRows} dead rows from property_images.\n`);
    console.log("Database is now clean. Broken images will no longer appear on any device.\n");
  }

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
