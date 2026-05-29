import type { CookieOptions } from "hono/utils/cookie";

function isLocalhost(headers: Headers): boolean {
  const host = headers.get("host") || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const localhost = isLocalhost(headers);

  // Security: Enforce secure cookies in production. In development (localhost),
  // allow non-secure cookies since HTTPS is typically not available.
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    path: "/",
    // Security fix: Always use Lax for CSRF protection. Only use None if explicitly
    // required for cross-origin embedding (not the case for this app).
    sameSite: "Lax",
    secure: isProduction || !localhost, // Always secure in production
  };
}
