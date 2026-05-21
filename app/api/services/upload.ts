import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import * as os from "os";
import { nanoid } from "nanoid";
import { UPLOAD_DIR } from "../lib/paths";
import { cloudinary, isCloudinaryConfigured } from "../lib/cloudinary";
import { logger } from "../lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

function sanitizePath(input: string): string {
  return input.replace(/[\\/]/g, "_").replace(/\.{2,}/g, "_");
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
  publicId?: string;
}

async function uploadToCloudinary(
  file: Buffer,
  mimeType: string,
  folder: string,
  uuid: string
): Promise<{ secure_url: string; public_id: string }> {
  const resourceType = mimeType.startsWith("image/") ? "image" : "raw";
  const cloudinaryFolder = `phojaa95/${folder}`;
  const tempFile = path.join(os.tmpdir(), `upload-${uuid}`);

  try {
    // Write buffer to temp file — cloudinary.uploader.upload() is more reliable than streams
    await fs.writeFile(tempFile, file);
    logger.debug("Cloudinary temp file written", { tempFile, size: file.length });

    const result = await cloudinary.uploader.upload(tempFile, {
      folder: cloudinaryFolder,
      resource_type: resourceType,
      public_id: uuid,
      overwrite: true,
    });

    if (!result || !result.secure_url) {
      throw new Error("Cloudinary returned empty result");
    }

    logger.info("Cloudinary upload success", {
      publicId: result.public_id,
      url: result.secure_url,
      resourceType,
      folder: cloudinaryFolder,
    });

    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Cloudinary upload failed", {
      error: errorMsg,
      folder: cloudinaryFolder,
      resourceType,
      uuid,
    });
    throw new Error(`Cloudinary upload failed: ${errorMsg}`);
  } finally {
    // Always clean up temp file
    try {
      await fs.unlink(tempFile);
    } catch {
      // ignore cleanup errors
    }
  }
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

  // ─── Cloudinary upload (preferred if configured) ──────────────────
  if (isCloudinaryConfigured) {
    try {
      const cdn = await uploadToCloudinary(file, mimeType, safeFolder, uuid);
      return {
        key,
        url: cdn.secure_url,
        signedUrl: cdn.secure_url,
        fileName: safeFileName,
        fileSize: file.length,
        mimeType,
        publicId: cdn.public_id,
      };
    } catch (err) {
      // If Cloudinary fails, fall back to local disk so the user isn't blocked
      logger.warn("Cloudinary failed, falling back to local disk", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── Local disk fallback ──────────────────────────────────────────
  const folderPath = path.join(UPLOAD_DIR, safeFolder);
  await fs.mkdir(folderPath, { recursive: true });

  const filePath = path.join(folderPath, `${uuid}.${ext}`);
  await fs.writeFile(filePath, file);

  const publicUrl = `/uploads/${key}`;

  logger.info("File uploaded to local disk", { key, filePath, size: file.length, mimeType });

  return {
    key,
    url: publicUrl,
    signedUrl: publicUrl,
    fileName: safeFileName,
    fileSize: file.length,
    mimeType,
  };
}

export async function deleteFile(key: string, publicId?: string): Promise<void> {
  if (isCloudinaryConfigured && publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
      logger.info("Cloudinary file deleted", { publicId });
      return;
    } catch (err) {
      logger.error("Cloudinary delete failed", { publicId, error: String(err) });
    }
  }

  const safeKey = sanitizePath(key);
  const filePath = path.join(UPLOAD_DIR, safeKey);
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    throw new Error("Invalid file path");
  }
  try {
    await fs.unlink(resolvedPath);
  } catch {
    // ignore
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
    // ignore
  }
}

export function validateFileType(mimeType: string): boolean {
  return ALLOWED_TYPES.includes(mimeType);
}

export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}
