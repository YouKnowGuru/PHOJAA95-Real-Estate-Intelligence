import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./db/connection-url";

const connectionString = resolveDatabaseUrl();

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
