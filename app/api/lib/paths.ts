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
 * Supports explicit UPLOAD_DIR environment variable for Hostinger/cPanel setups.
 */
function resolveUploadDir(): string {
  // Candidate 0: Explicit environment variable override
  if (process.env.UPLOAD_DIR) {
    const custom = path.resolve(process.env.UPLOAD_DIR);
    if (!fs.existsSync(custom)) {
      try {
        fs.mkdirSync(custom, { recursive: true });
      } catch (err) {
        logger.warn("Could not create custom UPLOAD_DIR from env", { custom, error: String(err) });
      }
    }
    logger.info("Using explicit UPLOAD_DIR from environment", { path: custom });
    return custom;
  }

  // Candidate 1: Inside public/ folder (closest to web assets)
  const publicLevel = path.resolve(PUBLIC_DIR, "uploads");

  // Candidate 2: Domain-level uploads folder (Hostinger-safe outside git)
  const domainLevel = path.resolve(__dirname, "..", "..", "..", "uploads");

  // Candidate 3: Home-level uploads folder
  const homeLevel = path.resolve(process.cwd(), "..", "..", "uploads");

  // Candidate 4: Direct cwd/uploads
  const cwdLevel = path.resolve(process.cwd(), "uploads");

  const candidates = [publicLevel, cwdLevel, domainLevel, homeLevel];

  // Return first existing upload directory that has contents or exists
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.info("Resolved persistent upload directory", { path: candidate });
      return candidate;
    }
  }

  // In production, create publicLevel or domainLevel
  const fallback = process.env.NODE_ENV === "production" ? domainLevel : publicLevel;
  try {
    fs.mkdirSync(fallback, { recursive: true });
    logger.info("Created upload directory", { path: fallback });
  } catch (err) {
    logger.warn("Failed to create primary upload directory, falling back to publicLevel", { fallback, error: String(err) });
    fs.mkdirSync(publicLevel, { recursive: true });
    return publicLevel;
  }
  return fallback;
}

export const PUBLIC_DIR = resolvePublicDir();
export const DIST_DIR = resolveDistDir();
export const UPLOAD_DIR = resolveUploadDir();

/**
 * Returns all potential upload directories to check when resolving files.
 * This guarantees backwards and cross-environment compatibility on Hostinger
 * where files might reside in domain root, public_html/uploads, or dist/public/uploads.
 */
export function getUploadSearchDirs(): string[] {
  const dirs = [
    UPLOAD_DIR,
    process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : null,
    path.resolve(PUBLIC_DIR, "uploads"),
    path.resolve(DIST_DIR, "uploads"),
    path.resolve(process.cwd(), "public", "uploads"),
    path.resolve(process.cwd(), "app", "public", "uploads"),
    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "app", "uploads"),
    path.resolve(__dirname, "uploads"),
    path.resolve(__dirname, "..", "uploads"),
    path.resolve(__dirname, "..", "public", "uploads"),
    path.resolve(__dirname, "..", "..", "uploads"),
    path.resolve(__dirname, "..", "..", "public", "uploads"),
    path.resolve(__dirname, "..", "..", "..", "uploads"),
    path.resolve(process.cwd(), "..", "uploads"),
    path.resolve(process.cwd(), "..", "..", "uploads"),
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

  // Always include UPLOAD_DIR even if empty
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

