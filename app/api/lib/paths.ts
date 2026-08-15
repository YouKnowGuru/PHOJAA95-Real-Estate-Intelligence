import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Robustly resolve the project's public/ directory.
 */
function resolvePublicDir(): string {
  const candidates = [
    path.resolve(__dirname, "..", "..", "public"),
    path.resolve(__dirname, "..", "public"),
    path.resolve(__dirname, "..", "app", "public"),
    path.resolve(__dirname, "..", "..", "app", "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "app", "public"),
  ];

  // Prefer directories that contain actual public assets (not just an uploads subdir)
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && (fs.existsSync(path.join(candidate, "loader.png")) || fs.existsSync(path.join(candidate, "favicon.svg")) || fs.existsSync(path.join(candidate, "index.html")))) {
      logger.info("Resolved public directory", {
        path: candidate,
        matchedFrom: candidates.indexOf(candidate),
        scriptDir: __dirname,
        cwd: process.cwd(),
      });
      return candidate;
    }
  }

  // Fallback: any existing directory
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.info("Resolved public directory (fallback)", { path: candidate });
      return candidate;
    }
  }

  const fallback = path.resolve(__dirname, "..", "..", "public");
  logger.warn("Public directory not found; creating fallback", { fallback });
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

/**
 * Resolve the dist/public directory (Vite build output).
 */
function resolveDistDir(): string {
  const candidates = [
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(__dirname, "..", "..", "dist", "public"),
    path.resolve(__dirname, "..", "app", "dist", "public"),
    path.resolve(__dirname, "..", "..", "app", "dist", "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "app", "dist", "public"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.info("Resolved dist directory", { path: candidate, matchedFrom: candidates.indexOf(candidate) });
      return candidate;
    }
  }

  const fallback = path.resolve(__dirname, "..", "dist", "public");
  logger.warn("Dist directory not found; using fallback", { fallback });
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

/**
 * Find a persistent upload directory OUTSIDE or INSIDE the project.
 * Automatically resolves Hostinger domain root (/home/.../domains/<domain>/uploads)
 * which sits permanently above versioned builds (hbuilds/versions/...).
 */
function resolveUploadDir(): string {
  // Domain home directory (e.g. /home/u880151399/domains/phojaarealestatemanagement.com)
  const homeDir = process.env.HOME || "";
  const domainHomeUploads = homeDir ? path.resolve(homeDir, "uploads") : null;

  // Deep traversal from Hostinger hbuilds/versions/<id>/nodejs/app/dist/
  const hostingerHbuildsUploads = path.resolve(process.cwd(), "..", "..", "..", "uploads");
  const hostingerDistUploads = path.resolve(__dirname, "..", "..", "..", "..", "..", "uploads");

  // Standard domain level (3 levels up from root or 2 levels up from cwd)
  const domainLevel = path.resolve(__dirname, "..", "..", "..", "uploads");
  const homeLevel = path.resolve(process.cwd(), "..", "..", "uploads");
  const cwdParentUploads = path.resolve(process.cwd(), "..", "uploads");

  // Inside public/ folder (dev fallback)
  const publicLevel = path.resolve(PUBLIC_DIR, "uploads");
  const cwdLevel = path.resolve(process.cwd(), "uploads");

  // Check persistent candidates first
  const persistentCandidates = [
    domainHomeUploads,
    hostingerHbuildsUploads,
    hostingerDistUploads,
    domainLevel,
    homeLevel,
    cwdParentUploads,
  ].filter((p): p is string => Boolean(p));

  // If explicit environment variable override is provided and NOT /tmp/uploads, use it
  if (process.env.UPLOAD_DIR && process.env.UPLOAD_DIR !== "/tmp/uploads") {
    const custom = path.resolve(process.env.UPLOAD_DIR);
    try {
      if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true });
      logger.info("Using explicit UPLOAD_DIR from environment", { path: custom });
      return custom;
    } catch (err) {
      logger.warn("Could not create custom UPLOAD_DIR from env", { custom, error: String(err) });
    }
  }

  // In production (Hostinger), find or create the persistent domain-level uploads folder
  for (const candidate of persistentCandidates) {
    if (fs.existsSync(candidate)) {
      logger.info("Resolved persistent domain upload directory", { path: candidate });
      return candidate;
    }
  }

  // If a persistent candidate can be created outside the build dir, create it
  if (process.env.NODE_ENV === "production") {
    const preferred = domainHomeUploads || hostingerHbuildsUploads || domainLevel;
    try {
      fs.mkdirSync(preferred, { recursive: true });
      logger.info("Created persistent domain upload directory", { path: preferred });
      return preferred;
    } catch (err) {
      logger.warn("Could not create preferred domain upload dir", { preferred, error: String(err) });
    }
  }

  // Check cwd or publicLevel
  for (const candidate of [publicLevel, cwdLevel]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Final fallback
  try {
    fs.mkdirSync(publicLevel, { recursive: true });
  } catch {}
  return publicLevel;
}

export const PUBLIC_DIR = resolvePublicDir();
export const DIST_DIR = resolveDistDir();
export const UPLOAD_DIR = resolveUploadDir();

/**
 * Returns all potential upload directories to check when resolving files.
 * Searches domain root, hbuilds parent levels, public_html, and local public folders.
 */
export function getUploadSearchDirs(): string[] {
  const homeDir = process.env.HOME || "";

  const dirs = [
    UPLOAD_DIR,
    homeDir ? path.resolve(homeDir, "uploads") : null,
    path.resolve(process.cwd(), "..", "..", "..", "uploads"),
    path.resolve(__dirname, "..", "..", "..", "..", "..", "uploads"),
    path.resolve(process.cwd(), "..", "..", "uploads"),
    path.resolve(process.cwd(), "..", "uploads"),
    path.resolve(__dirname, "..", "..", "..", "uploads"),
    path.resolve(PUBLIC_DIR, "uploads"),
    path.resolve(DIST_DIR, "uploads"),
    path.resolve(process.cwd(), "public", "uploads"),
    path.resolve(process.cwd(), "app", "public", "uploads"),
    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "app", "uploads"),
    process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : null,
  ].filter((d): d is string => !!d);

  // Return unique directories that exist on disk
  const seen = new Set<string>();
  const validDirs: string[] = [];
  for (const d of dirs) {
    const resolved = path.resolve(d);
    if (!seen.has(resolved) && fs.existsSync(resolved)) {
      seen.add(resolved);
      validDirs.push(resolved);
    }
  }

  // Always include UPLOAD_DIR even if newly created
  if (!seen.has(path.resolve(UPLOAD_DIR))) {
    validDirs.unshift(path.resolve(UPLOAD_DIR));
  }

  return validDirs;
}

logger.info("Path resolution complete", {
  publicDir: PUBLIC_DIR,
  distDir: DIST_DIR,
  uploadDir: UPLOAD_DIR,
  uploadSearchDirs: getUploadSearchDirs(),
  env: process.env.NODE_ENV,
});


