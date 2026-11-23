# Threat Model & Security Posture (SECURITY.md)

## 1. Profile Canvas Security Boundary
- **Zero Arbitrary Execution**: Version 1 accepts only versioned, validated JSON design configurations verified via `validateCanvasJson` and `.strict()` Zod schemas.
- **No Evaluation**: Strictly prohibits `eval()`, `new Function()`, raw `<script>`, arbitrary HTML strings, CSS injection, or user-supplied dynamic module imports.
- **Trusted Renderer**: Rendered exclusively via reviewed, IRQ-owned React components mapping an allowlist of themes, layouts, blocks, and motion presets.
- **Data Isolation**: Public profile API returns validated layout configuration and public profile stats only; never exposes private tokens or drafts.

## 2. Authentication, Sessions & Privacy Controls
- **Identity Verification**: Iraqi phone OTP challenges (`POST /api/auth/otp/request` -> `/verify` / `/signup`) with per-phone and per-IP PostgreSQL rate limiting (`tw_rate_limits`), constant-time peppered HMAC verification, and attempt caps.
- **PII Protection**: Phone numbers are encrypted at rest with AES-256-GCM (`PHONE_ENC_KEY`) and indexed via HMAC-SHA256 (`PHONE_HMAC_KEY`); `pino` redacts `authorization`, `cookie`, phones, and OTP codes from logs.
- **Sessions & CSRF**: Opaque SHA-256-hashed session tokens in `HttpOnly`, `SameSite=Lax` cookies; mutating endpoints require `X-TW-CSRF: 1` (paired with strict same-origin `helmet` headers and no wildcard CORS).
- **Object-Level Authorization**: Every write and moderation route derives caller identity strictly from `req.user` (never request bodies) and validates ownership/participant/admin membership.
- **Protection of Minors**: Signup rejects users under 13 (`birthYear`) and forces `personal` account types with restricted messaging defaults for minors under 18.

## 3. Media, Validation & Abuse Prevention
- **Strict Schemas**: All route params, queries, and bodies pass `.strict()` Zod schemas (`src/server/schemas.ts`) with safe Arabic JSON errors and zero stack trace leaks.
- **Media Upload Sniffing**: 3-step upload pipeline inspects magic bytes (`image/*`, `video/mp4`, `video/webm`, `application/pdf`, `text/plain`) and enforces per-kind size limits before marking media `ready`.
- **Database TLS**: Verified TLS connections to PostgreSQL (`DATABASE_CA_CERT` support, no `rejectUnauthorized: false`).
- **Bot Isolation**: Bot tokens are SHA-256 hashed (`tw_bots`), scoped strictly to conversations owned/participating with that bot, and URL buttons validate `http(s)` schemes.

## 4. Honest Product Principles
- No fraudulent "End-to-End Encrypted" claims when transport encryption (TLS) + rest encryption is used.
- Transparent moderation reporting (`POST /api/reports`) for harassment, extortion (urgent escalation), and scams, plus user/bot blocking and self-service OTP account deletion.
