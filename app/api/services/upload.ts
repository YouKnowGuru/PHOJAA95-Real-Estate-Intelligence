import * as fs from "fs/promises";
import * as path from "path";
import { nanoid } from "nanoid";
import { resolveDocumentMimeType, resolveArchitectureMimeType, isAllowedDocumentMimeType, isAllowedArchitectureUpload, shouldSkipMagicBytesCheck } from "@contracts/upload";
import { UPLOAD_DIR } from "../lib/paths";
import { logger } from "../lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "application/msword": [0xd0, 0xcf, 0x11, 0xe0],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [0x50, 0x4b, 0x03, 0x04],
};

/**
 * Sanitize a single path component (filename or folder name).
 * Replaces slashes and collapses ".." — safe for individual name segments.
 */
function sanitizePath(input: string): string {
  return input.replace(/[\\/]/g, "_").replace(/\.{2,}/g, "_");
}

/**
 * Sanitize a full storage key that may contain forward-slash separators
 * (e.g. "properties/123/step-2/abc.pdf"). Only blocks path traversal (..);
 * preserves the directory structure.
 *
 * SECURITY: The result is always validated against UPLOAD_DIR with path.resolve
 * before any file operation, so the traversal check here is defence-in-depth.
 */
function sanitizeKey(key: string): string {
  // Reject any key that contains ".." (path traversal attempt)
  if (key.includes("..")) {
    throw new Error("Invalid file key: path traversal not allowed");
  }
  // Normalise backslashes to forward slashes, then strip leading slashes
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

function validateMagicBytes(buffer: Buffer, claimedMimeType: string): boolean {
  const expected = MAGIC_BYTES[claimedMimeType];
  if (!expected) return true;
  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false;
  }
  return true;
}

export interface UploadResult {
  key: string;
  url: string;
  signedUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export async function uploadFile(
  file: Buffer,
  fileName: string,
  mimeType: string,
  folder: string
): Promise<UploadResult> {
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const resolvedMime = folder === "architecture" || folder.startsWith("architecture/")
    ? resolveArchitectureMimeType(fileName, mimeType)
    : resolveDocumentMimeType(fileName, mimeType);

  const allowed = folder === "architecture" || folder.startsWith("architecture/")
    ? isAllowedArchitectureUpload(fileName, resolvedMime)
    : isAllowedDocumentMimeType(resolvedMime);

  if (!allowed) {
    throw new Error(
      folder === "architecture" || folder.startsWith("architecture/")
        ? "File type not allowed. Allowed: PDF, Word, images, DWG/DXF, MP4, or ZIP"
        : "File type not allowed. Allowed types: PDF, Word (.doc, .docx), PNG, JPEG"
    );
  }

  // Debug: Check magic bytes before validation
  const isPdf = file.length > 4 && file[0] === 0x25 && file[1] === 0x50 && file[2] === 0x44 && file[3] === 0x46;
  logger.info("Upload debug", { 
    fileName, 
    size: file.length, 
    isPdf, 
    firstBytes: file.slice(0, 10).toString("hex"),
    firstChars: file.slice(0, 10).toString("ascii")
  });

  if (!shouldSkipMagicBytesCheck(fileName, resolvedMime) && !validateMagicBytes(file, resolvedMime)) {
    throw new Error("File content does not match claimed file type");
  }

  const safeFolder = sanitizePath(folder);
  const safeFileName = sanitizePath(fileName);
  const ext = safeFileName.split(".").pop() || "bin";
  const uuid = nanoid(16);
  const key = `${safeFolder}/${uuid}.${ext}`;

  const folderPath = path.join(UPLOAD_DIR, safeFolder);
  await fs.mkdir(folderPath, { recursive: true });

  const filePath = path.join(folderPath, `${uuid}.${ext}`);
  await fs.writeFile(filePath, file);

  // Verify written file
  const writtenFile = await fs.readFile(filePath);
  const writtenIsPdf = writtenFile.length > 4 && writtenFile[0] === 0x25 && writtenFile[1] === 0x50 && writtenFile[2] === 0x44 && writtenFile[3] === 0x46;
  logger.info("File uploaded and verified", { 
    key, 
    filePath, 
    size: file.length, 
    writtenSize: writtenFile.length,
    mimeType: resolvedMime,
    isPdf: writtenIsPdf
  });

  const publicUrl = `/uploads/${key}`;

  return {
    key,
    url: publicUrl,
    signedUrl: publicUrl,
    fileName: safeFileName,
    fileSize: file.length,
    mimeType: resolvedMime,
  };
}

export async function deleteFile(key: string): Promise<void> {
  // Use sanitizeKey (preserves '/') not sanitizePath (replaces '/' → '_').
  // Storage keys contain sub-directories, e.g. "properties/123/step-2/abc.pdf".
  const safeKey = sanitizeKey(key);
  const filePath = path.join(UPLOAD_DIR, safeKey);
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir + path.sep) && resolvedPath !== resolvedUploadDir) {
    throw new Error("Invalid file path");
  }
  try {
    await fs.unlink(resolvedPath);
  } catch {
    // ignore — file may have already been deleted
  }
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  // Use sanitizeKey (preserves '/') so the URL path keeps sub-directory structure.
  const safeKey = sanitizeKey(key);
  // Generate a time-limited signed URL with HMAC signature
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = await generateSignature(safeKey, expiresAt);
  return `/api/file/${safeKey}?signature=${signature}&expires=${expiresAt}`;
}

/** Generate HMAC-SHA256 signature for file access. */
async function generateSignature(key: string, expiresAt: number): Promise<string> {
  const { env } = await import("../lib/env");
  const crypto = await import("crypto");
  const hmac = crypto.createHmac("sha256", env.appSecret || "fallback-secret");
  hmac.update(`${key}:${expiresAt}`);
  return hmac.digest("hex");
}

/** Verify HMAC-SHA256 signature for file access. */
export async function verifySignature(key: string, expiresAt: number, signature: string): Promise<boolean> {
  const expected = await generateSignature(key, expiresAt);
  // Constant-time comparison to prevent timing attacks
  try {
    const { timingSafeEqual } = await import("crypto");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export async function listFiles(prefix: string): Promise<string[]> {
  const safePrefix = sanitizeKey(prefix);
  const folderPath = path.join(UPLOAD_DIR, safePrefix);
  const resolvedPath = path.resolve(folderPath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    throw new Error("Invalid folder path");
  }
  try {
    return await fs.readdir(resolvedPath);
  } catch {
    return [];
  }
}

export async function deleteFolder(prefix: string): Promise<void> {
  const safePrefix = sanitizeKey(prefix);
  const folderPath = path.join(UPLOAD_DIR, safePrefix);
  const resolvedPath = path.resolve(folderPath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    throw new Error("Invalid folder path");
  }
  try {
    await fs.rm(resolvedPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function validateFileType(mimeType: string, fileName?: string): boolean {
  const resolved = fileName ? resolveDocumentMimeType(fileName, mimeType) : mimeType;
  return isAllowedDocumentMimeType(resolved);
}

export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}
