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

/** Known DOM / SVG event handler names — allowlist only (never strip "online", "Sonam", etc.). */
const DOM_EVENT_HANDLER_NAMES = [
  "onabort",
  "onauxclick",
  "onbeforeinput",
  "onbeforematch",
  "onbeforetoggle",
  "onbeforeunload",
  "onblur",
  "oncancel",
  "oncanplay",
  "oncanplaythrough",
  "onchange",
  "onclick",
  "onclose",
  "oncontextmenu",
  "oncopy",
  "oncuechange",
  "oncut",
  "ondblclick",
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",
  "ondurationchange",
  "onemptied",
  "onended",
  "onerror",
  "onfocus",
  "onformdata",
  "oninput",
  "oninvalid",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onload",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onmousewheel",
  "onpaste",
  "onpause",
  "onplay",
  "onplaying",
  "onpointercancel",
  "onpointerdown",
  "onpointerenter",
  "onpointerleave",
  "onpointermove",
  "onpointerout",
  "onpointerover",
  "onpointerup",
  "onprogress",
  "onratechange",
  "onreset",
  "onresize",
  "onscroll",
  "onsearch",
  "onseeked",
  "onseeking",
  "onselect",
  "onselectionchange",
  "onselectstart",
  "onshow",
  "onstalled",
  "onsubmit",
  "onsuspend",
  "ontimeupdate",
  "ontoggle",
  "ontouchcancel",
  "ontouchend",
  "ontouchmove",
  "ontouchstart",
  "ontransitioncancel",
  "ontransitionend",
  "ontransitionrun",
  "ontransitionstart",
  "onvolumechange",
  "onwaiting",
  "onwheel",
] as const;

// Match allowlisted handlers as attributes (onclick=) or isolated tokens (onclick).
const EVENT_HANDLER_RE = new RegExp(
  `\\b(?:${DOM_EVENT_HANDLER_NAMES.join("|")})(?:\\s*=|\\s*\\(|\\b)`,
  "gi"
);
const DANGEROUS_PROTOCOL_RE = /\b(?:javascript|vbscript|data):/gi;

/**
 * Returns true if the value looks like raw base64-encoded binary data.
 * Such strings are XSS-safe and must not have characters stripped from them
 * (doing so corrupts PDF/image/document binary content).
 */
function isBase64BinaryData(value: string): boolean {
  return value.length >= BASE64_MIN_LENGTH && BASE64_ONLY_RE.test(value);
}

function containsDangerousString(value: string): boolean {
  EVENT_HANDLER_RE.lastIndex = 0;
  DANGEROUS_PROTOCOL_RE.lastIndex = 0;
  return EVENT_HANDLER_RE.test(value) || DANGEROUS_PROTOCOL_RE.test(value);
}

function stripDangerousStringParts(value: string): string {
  EVENT_HANDLER_RE.lastIndex = 0;
  DANGEROUS_PROTOCOL_RE.lastIndex = 0;
  return value.replace(EVENT_HANDLER_RE, "[removed]").replace(DANGEROUS_PROTOCOL_RE, "[removed]");
}

/**
 * Sanitize a single string value by stripping HTML tags and normalizing whitespace.
 * Strips only allowlisted DOM event handlers and dangerous URL protocols.
 * Base64-encoded binary data (file uploads) is returned as-is — it cannot contain XSS.
 */
export function sanitizeString(value: string): string {
  if (isBase64BinaryData(value)) {
    return value;
  }

  if (containsDangerousString(value)) {
    value = stripDangerousStringParts(value);
  }

  let sanitized = value
    .replace(HTML_TAG_RE, "")
    .replace(MULTI_SPACE_RE, " ")
    .trim();

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
    return input.map((item) => sanitizeInput(item)) as unknown as T;
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
