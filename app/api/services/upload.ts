import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

// File magic bytes for validation
const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

// Get app directory from bundled script location instead of process.cwd()
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "../.."); // from api/services/ up to app/
const UPLOAD_DIR = path.join(APP_DIR, "public", "uploads");

// Ensure upload directory exists on startup
(async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
})();

function sanitizePath(input: string): string {
  // Prevent path traversal by removing any path separators and parent dir references
  return input.replace(/[\\/]/g, "_").replace(/\.{2,}/g, "_");
}

function validateMagicBytes(buffer: Buffer, claimedMimeType: string): boolean {
  const expected = MAGIC_BYTES[claimedMimeType];
  if (!expected) return true; // No magic bytes check for this type
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

  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("File type not allowed. Allowed types: PDF, PNG, JPEG");
  }

  if (!validateMagicBytes(file, mimeType)) {
    throw new Error("File content does not match claimed MIME type");
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

  const publicUrl = `/uploads/${key}`;

  return {
    key,
    url: publicUrl,
    signedUrl: publicUrl,
    fileName: safeFileName,
    fileSize: file.length,
    mimeType,
  };
}

export async function deleteFile(key: string): Promise<void> {
  const safeKey = sanitizePath(key);
  const filePath = path.join(UPLOAD_DIR, safeKey);
  // Ensure the resolved path is still inside UPLOAD_DIR
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    throw new Error("Invalid file path");
  }
  try {
    await fs.unlink(resolvedPath);
  } catch {
    // File may not exist; ignore
  }
}

export async function getSignedDownloadUrl(key: string, _expiresIn = 3600): Promise<string> {
  const safeKey = sanitizePath(key);
  return `/uploads/${safeKey}`;
}

export async function listFiles(prefix: string): Promise<string[]> {
  const safePrefix = sanitizePath(prefix);
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
  const safePrefix = sanitizePath(prefix);
  const folderPath = path.join(UPLOAD_DIR, safePrefix);
  const resolvedPath = path.resolve(folderPath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    throw new Error("Invalid folder path");
  }
  try {
    await fs.rm(resolvedPath, { recursive: true, force: true });
  } catch {
    // Folder may not exist; ignore
  }
}

export function validateFileType(mimeType: string): boolean {
  return ALLOWED_TYPES.includes(mimeType);
}

export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}
