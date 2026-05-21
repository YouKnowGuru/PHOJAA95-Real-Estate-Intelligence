export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

/** Default login / site footer line (Settings → Site Tagline). */
export const DEFAULT_SITE_TAGLINE =
  "© 2027 PHOJAA95 Ecosystem. Powered by Advanced Real Estate Intelligence.";
