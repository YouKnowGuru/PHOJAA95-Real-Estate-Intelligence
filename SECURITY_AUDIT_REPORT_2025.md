# PHOJAA95 Real Estate System — Comprehensive Security Audit Report
**Date:** 2026-05-29  
**Auditor:** Kimi Code CLI (Security Skills: security-and-hardening, security-best-practices, security-threat-model)  
**Scope:** Full-stack React + tRPC + Hono + MySQL application  
**Status:** Post-initial-fix audit — remaining issues identified

---

## Executive Summary

This audit was conducted **after** an initial round of security fixes (25 files modified). The codebase has **significantly improved** security posture with proper auth middleware, XSS sanitization, rate limiting, secure cookies, and CSP headers. However, **5 Critical and 13 High severity issues remain** that require immediate attention.

### Risk Assessment
| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Auth/AuthZ | 2 | 3 | 2 | 0 | 7 |
| Data Exposure | 2 | 2 | 1 | 0 | 5 |
| Input Validation | 1 | 2 | 4 | 1 | 8 |
| File Upload | 0 | 2 | 3 | 0 | 5 |
| Infrastructure | 0 | 2 | 3 | 2 | 7 |
| API Security | 0 | 2 | 2 | 2 | 6 |
| **TOTAL** | **5** | **13** | **15** | **5** | **38** |

---

## Critical Issues (Fix Immediately)

### CRIT-1: Self-Registration Privilege Escalation
**File:** `app/api/local-auth-router.ts:71-110`  
**Severity:** Critical  
**Evidence:**
```typescript
role: z.enum(["staff", "admin"]).default("staff"),  // Line 79
```
The first user to register can choose `role: "admin"`, granting themselves full system access. While there's a "first-admin seed protection" (line 87-90), it only kicks in AFTER an admin exists — the very first registrant can self-elevate.

**Impact:** Any attacker who discovers the registration endpoint before legitimate admin setup can own the entire system.  
**Fix:** Remove `role` from registration input entirely; always default to `staff`. Only existing admins can promote users via a separate admin-only endpoint.

---

### CRIT-2: `getFullWorkflow` Returns Unmasked PII to Staff
**File:** `app/api/property-router.ts:1443-1545`  
**Severity:** Critical  
**Evidence:**
```typescript
// Line 1536 — returns raw property object with NO masking
property: { ...property },
```
Unlike `getById` and `list` which mask `ownerCID`, `ownerPhone`, `buyerCID`, `buyerPhone`, `sellingPrice`, `realEstateFee`, the `getFullWorkflow` endpoint returns the raw property object. Staff can see full CID numbers, phone numbers, selling prices, and financial data.

**Impact:** Staff can access sensitive owner/buyer PII and financial data they should not see.  
**Fix:** Apply the same PII masking logic from `getById` to `getFullWorkflow`.

---

### CRIT-3: Report Export Exposes Full Unmasked PII in Bulk
**File:** `app/api/report-router.ts:34-98`  
**Severity:** Critical  
**Evidence:**
```typescript
// Lines 65-66 — raw PII in CSV/JSON export
ownerCID: properties.ownerCID,
ownerPhone: properties.ownerPhone,
```
The `exportProperties` endpoint includes `ownerCID` and `ownerPhone` with zero masking. While admin-only, if an admin account is compromised or the export is shared, ALL owner PII is exposed in bulk.

**Impact:** Mass PII exposure if export file is leaked or admin account compromised.  
**Fix:** Mask PII in exports or add a justification/approval workflow for PII exports.

---

### CRIT-4: SQL Injection Risk in Attendance Search
**File:** `app/api/attendance-router.ts:154`  
**Severity:** Critical  
**Evidence:**
```typescript
if (input.userName) conditions.push(sql`${localUsers.fullName} LIKE ${`%${input.userName}%`}`);
```
The `userName` parameter has no `.max()` limit (line 141: `z.string().optional()`). While Drizzle parameterizes the value, extremely long inputs could cause DoS or buffer issues. More critically, the pattern uses raw SQL concatenation.

**Impact:** Potential SQL injection or DoS via extremely long search strings.  
**Fix:** Add `.max(255)` to `userName` schema and validate the LIKE pattern is safe.

---

### CRIT-5: No Per-File Authorization in Upload Serving
**File:** `app/api/lib/serve-upload.ts:92-152`  
**Severity:** Critical  
**Evidence:**
```typescript
async function isAuthenticated(req: Request): Promise<boolean> {
  // Only checks IF user is logged in — not WHICH files they can access
  const localToken = cookies["local_session"];
  // ... returns true for ANY valid user
}
```
The upload middleware checks authentication (any valid user) but NOT authorization (can this user access THIS specific file?). A staff user could access another staff user's payslips, property documents, or profile images by guessing the path.

