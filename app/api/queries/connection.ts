import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let pool: mysql.Pool | undefined;
let instance: ReturnType<typeof drizzle> | undefined;

function cleanDatabaseUrl(url: string): string {
  return url.replace(/[?&]ssl-mode=[^&]*/, "").replace(/\?&/, "?").replace(/\?$/, "");
}

export function getDb() {
  if (!instance) {
    const cleanUrl = cleanDatabaseUrl(env.databaseUrl);
    pool = mysql.createPool({
      uri: cleanUrl,
      connectionLimit: 20,
      queueLimit: 0,
      waitForConnections: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    instance = drizzle(pool, {
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    instance = undefined;
  }
}
