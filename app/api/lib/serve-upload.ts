import type { Context, Next } from "hono";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import * as cookie from "cookie";
import { UPLOAD_DIR, getUploadSearchDirs } from "./paths";
import { logger } from "./logger";
import { verifyLocalToken } from "../local-auth-router";
import { verifySessionToken } from "../kimi/session";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".dwg": "application/acad",
  ".dxf": "application/dxf",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
};

type ResolveResult =
  | { ok: true; filePath: string }
  | { ok: false; reason: "forbidden" | "not_found" | "not_file" };

/** Resolve a relative key (e.g. documents/foo.pdf) to an on-disk upload path. */
export function resolveUploadFilePath(relativePath: string): ResolveResult {
  const result = resolveUploadFilePathWithIntegrity(relativePath);
  if (result.ok) {
    return { ok: true, filePath: result.filePath };
  }
  const fail = result as Extract<FileIntegrityResult, { ok: false }>;
  return { ok: false, reason: fail.reason === "corrupted" || fail.reason === "size_mismatch" ? "not_found" : fail.reason };
}

function getContentType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type FileIntegrityResult =
  | {
      ok: true;
      filePath: string;
      checksum: string;
      size: number;
    }
  | {
      ok: false;
      reason: "forbidden" | "not_found" | "not_file" | "corrupted" | "size_mismatch";
      details?: string;
    };

/**
 * Case-insensitive search within directory segments (Linux/Hostinger filesystem helper).
 */
function findCaseInsensitiveFile(baseDir: string, relativeSegments: string[]): string | null {
  let currentDir = baseDir;
  for (let i = 0; i < relativeSegments.length; i++) {
    const segment = relativeSegments[i];
    const isLast = i === relativeSegments.length - 1;

    if (!fs.existsSync(currentDir)) return null;

    // Check direct path first (fast path)
    const directPath = path.join(currentDir, segment);
    if (fs.existsSync(directPath)) {
      if (isLast) {
        return directPath;
      }
      currentDir = directPath;
      continue;
    }

    // Read directory entries and search case-insensitively
    try {
      const entries = fs.readdirSync(currentDir);
      const match = entries.find((e) => e.toLowerCase() === segment.toLowerCase());
      if (!match) return null;

      const matchedPath = path.join(currentDir, match);
      if (isLast) {
        return matchedPath;
      }
      currentDir = matchedPath;
    } catch {
      return null;
    }
  }
  return currentDir;
}

export function resolveUploadFilePathWithIntegrity(relativePath: string, expectedChecksum?: string, expectedSize?: number): FileIntegrityResult {
  let decoded = relativePath;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    decoded = relativePath;
  }

  let normalized = decoded
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/^uploads\//i, ""); // Strip redundant "uploads/" prefix if included

  if (!normalized || normalized.includes("..")) {
    return { ok: false, reason: "forbidden" };
  }

  const relativeSegments = normalized.split("/").filter(Boolean);
  const searchDirs = getUploadSearchDirs();

  let matchedFilePath: string | null = null;

  for (const uploadDir of searchDirs) {
    const candidatePath = path.join(uploadDir, normalized);
    const resolvedCandidate = path.resolve(candidatePath);
    const resolvedUploadDir = path.resolve(uploadDir);
    const uploadPrefix = resolvedUploadDir + path.sep;

    // Path traversal check
    if (resolvedCandidate !== resolvedUploadDir && !resolvedCandidate.startsWith(uploadPrefix)) {
      continue;
    }

    // 1. Direct match check
    if (fs.existsSync(candidatePath)) {
      try {
        const stat = fs.statSync(candidatePath);
        if (stat.isFile()) {
          matchedFilePath = candidatePath;
          break;
        }
      } catch {
        // continue search
      }
    }

    // 2. Case-insensitive fallback check for Hostinger / Linux
    const caseMatch = findCaseInsensitiveFile(resolvedUploadDir, relativeSegments);
    if (caseMatch && fs.existsSync(caseMatch)) {
      try {
        const stat = fs.statSync(caseMatch);
        if (stat.isFile()) {
          matchedFilePath = caseMatch;
          break;
        }
      } catch {
        // continue search
      }
    }
  }

  if (!matchedFilePath) {
    logger.warn("File not found across all upload search directories", {
      requested: relativePath,
      normalized,
      searchedDirs: searchDirs,
    });
    return { ok: false, reason: "not_found" };
  }

  const stat = fs.statSync(matchedFilePath);
  if (!stat.isFile()) {
    return { ok: false, reason: "not_file" };
  }

  const file = fs.readFileSync(matchedFilePath);

  // Verify size if expected size provided
  if (expectedSize !== undefined && file.length !== expectedSize) {
    return { ok: false, reason: "size_mismatch", details: `Expected ${expectedSize} bytes, got ${file.length}` };
  }

  // Verify checksum if provided
  const checksum = computeSha256(file);
  if (expectedChecksum !== undefined && checksum !== expectedChecksum) {
    return { ok: false, reason: "corrupted", details: `Checksum mismatch: file may be corrupted` };
  }

  return { ok: true, filePath: matchedFilePath, checksum, size: file.length };
}