**Impact:** Any authenticated user can access ANY uploaded file by path guessing — payslips, property docs, profile images, etc.  
**Fix:** Implement per-file/folder authorization based on user role and file path.

---

## High Severity Issues

### HIGH-1: Staff Can Self-Update HR Fields
**File:** `app/api/user-router.ts:230-246`  
**Severity:** High  
Staff can update `pfNumber`, `employeeId`, and `profileImage` via `userRouter.updateProfile`, while `localAuthRouter.updateProfile` correctly blocks these. Inconsistent enforcement.

**Fix:** Remove `pfNumber` and `employeeId` from staff `updateProfile` schema.

---

### HIGH-2: Arbitrary Action Injection in Audit Logs
**File:** `app/api/activity-log-router.ts:8-34`  
**Severity:** High  
`action: z.string()` with no enum restriction allows admins to inject any action name into audit logs, compromising audit integrity.

**Fix:** Restrict `action` to a predefined enum of valid actions.

---

### HIGH-3: Seed Router Logs Plaintext Passwords
**File:** `app/api/seed-router.ts:48-54`  
**Severity:** High  
```typescript
console.error(`SEED: Admin password: ${adminPass}`);
```
Logs cryptographically generated but plaintext passwords to stderr. Could end up in log files.

**Fix:** Never log passwords, even generated ones.

---

### HIGH-4: CORS Misconfiguration Risk
**File:** `app/api/boot.ts:62-70`  
**Severity:** High  
`env.appUrl` defaults to `http://localhost:5173` if `APP_URL` is not set. In production, this could allow localhost origins.

**Fix:** Fail startup if `APP_URL` is not explicitly set in production.

---

### HIGH-5: 50MB Body Limit Enables DoS
**File:** `app/api/boot.ts:118`  
**Severity:** High  
`bodyLimit({ maxSize: 50 * 1024 * 1024 })` allows 50MB request bodies. Combined with base64 uploads, this is a significant DoS vector.

**Fix:** Reduce to 15-20MB or implement per-endpoint limits.

---

