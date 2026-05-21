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
 * Find a persistent upload directory OUTSIDE the git-managed project.
 * On Hostinger, this resolves to the domain root (e.g. .../domains/site.com/uploads/)
 * which survives git pulls and rebuilds.
 */
function resolveUploadDir(): string {
  // Candidate 1: Domain-level uploads folder (Hostinger-safe)
  // __dirname is typically .../nodejs/app/dist/  → 3 levels up = domain root
  const domainLevel = path.resolve(__dirname, "..", "..", "..", "uploads");

  // Candidate 2: Home-level uploads folder
  const homeLevel = path.resolve(process.cwd(), "..", "..", "uploads");

  // Candidate 3: Inside public/ (dev default)
  const publicLevel = path.resolve(PUBLIC_DIR, "uploads");

  const candidates = [domainLevel, homeLevel];

  // In production, prefer domain-level or home-level (outside git)
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.info("Resolved persistent upload directory", { path: candidate });
      return candidate;
    }
  }

  // In production, create domain-level directory so it persists
  if (process.env.NODE_ENV === "production") {
    logger.info("Creating persistent upload directory", { path: domainLevel });
    fs.mkdirSync(domainLevel, { recursive: true });
    return domainLevel;
  }

  // Dev fallback: inside public/
  if (!fs.existsSync(publicLevel)) {
    fs.mkdirSync(publicLevel, { recursive: true });
  }
  return publicLevel;
}

export const PUBLIC_DIR = resolvePublicDir();
export const DIST_DIR = resolveDistDir();
export const UPLOAD_DIR = resolveUploadDir();

logger.info("Path resolution complete", {
  publicDir: PUBLIC_DIR,
  distDir: DIST_DIR,
  uploadDir: UPLOAD_DIR,
  env: process.env.NODE_ENV,
});
