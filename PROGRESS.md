# PROGRESS — IRQ تواصل (Full-Stack App: React + Express 5 + Drizzle PostgreSQL)

Last update: 2026-11-15
Scope: Full-stack Iraqi social platform running Vite + React 19 SPA backed by Express 5 (`server.ts`), Drizzle ORM on Neon PostgreSQL (`src/db/*`), OTP session authentication, 3-step media pipeline, SSE real-time updates, moderation workflows, and interactive Bot API. When the database is unreachable, `/api/ready` reports `503` and the SPA falls back gracefully to read-only seed preview data.

| Area / Phase | Status | Notes |
|---|---|---|
| Phase 0: Audit, Tokens, Docs & Self-Hosted Fonts | Done | `src/index.css`, `@fontsource/cairo` & `@fontsource/reem-kufi`, `scripts/check-contrast.ts`, `docs/*` |
| Phase 1: Design System & Responsive Shells | Done | 4 themes (`light`, `dark`, `calm`, `high-contrast`) + `system`, 8 accents, normalized 5-slot `BottomBar` with handedness docking, `TopBar`, `SideRail`, `Sidebar`, `RightPanel` |
| Phase 2: Real Auth, Preferences & Multi-Device Settings | Done | Iraqi phone OTP (`POST /api/auth/otp/request` -> `verify` / `signup`), HttpOnly `tw_sid` cookie sessions, CSRF header verification, device list & revocation (`/api/auth/devices`), account deletion via OTP, guest sign-in prompts |
| Phase 3: Feed, Stories, Notes & Media Upload Pipeline | Done | 3-step upload (`POST /api/media/uploads` -> `PUT` -> `complete`) with magic-byte validation, post creation & author deletion, stories & 24h instants + notes |
| Phase 4: Real-Time Messaging & Bot API | Done | SSE stream (`/api/events`) + 20s delta polling (`/api/bootstrap/delta`), per-conversation attachments, public bots directory (`/api/bots`), `@botfactory_bot`, inline & reply keyboards, callback queries, bot blocking |
| Phase 5: Reels & Live Streaming UI | Partial (UI + Seed Media) | `ReelsView` & `LiveStreamViewerModal` simulation using local seed media (no WebRTC/HLS transport) |
| Phase 6: Market & Wallet UI | Partial (DB + Seed Catalog) | IQD product catalog backed by `/api/products` & wishlists, direct buyer-seller agreement banner, simulated T-Coins display |
| Phase 7: Profile Canvas Studio | Done | Strict Zod `.strict()` schema (`validateCanvasJson`), 12 templates, `/api/users/me/canvas` persistence, prototype pollution guard |
| Phase 8: Moderation, Admin Console & Hardening | Done | `POST /api/reports` with urgent routing, role-gated `/api/admin/kpis`, `/api/admin/reports` resolution (`ban` / `dismiss`), user suspension (`/api/admin/users/:id/suspend`), user blocks & close-friends tables |
| Phase 9: Security Infrastructure & PWA | Done | `helmet` CSP, `pino` redaction, PostgreSQL-backed rate limiters (`rl_bucket`), verified DB TLS, Drizzle migrations (`drizzle/`), graceful shutdown |

## Verification & Checks Status
- **Lint & Typecheck**: Verified via `npm run lint` (`tsc --noEmit`).
- **Automated Tests**: Pure unit tests (`formatters.test.ts`, `deepFeatures.test.ts`, `canvasAndSearch.test.ts`, `apiHelpers.test.ts`) plus backend integration suites (`security.test.ts`, `auth.test.ts`, `media.test.ts`, `messages.test.ts`, `bots.test.ts`, `moderation.test.ts`).
- **Browser Verification**: Audited live via Playwright CLI at `1440x900` desktop and `390x844` mobile viewports with zero runtime errors.
