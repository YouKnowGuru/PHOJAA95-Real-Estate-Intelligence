/** Shared MySQL URL resolver for drizzle-kit, seed, and setup scripts. */
export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;
  if (user && password && database) {
    const host = process.env.MYSQL_HOST ?? "localhost";
    const port = process.env.MYSQL_PORT ?? "3306";
    return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  throw new Error(
    "Missing database config: set DATABASE_URL or MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE"
  );
}
