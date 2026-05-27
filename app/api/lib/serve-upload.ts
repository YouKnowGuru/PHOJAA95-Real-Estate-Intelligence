import type { Context, Next } from "hono";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "./paths";
import { logger } from "./logger";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type ResolveResult =
  | { ok: true; filePath: string }
  | { ok: false; reason: "forbidden" | "not_found" | "not_file" };

/** Resolve a relative key (e.g. documents/foo.pdf) to an on-disk upload path. */
export function resolveUploadFilePath(relativePath: string): ResolveResult {
  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) {
    return { ok: false, reason: "forbidden" };
  }

  const filePath = path.join(UPLOAD_DIR, normalized);
  const resolvedFile = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  const uploadPrefix = resolvedUploadDir + path.sep;
  if (resolvedFile !== resolvedUploadDir && !resolvedFile.startsWith(uploadPrefix)) {
    return { ok: false, reason: "forbidden" };
  }

  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: "not_found" };
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return { ok: false, reason: "not_file" };
  }

  return { ok: true, filePath };
}

function getContentType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

export function buildUploadFileResponse(filePath: string): Response {
  const contentType = getContentType(filePath);
  const file = fs.readFileSync(filePath);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": file.length.toString(),
    "Cache-Control": "public, max-age=86400",
  };
  if (contentType === "application/pdf") {
    headers["Content-Disposition"] = `inline; filename="${path.basename(filePath)}"`;
  } else if (
    contentType === "application/msword" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
  }
  return new Response(file, { status: 200, headers });
}

function respondUploadError(c: Context, result: Extract<ResolveResult, { ok: false }>, reqPath: string) {
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
  return c.text("Not a file", 400);
}

/** Hono middleware for GET /uploads/* — never falls through to the SPA. */
export function createUploadMiddleware() {
  return async (c: Context, next: Next) => {
    const reqPath = c.req.path;
    if (!reqPath.startsWith("/uploads/")) {
      return next();
    }

    const relativePath = reqPath.replace(/^\/uploads\//, "");
    const result = resolveUploadFilePath(relativePath);
    if (!result.ok) {
      return respondUploadError(c, result, reqPath);
    }

    try {
      return buildUploadFileResponse(result.filePath);
    } catch (err) {
      logger.error("Error serving upload file", { reqPath, error: String(err) });
      return c.text("Error serving file", 500);
    }
  };
}

/** Handler for GET /api/file/* (same files, explicit download route). */
export function handleApiFileRequest(c: Context) {
  const rawKey = c.req.path.replace(/^\/api\/file\//, "");
  const result = resolveUploadFilePath(rawKey);
  if (!result.ok) {
    if (result.reason === "not_found") {
      logger.warn("API file endpoint: file not found", { key: rawKey });
      return c.json({ error: "File not found" }, 404);
    }
    return respondUploadError(c, result, c.req.path);
  }

  try {
    return buildUploadFileResponse(result.filePath);
  } catch (err) {
    logger.error("API file endpoint error", { key: rawKey, error: String(err) });
    return c.json({ error: "Error serving file" }, 500);
  }
}
