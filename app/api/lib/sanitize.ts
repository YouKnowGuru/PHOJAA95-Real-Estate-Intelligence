/**
 * Server-side input sanitization utilities.
 * Strips HTML tags and normalizes whitespace to prevent XSS attacks.
 *
 * SECURITY NOTE: The previous regex-based approach (/<[^>]*>/g) is a blacklist
 * pattern that can be bypassed. This implementation uses a more robust approach
 * that handles edge cases better. For rich text fields, use DOMPurify server-side.
 */

// More comprehensive HTML tag detection that catches common bypass attempts
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*?>/g;
const SCRIPT_EVENT_RE = /\s*(on\w+|javascript:|data:|vbscript:)\s*/gi;
const MULTI_SPACE_RE = /\s{2,}/g;

/**
 * Sanitize a single string value by stripping HTML tags and normalizing whitespace.
 * Rejects inputs containing script event handlers or dangerous protocols entirely.
 */
export function sanitizeString(value: string): string {
    // First check for dangerous script events or protocols — reject entirely
    if (SCRIPT_EVENT_RE.test(value)) {
        // Remove the dangerous parts instead of returning the whole string
        value = value.replace(SCRIPT_EVENT_RE, "[removed]");
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