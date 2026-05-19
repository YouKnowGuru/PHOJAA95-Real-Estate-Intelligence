import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { propertyTypes } from "./db/schema.ts";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);
const types = await db.select().from(propertyTypes);
for (const t of types) {
  console.log(t.name, "-> requiresBuildingDocs:", t.requiresBuildingDocs);
}
await conn.end();