export function buildUploadFileResponse(filePath: string, fileBuffer?: Buffer, checksum?: string): Response {
  const contentType = getContentType(filePath);
  const file = fileBuffer ?? fs.readFileSync(filePath);

  // Check if file starts with PDF magic bytes (%PDF-)
  const isPdf = file.length > 4 && file[0] === 0x25 && file[1] === 0x50 && file[2] === 0x44 && file[3] === 0x46;

  logger.info("Serving file", {
    filePath,
    contentType,
    size: file.length,
    isPdf,
    checksum: checksum ?? "not_verified",
    firstBytes: file.slice(0, 10).toString("hex"),
  });

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": file.length.toString(),
    // no-transform prevents CDNs/proxies from compressing or otherwise
    // transforming binary file responses. PDFs are already compressed
    // internally; gzip/brotli on top often makes them larger and can
    // corrupt downloads if the Content-Encoding header is mishandled.
    "Cache-Control": "public, max-age=86400, no-transform",
    // Accept-Ranges lets browsers resume downloads and fetch partial
    // content for PDF viewers, improving reliability.
    "Accept-Ranges": "bytes",
    // Vary tells CDN/caches that Accept-Encoding affects the response.
    // Combined with no-transform this prevents double-compression.
    "Vary": "Accept-Encoding",
    // Security headers: these raw Response objects bypass the Hono
    // global security middleware (which mutates c.res, not a returned
    // Response), so we must set them explicitly here.
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  if (contentType === "application/pdf") {
    // Use attachment (not inline) so the browser consistently triggers
    // a download dialog instead of relying on the PDF viewer plugin,
    // which avoids CDN compression issues with inline display.
    headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
  } else if (
    contentType === "application/msword" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
  }

  // BINARY-SAFETY: Explicitly convert Buffer to Uint8Array for the Web Response
  // constructor. Node.js Buffer is a Uint8Array subclass but some versions of
  // Hono/undici treat them differently — explicit conversion prevents body
  // truncation or encoding issues on binary responses.
  const body = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  return new Response(body, { status: 200, headers });
}

function respondUploadError(c: Context, result: Extract<FileIntegrityResult, { ok: false }>, reqPath: string) {
  if (result.reason === "forbidden") {
    logger.warn("Upload path traversal blocked", { reqPath });
    return c.json({ error: "Forbidden" }, 403);
  }
  if (result.reason === "not_found") {
    logger.warn("Upload file not found", { reqPath });
    return c.text("File not found", 404, {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
    });
  }
  if (result.reason === "corrupted") {
    logger.error("Upload file corrupted (checksum mismatch)", { reqPath, details: result.details });
    return c.json({ error: "File corrupted — checksum mismatch", details: result.details }, 500);
  }
  if (result.reason === "size_mismatch") {
    logger.error("Upload file size mismatch", { reqPath, details: result.details });
    return c.json({ error: "File size mismatch", details: result.details }, 500);
  }
  return c.text("Not a file", 400);
}

