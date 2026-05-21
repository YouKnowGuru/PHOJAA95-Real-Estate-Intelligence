import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Robustly resolve the project's public/ directory.
 * Tries multiple candidate paths because bundled production executables
 * (esbuild → dist/boot.js) can live at different depths on Hostinger,
 * inside Docker containers, or behind PM2/Passenger.
 */
function resolvePublicDir(): string {
  const candidates = [
    path.resolve(__dirname, "..", "public"),
    path.resolve(__dirname, "..", "..", "public"),
    path.resolve(__dirname, "..", "app", "public"),
    path.resolve(__dirname, "..", "..", "app", "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "app", "public"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.info("Resolved public directory", {
        path: candidate,
        matchedFrom: candidates.indexOf(candidate),
        scriptDir: __dirname,
        cwd: process.cwd(),
      });
      return candidate;
    }
  }

  // Final fallback: create it next to the script (best-effort)
  const fallback = path.resolve(__dirname, "..", "public");
  logger.warn("Public directory not found in any candidate; creating fallback", {
    fallback,
    candidates,
    scriptDir: __dirname,
    cwd: process.cwd(),
  });
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
      logger.info("Resolved dist directory", {
        path: candidate,
        matchedFrom: candidates.indexOf(candidate),
      });
      return candidate;
    }
  }

  const fallback = path.resolve(__dirname, "..", "dist", "public");
  logger.warn("Dist directory not found in any candidate; using fallback", {
    fallback,
    candidates,
  });
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

export const PUBLIC_DIR = resolvePublicDir();
export const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
export const DIST_DIR = resolveDistDir();

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  logger.info("Created upload directory", { path: UPLOAD_DIR });
}
