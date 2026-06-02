/** MIME types accepted for property / library document uploads. */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

/** HTML file input `accept` for document uploads (not payment screenshots). */
export const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const DOCUMENT_UPLOAD_HINT = "PDF, Word (.doc, .docx), PNG, or JPEG";

/** Architecture module: drawings, CAD, renders, video. */
export const ARCHITECTURE_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.dwg,.dxf,.zip,image/*,video/mp4,.mp4,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ARCHITECTURE_UPLOAD_HINT = "PDF, Word, images, DWG/DXF, MP4, or ZIP";

const ARCHITECTURE_EXTENSIONS = new Set(["dwg", "dxf", "mp4", "zip", "webp", "gif"]);

const EXTENSION_MIME: Record<string, AllowedDocumentMimeType> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const MIME_ALIASES: Record<string, AllowedDocumentMimeType> = {
  "image/jpg": "image/jpeg",
  "application/vnd.ms-word": "application/msword",
  "application/x-msword": "application/msword",
};

const ALLOWED_SET = new Set<string>(ALLOWED_DOCUMENT_MIME_TYPES);

function fileExtension(fileName: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function mimeFromFileName(fileName: string): AllowedDocumentMimeType | null {
  return EXTENSION_MIME[fileExtension(fileName)] ?? null;
}

/** Normalize browser-reported MIME using extension when needed. */
export function resolveDocumentMimeType(fileName: string, clientMime: string): string {
  const fromExt = mimeFromFileName(fileName);
  const trimmed = clientMime.trim().toLowerCase();
  const normalized = MIME_ALIASES[trimmed] ?? trimmed;

  // Extension wins when known — browsers often mislabel .docx as application/msword or application/zip.
  if (fromExt && ALLOWED_SET.has(fromExt)) {
    return fromExt;
  }

  if (normalized && ALLOWED_SET.has(normalized)) {
    return normalized;
  }

  return fromExt ?? normalized;
}

export function documentFileTypeLabel(mimeType: string, fileName: string): string {
  if (isWordDocument(mimeType, fileName)) return "Word";
  if (isPdfDocument(mimeType, fileName)) return "PDF";
  if (isImageDocument(mimeType, fileName)) return "Image";
  return "File";
}

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_SET.has(mimeType);
}

export function isAllowedArchitectureUpload(fileName: string, mimeType: string): boolean {
  if (isAllowedDocumentMimeType(mimeType)) return true;
  if (mimeType.startsWith("image/")) return true;
  if (mimeType === "video/mp4") return true;
  if (mimeType === "application/zip") return true;
  return ARCHITECTURE_EXTENSIONS.has(fileExtension(fileName));
}

/** Normalize MIME for architecture uploads (CAD, video, etc.). */
export function resolveArchitectureMimeType(fileName: string, clientMime: string): string {
  const docMime = resolveDocumentMimeType(fileName, clientMime);
  if (isAllowedDocumentMimeType(docMime)) return docMime;

  const ext = fileExtension(fileName);
  if (ext === "mp4") return "video/mp4";
  if (ext === "zip") return "application/zip";
  if (ext === "dwg" || ext === "dxf") return "application/octet-stream";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";

  const trimmed = clientMime.trim().toLowerCase();
  if (trimmed.startsWith("image/") || trimmed === "video/mp4" || trimmed === "application/zip") {
    return trimmed;
  }

  return docMime || trimmed || "application/octet-stream";
}

export function shouldSkipMagicBytesCheck(fileName: string, mimeType: string): boolean {
  if (mimeType === "application/octet-stream") return true;
  if (mimeType === "video/mp4" || mimeType === "application/zip") return true;
  return ARCHITECTURE_EXTENSIONS.has(fileExtension(fileName));
}

export function isWordDocument(mimeType: string, fileName: string): boolean {
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return true;
  }
  const ext = fileExtension(fileName);
  return ext === "doc" || ext === "docx";
}

export function isPdfDocument(mimeType: string, fileName: string): boolean {
  return mimeType === "application/pdf" || fileExtension(fileName) === "pdf";
}

export function isImageDocument(mimeType: string, fileName: string): boolean {
  if (mimeType.startsWith("image/")) return true;
  const ext = fileExtension(fileName);
  return ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp";
}
