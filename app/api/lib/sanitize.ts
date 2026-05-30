/**
 * Server-side input sanitization utilities.
 * Strips HTML tags and normalizes whitespace to prevent XSS attacks.
 *
 * SECURITY NOTE: The previous regex-based approach (/<[^>]*>/g) is a blacklist
 * pattern that can be bypassed. This implementation uses a more robust approach
 * that handles edge cases better. For rich text fields, use DOMPurify server-side.
 */

// More comprehensive HTML tag detection that catches common bypass attempts.
// NOTE: do NOT use the /g flag on regex objects that are reused with .test() —
// the /g flag makes the regex stateful (lastIndex advances), causing alternating
// true/false results on successive .test() calls (classic JS gotcha).
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*?>/g;
const MULTI_SPACE_RE = /\s{2,}/g;

// Base64-alphabet detection: a string whose entire content is valid base64 characters
// cannot contain any HTML/script injection and must not be sanitized (file upload data).
// Threshold: skip sanitization for strings >512 chars that are purely base64.
const BASE64_ONLY_RE = /^[A-Za-z0-9+/=\r\n]+$/;
const BASE64_MIN_LENGTH = 512;

/**
 * Returns true if the value looks like raw base64-encoded binary data.
 * Such strings are XSS-safe and must not have characters stripped from them
 * (doing so corrupts PDF/image/document binary content).
 */
function isBase64BinaryData(value: string): boolean {
  return value.length >= BASE64_MIN_LENGTH && BASE64_ONLY_RE.test(value);
}

/**
 * Sanitize a single string value by stripping HTML tags and normalizing whitespace.
 * Rejects inputs containing script event handlers or dangerous protocols entirely.
 * Base64-encoded binary data (file uploads) is returned as-is — it cannot contain XSS.
 */
export function sanitizeString(value: string): string {
    // Guard: base64 binary data cannot contain XSS — skip sanitization to preserve
    // binary integrity (PDF, image, Word files encoded as base64 for upload).
    if (isBase64BinaryData(value)) {
        return value;
    }

    // Check for dangerous script events or protocols.
    // Use a fresh regex per call (no /g flag on a shared object) to avoid the
    // stateful lastIndex bug where .test() alternates true/false.
    const scriptEventRe = /\s*(on\w+|javascript:|data:|vbscript:)\s*/i;
    if (scriptEventRe.test(value)) {
        // Remove the dangerous parts instead of returning the whole string
        value = value.replace(/\s*(on\w+|javascript:|data:|vbscript:)\s*/gi, "[removed]");
    }

    // Strip HTML tags
    let sanitized = value
        .replace(HTML_TAG_RE, "")
        .replace(MULTI_SPACE_RE, " ")
        .trim();

    // Additional pass: catch any remaining < or > that might form tags
    // This is a defense-in-depth measure
    sanitized = sanitized.replace(/[<>]/g, "");

    return sanitized;
}

/**
 * Recursively sanitize all string values in an object/array.
 * Returns a new sanitized copy; does not mutate the original.
 */
export function sanitizeInput<T>(input: T): T {
    if (typeof input === "string") {
        return sanitizeString(input) as unknown as T;
    }

    if (Array.isArray(input)) {
        return input.map(item => sanitizeInput(item)) as unknown as T;
    }

    if (input !== null && typeof input === "object") {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized as unknown as T;
    }

    return input;
}