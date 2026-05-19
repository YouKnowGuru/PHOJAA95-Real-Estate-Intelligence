/**
 * Server-side input sanitization utilities.
 * Strips HTML tags and normalizes whitespace to prevent XSS attacks.
 */

const HTML_TAG_RE = /<[^>]*>/g;
const MULTI_SPACE_RE = /\s{2,}/g;

/**
 * Sanitize a single string value by stripping HTML tags and normalizing whitespace.
 */
export function sanitizeString(value: string): string {
    return value
        .replace(HTML_TAG_RE, "")
        .replace(MULTI_SPACE_RE, " ")
        .trim();
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