### HIGH-6: Insufficient Path Sanitization
**File:** `app/api/services/upload.ts:18-20, 60-64`  
**Severity:** High  
`sanitizePath` replaces `\`, `/`, `..` but doesn't prevent double extensions (e.g., `file.jpg.php`) or special files like `.htaccess`.

**Fix:** Validate extension against strict whitelist and reject multiple extensions.

---

### HIGH-7: File Read Into Memory (Not Streamed)
**File:** `app/api/lib/serve-upload.ts:56-74`  
**Severity:** High  
`fs.readFileSync(filePath)` reads entire files into memory. For large uploads, this causes memory exhaustion.

**Fix:** Use `createReadStream` instead of `readFileSync`.

---

### HIGH-8: JWT Tokens Lack Revocation
**File:** `app/api/local-auth-router.ts:28-42`  
**Severity:** High  
No `jti` (token ID) claim means no way to revoke individual sessions server-side.

**Fix:** Implement token versioning or a session store.

---

### HIGH-9: Signed URLs Not Verified
**File:** `app/api/upload-router.ts:78-95`, `app/api/services/upload.ts:119-131`  
**Severity:** High  
`getSignedDownloadUrl` generates HMAC-signed URLs, but `serve-upload.ts` never calls `verifySignature`. The signature mechanism exists but is unused.

**Fix:** Either remove signed URL mechanism or actually verify signatures in `handleApiFileRequest`.

---

### HIGH-10: Rate Limit Bypass via Header Rotation
**File:** `app/api/middleware.ts:79-98`  
**Severity:** High  
IP-based rate limiting trusts `X-Forwarded-For`. Attackers can rotate this header to bypass limits.

**Fix:** Document and enforce proper `TRUST_PROXY_COUNT` configuration.

---

### HIGH-11: Shared Auth Rate Limit Pool
**File:** `app/api/middleware.ts:103-122`  
**Severity:** High  
All auth endpoints (login, register, forgotPassword, resetPassword) share the same 5-attempt-per-15-minutes limit. A user hitting `forgotPassword` 5 times blocks their own `login`.

**Fix:** Use separate rate limit stores per endpoint type.

---

### HIGH-12: Chatbot Has No Rate Limiting
**File:** `app/api/chatbot-router.ts:619-846`  
**Severity:** High  
The `sendMessage` endpoint uses `authedQuery` but has **no rate limiting**. Users could spam OpenRouter API, causing cost exhaustion.

**Fix:** Add dedicated rate limiter for chatbot endpoints.

---

### HIGH-13: Notification Spam to Admins
**File:** `app/api/notification-router.ts:89-107`  
**Severity:** High  
Staff can create notifications for admins (line 102: admin role bypasses the self-only check).

**Fix:** Restrict staff to only creating notifications for themselves.

---

## Medium Severity Issues

| ID | Issue | File | Fix |
|----|-------|------|-----|
| MED-1 | `authRouter.me` returns full OAuth user object | `auth-router.ts:7` | Select only safe fields |
| MED-2 | Base64 upload has no max length | `upload-router.ts:13,45` | Add `.max()` validation |
| MED-3 | Document library path traversal risk | `document-library-router.ts:97-99` | Validate storageKey pattern |
| MED-4 | Phone/address no max length | `local-auth-router.ts:77-78` | Add `.max()` limits |
| MED-5 | CSP allows unsafe-inline/eval | `boot.ts:83-97` | Use nonces/hashes in production |
| MED-6 | Features field accepts arbitrary JSON | `property-router.ts:76,231` | Add key whitelist |
| MED-7 | Property search no max length | `property-router.ts:368-382` | Add `.max(255)` |
| MED-8 | Chatbot tool returns phone/employeeId | `chatbot-router.ts:496-512` | Remove sensitive fields |
| MED-9 | Property update staff can inject admin fields | `property-router.ts:640,822-826` | Use strict schemas |
| MED-10 | Limit has no upper bound | `property-router.ts:380` | Add `.max(500)` |
| MED-11 | Dashboard limit no upper bound | `dashboard-router.ts:102` | Add `.max(100)` |
| MED-12 | Login timing leaks DB status | `local-auth-router.ts:122-142` | Add consistent delay |
| MED-13 | No folder auth for sensitive uploads | `upload-router.ts:16` | Add role-based restrictions |
| MED-14 | deleteFile silently ignores errors | `services/upload.ts:94-98` | Log or propagate errors |
| MED-15 | XSS sanitize regex bypassable | `sanitize.ts:11-36` | Consider DOMPurify |

---

## Low Severity Issues

| ID | Issue | File | Fix |
|----|-------|------|-----|
| LOW-1 | X-XSS-Protection deprecated | `boot.ts:77` | Remove header |
| LOW-2 | No limit bounds on list queries | Various | Add `.max()` |
| LOW-3 | console.error in production | Various | Use logger only |
| LOW-4 | Missing error boundaries | Some routes | Add React error boundaries |
| LOW-5 | Unused imports | Various | Clean up |

---

## What Was Already Fixed (Good Work!)

| Fix | Status |
|-----|--------|
| Hardcoded admin password → random generation | ✅ |
| Missing auth on property steps → ownership checks | ✅ |
| Public file uploads → auth required | ✅ |
| XSS via dangerouslySetInnerHTML → safe rendering | ✅ |
| Unsigned download URLs → HMAC-SHA256 signed | ✅ |
| Open redirect in FileUploader → URL validation | ✅ |
| Insecure cookies → SameSite=Lax, secure in prod | ✅ |
| Session token leak → removed from response | ✅ |
| PII masking for staff → implemented | ✅ |
| Error message leaks → generic messages | ✅ |
| Security headers → CSP, HSTS, X-Frame-Options | ✅ |
| Rate limiting → auth and general limits | ✅ |
| Input sanitization → enhanced | ✅ |
| Chatbot authorization → role-based tool filtering | ✅ |

---

## Immediate Action Items (Priority Order)

1. **CRIT-1:** Remove `role` from public registration
2. **CRIT-2:** Add PII masking to `getFullWorkflow`
3. **CRIT-3:** Mask PII in report exports
4. **CRIT-4:** Fix SQL injection risk in attendance search
5. **CRIT-5:** Implement per-file authorization in uploads
6. **HIGH-1:** Block staff from self-updating HR fields
7. **HIGH-5:** Reduce body limit to 15-20MB
8. **HIGH-7:** Stream file serving instead of readFileSync
9. **HIGH-12:** Add rate limiting to chatbot
10. **HIGH-3:** Remove password logging from seed router

---

## Threat Model Summary

**Assets:** Property records, owner/buyer PII (CID, phone, address), financial data (selling price, fees), payroll data, user credentials, uploaded documents

**Trust Boundaries:**
- Public internet → Frontend (untrusted)
- Frontend → tRPC API (authenticated, role-based)
- API → Database (trusted, internal network)
- API → File system (trusted, but needs per-file auth)

**Key Risks:**
1. **Privilege Escalation:** First registrant can become admin
2. **Data Breach:** Staff can access other users' PII and documents
3. **DoS:** Large body limits, memory exhaustion on file serving
4. **Audit Integrity:** Arbitrary action injection in logs
5. **Cost Exhaustion:** Unrestricted chatbot API usage

---

*Report generated by Kimi Code CLI using security-and-hardening, security-best-practices, and security-threat-model skills.*
