import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
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

// File magic bytes for validation
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
  publicId?: string; // Cloudinary public_id if using Cloudinary
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
    const resourceType = mimeType.startsWith("image/") ? "image" : "raw";
    const cloudinaryFolder = `phojaa95/${safeFolder}`;

    const uploadResult = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: cloudinaryFolder,
          resource_type: resourceType,
          public_id: uuid,
          use_filename: false,
          unique_filename: false,
        },
        (err, result) => {
          if (err || !result) {
            reject(err || new Error("Cloudinary upload failed"));
          } else {
            resolve({ secure_url: result.secure_url, public_id: result.public_id });
          }
        }
      );
      stream.end(file);
    });

    logger.info("File uploaded to Cloudinary", {
      key,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      size: file.length,
      mimeType,
    });

    return {
      key,
      url: uploadResult.secure_url,
      signedUrl: uploadResult.secure_url,
      fileName: safeFileName,
      fileSize: file.length,
      mimeType,
      publicId: uploadResult.public_id,
    };
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
  // Delete from Cloudinary if we have a public_id
  if (isCloudinaryConfigured && publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
      logger.info("Cloudinary file deleted", { publicId });
      return;
    } catch (err) {
      logger.error("Cloudinary delete failed", { publicId, error: String(err) });
      // Fall through to local delete as fallback
    }
  }

  // Local disk delete
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