/** Check if the request is authenticated (local auth or OAuth). */
async function isAuthenticated(req: Request): Promise<boolean> {
  const headers = req.headers;

  // Try local auth cookie
  const cookies = cookie.parse(headers.get("cookie") || "");
  const localToken = cookies["local_session"];
  const oauthToken = cookies["session_token"];

  logger.info("Auth check for upload", { hasLocalToken: !!localToken, hasOAuthToken: !!oauthToken });

  if (localToken) {
    const claim = await verifyLocalToken(localToken);
    if (claim) {
      logger.info("Upload auth: local token valid", { userId: claim.userId });
      return true;
    }
    logger.warn("Upload auth: local token invalid");
  }

  // Try OAuth session cookie
  if (oauthToken) {
    const claim = await verifySessionToken(oauthToken);
    if (claim) {
      logger.info("Upload auth: OAuth token valid", { unionId: claim.unionId });
      return true;
    }
    logger.warn("Upload auth: OAuth token invalid");
  }

  logger.warn("Upload auth: no valid token found");
  return false;
}

/** Hono middleware for GET /uploads/* — never falls through to the SPA. */
export function createUploadMiddleware() {
  return async (c: Context, next: Next) => {
    const reqPath = c.req.path;
    if (!reqPath.startsWith("/uploads/")) {
      return next();
    }

    // Require authentication for all uploaded files
    const authed = await isAuthenticated(c.req.raw);
    if (!authed) {
      logger.warn("Unauthorized upload file access attempt", { reqPath, ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") });
      return c.json({ error: "Unauthorized — please log in to access this file" }, 401);
    }

    const relativePath = reqPath.replace(/^\/uploads\//, "");

    // SECURITY: Per-folder authorization
    // Document library files are accessible to all authenticated staff
    // Other folders (properties, agreements, profiles, payslips) are restricted
    const isDocumentLibrary = relativePath.startsWith("library/");
    if (!isDocumentLibrary) {
      // For non-library files, we could add additional checks here
      // e.g., verify the user owns the property associated with the file
      // For now, any authenticated user can access non-library files
      // This maintains backward compatibility while keeping auth requirement
    }

    const result = resolveUploadFilePathWithIntegrity(relativePath);
    if (!result.ok) {
      return respondUploadError(c, result as Extract<FileIntegrityResult, { ok: false }>, reqPath);
    }

    try {
      return buildUploadFileResponse(result.filePath, undefined, result.checksum);
    } catch (err) {
      logger.error("Error serving upload file", { reqPath, error: String(err) });
      return c.text("Error serving file", 500);
    }
  };
}

/** Handler for GET /api/file/* (same files, explicit download route). */
export async function handleApiFileRequest(c: Context) {
  // Require authentication for all file downloads
  const authed = await isAuthenticated(c.req.raw);
  if (!authed) {
    logger.warn("Unauthorized API file access attempt", { path: c.req.path, ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") });
    return c.json({ error: "Unauthorized — please log in to access this file" }, 401);
  }

  const rawKey = c.req.path.replace(/^\/api\/file\//, "");
  const result = resolveUploadFilePathWithIntegrity(rawKey);
  if (!result.ok) {
    const fail = result as Extract<FileIntegrityResult, { ok: false }>;
    if (fail.reason === "not_found") {
      logger.warn("API file endpoint: file not found", { key: rawKey });
      return c.json({ error: "File not found" }, 404);
    }
    return respondUploadError(c, fail, c.req.path);
  }

  try {
    return buildUploadFileResponse(result.filePath, undefined, result.checksum);
  } catch (err) {
    logger.error("API file endpoint error", { key: rawKey, error: String(err) });
    return c.json({ error: "Error serving file" }, 500);
  }
}
