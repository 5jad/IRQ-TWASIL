# IRQ تواصل — Master Build Prompt

الخطة المرجعية لبناء **IRQ تواصل**: منصة اجتماعية ومراسلة عراقية، عربية أولاً (RTL)، تبدأ كتطبيق ويب متجاوب وقابل للتثبيت PWA، ثم يمكن إضافة تطبيقات Android وiOS أصلية لاحقاً على Backend وعقود API مشتركة. موجّهة إلى Google AI Studio Build mode مع حفظ المصدر ومزامنته إلى GitHub. الإصدار 1.1.

> استخدم هذا المستند مع مواصفات الواجهة المرفقة كمصدرَي المنتج. لا تطلب من Google AI Studio تنفيذ المنصة كلها في رسالة واحدة؛ نفّذ مرحلة واحدة فقط في كل مرة. الأولوية: قرارات المستخدم المحدثة هنا، ثم متطلبات الأمان في هذا المستند، ثم نطاق المنتج، ثم تفاصيل الواجهة. وثيقة الواجهة تضبط الشكل والتفاعل فقط ولا يجوز أن تتجاوز قيداً أمنياً أو تلغي متطلباً وظيفياً.

## 0. Operating contract (read first)

You are the implementation assistant for IRQ تواصل. Work on the owner-approved phase only, preserve existing work, and pause for owner approval before paid services, public releases, irreversible changes or material architecture decisions.

1. **Source of truth.** Follow the precedence in the opening note: owner decisions, security boundaries, product scope, then UI detail. This plan wins over undocumented assumptions. If a repository already has code, audit and reconcile it without discarding working behavior (see 0.3).
2. **Phases.** Work only in the phases of section 24. Do not start phase N+1 until phase N passes its definition of done.
3. **Existing repository.** Phase 0 starts with an audit. Keep working code and dependencies where compatible. Database, hosting and third-party providers are provisional until their compatibility, security, privacy/data-location, exportability and staged costs are reviewed. Do not provision or migrate a paid/external service without owner approval. Record justified changes in `/docs/DECISIONS.md`.
4. **Progress file.** Maintain `/PROGRESS.md` (format in 24.2). Update it after every task, not at the end.
5. **Verify your own work.** Before reporting anything: run typecheck, lint, unit tests, production build, Playwright end-to-end tests, axe accessibility checks and Lighthouse. Fix failures first. The user must never have to paste logs back to you.
6. **Report briefly.** After each phase send at most 10 lines: what is done, how far (percent), what is missing, risks. No long logs, no code dumps.
7. **Zero known errors.** No console errors, no hydration warnings, no TODO placeholders, no lorem ipsum, no fake data on production paths. Demo data lives only in `scripts/seed.ts`.
8. **Find design resources yourself.** Fonts, icons, illustrations, sounds, Lottie animations, patterns, sample templates: search for them, check the license, add them to the project, and record each in `/docs/ASSETS.md` (name, source URL, license). Use only permissive licenses. The user will not add assets by hand.
9. **Resolve ambiguity responsibly.** Choose and record reversible, low-risk implementation details in `/docs/DECISIONS.md`. Pause and ask the owner before enabling a paid provider, committing to a production data region, changing an approved authentication/data architecture, publishing publicly, or making a legal/privacy decision that cannot safely be assumed.
10. **Honesty in the product.** The interface must never claim something that is not true. Example: show 'encrypted' only for what is actually encrypted. Never show fake counters, fake online users or fake verification.
11. **Security rules in section 20 are non-negotiable.** If a feature cannot be built safely, build the safe subset and document the gap.
12. **UI language.** All user-facing text is Arabic (modern standard with a light Iraqi tone in microcopy). Keep every string in `messages/ar.json` with an `en.json` fallback through next-intl. Code, comments, commits and docs are English.

### 0.1 Known problems to fix first

The previous build reported: (a) fonts and colors from the design system do not show, (b) the profile settings button misbehaves. Fix in this order:

- Fonts: load Cairo and Reem Kufi with `next/font/google` (subsets `arabic` and `latin`, `display: swap`, variable fonts). Put both `className`s and the CSS variables on the `<html>` element, not on a nested div. In Tailwind 4 map them inside `@theme inline { --font-sans: var(--font-cairo); --font-display: var(--font-reem-kufi); }`. Verify with a Playwright test that reads `getComputedStyle(document.body).fontFamily`.
- Colors: define all tokens as CSS variables in `app/globals.css` under `:root` and `.dark`, expose them to Tailwind through `@theme inline`, and remove any hard-coded hex values from components. Add a lint rule or script that fails the build if a component contains a raw hex color.
- Profile settings button: reproduce, write a failing Playwright test first, then fix.
- Run the design audit in 24 (Phase 1) and list every visual flaw found in `/docs/DESIGN_AUDIT.md` before fixing.

### 0.2 Definition of done (applies to every task)

A task is done only when: the PWA works at 320px, 360px, 390px, 768px, 1024px, 1280px, 1536px, 1920px and 2560px; it works in light, dark, calm and high-contrast themes; it works in RTL with Arabic text; keyboard-only use works; screen-reader labels exist; loading, empty, error and offline states are accurate; it has at least one relevant test; it is recorded in PROGRESS.md. Native clients are a later, separate phase and use platform units (dp/pt) while preserving the same semantic design tokens and behavior.

## 1. Product definition

**Name:** IRQ تواصل، من IRQ Digital Technologies. **Tagline:** تواصل، كل العراق بمكان واحد. استخدم شعار IRQ المعتمد وأيقونة المنتج التابعة لعائلة IRQ؛ لا تخترع شعاراً بديلاً أو ألواناً تخالف الشعار المعتمد.

**What it is:** منصة اجتماعية عراقية تجمع النشر والقصص والمنشورات النصية والخيوط، الرسائل الخاصة والمجموعات والقنوات، المجتمعات والغرف الصوتية، الفيديو القصير والطويل والبث المباشر، السوق المحلي، وخيارات مستقبلية للبوتات والمؤثرات الإبداعية. تستلهم أنماطاً مألوفة من عدة منتجات لكنها لا تنسخ واجهاتها أو علاماتها. لا يوجد توصيل أو معالجة مدفوعات حقيقية في نطاق السوق الحالي. ميزات البوتات والمؤثرات المتقدمة تُطلق خلف مراحل وأعلام ميزات مستقلة.

**Signature feature:** Profile Canvas (section 14): every user can creatively redesign their profile using a trusted visual editor or AI-assisted prompt-to-configuration flow, preview it, and approve it to go live. AI output is restricted to a validated JSON schema and is never executed as code.

**Platform and release order:** first release is a mobile-first responsive web application installable as a PWA. Native clients (Android/iOS scope and sequence to be decided later) are explicitly deferred until the PWA, public API, security controls and operations are stable. The web PWA and future native clients must use the same versioned backend contracts, authorization rules and domain services; do not place core behavior only in Next.js Server Actions.

**Scope:** sections 4–19 define the complete product roadmap, not a demand to implement every feature in the first release. Phase 24 defines release gates. The first public release must be a coherent, genuinely functional PWA slice; future modules remain visibly gated, not fake.

**Out of scope for the first release:** IRQ Browser, IRQ Mail, real-money payments, delivery logistics, native mobile clients, arbitrary user JavaScript in profiles. Keep extension interfaces for later. T-Coins are virtual only and cannot be represented as money.

**Audience:** all ages and education levels, many on cheap phones and slow connections. Therefore: simple by default, advanced options hidden until needed, fast on weak devices, large touch targets, readable Arabic.

**Product principles:** (1) fast first, (2) calm design with warm neutrals, (3) the user controls appearance (theme, font size, motion, density), (4) merchants are first-class citizens, (5) safety by default for women and minors, (6) never trap users: easy export and delete.

**Metrics to instrument** (privacy-friendly, no ad tracking): daily and monthly active users, retention day 1/7/30, posts per day, messages per day, merchants with at least one order, report-to-resolution time, p75 Core Web Vitals. Use self-hosted PostHog or Plausible. Respect a Do Not Track toggle in settings.

## 2. Initial technology baseline (verify compatibility; obtain approval before material changes)

| Area | Choice | Notes |
| --- | --- | --- |
| Framework | Preferred web stack: Next.js App Router, React, strict TypeScript; exact versions verified against current stable compatibility before implementation | Google AI Studio Build mode documents a React web frontend with a Node.js server runtime by default. First run a small compatibility spike for the requested Next.js stack. Do not silently replace it; record a supported alternative and obtain approval if the environment cannot run the chosen stack. |
| Request boundary | `proxy.ts` (Node runtime) | Next.js 16 replaced `middleware.ts`. Export a function named `proxy`. Use it only for optimistic checks (session cookie present, locale, redirects). Real authorization lives in the data layer. |
| Async APIs | `await params`, `await searchParams`, `await cookies()`, `await headers()` | Synchronous access is removed in 16. |
| Caching | Cache Components (`cacheComponents: true`) with `use cache` only for public, non-personalized data | Everything personalized stays dynamic. Use `cacheLife` and `revalidateTag(tag, profile)` (two arguments in 16). |
| Styling | Tailwind CSS 4 (CSS-first `@theme`), shadcn/ui adapted for RTL, `class-variance-authority`, `tailwind-merge` | Use logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`). |
| Icons | `lucide-react` | Stroke 1.75. Mirror directional icons in RTL. |
| Motion | `motion` (Framer Motion), CSS transitions, View Transitions API | Every animation honors reduced motion. |
| Database | PostgreSQL with Drizzle ORM and migrations; production vendor is provisional pending a cost, reliability, data-location and exportability review | `pg_trgm` and `unaccent` extensions where supported. AI Studio may offer automatic Firebase/Firestore provisioning; do not accept that as a silent substitute for PostgreSQL/Drizzle. |
| Auth | **Better Auth** with the Drizzle adapter as the preferred baseline | Verify current compatibility and migration cost in the audit. Do not migrate a working authentication system in the first phase without a written security/maintenance reason and owner approval. Methods: email + password, username, Google, magic link (email provider), passkeys, TOTP 2FA. Phone OTP behind a `SmsProvider` interface (provider chosen later). |
| Realtime | Pusher Channels (private and presence channels) behind a `Realtime` interface | Auth endpoint at `/api/realtime/auth`. |
| Uploads | UploadThing for images, audio and files | Server-side MIME sniffing and size limits. |
| Video | A `VideoProvider` interface, implemented with Mux (direct upload, HLS, thumbnails, captions) | Swap later without touching UI. |
| Live, voice rooms, calls | LiveKit | Server tokens minted per user and room with minimal grants. |
| Background jobs | Inngest | Fan-out, notifications, media webhooks, moderation scans, digest emails. |
| Search | Postgres full-text search plus `pg_trgm`, with Arabic normalization | See 16.3. |
| Rate limiting | Upstash Redis with `@upstash/ratelimit` | Per IP, per user, per action. |
| Email | Resend with React Email templates |  |
| Bot protection | Cloudflare Turnstile on sign-up, login after failures, and report forms |  |
| Push | Web Push (VAPID) with a service worker (Serwist) |  |
| Validation | Zod everywhere (forms, actions, route handlers, env) |  |
| Client data | Server Components first, Server Actions for mutations, TanStack Query for infinite lists and optimistic updates, Zustand only for tiny UI state |  |
| Forms | react-hook-form with the Zod resolver |  |
| Profile design editor | Trusted visual editor plus a strict Zod-validated JSON configuration preview; no executable code editor in the profile-design publish path | Profile Canvas uses allowlisted settings rendered by IRQ-owned components. |
| User-content rendering | Framework text escaping and URL allowlist/linkification; DOMPurify only if a separately reviewed rich-text feature later requires HTML | Profile Canvas accepts JSON configuration only; no arbitrary user HTML/CSS/JavaScript. |
| Monitoring | Sentry, structured logs with pino |  |
| Quality | Vitest, Playwright, axe-playwright, Lighthouse CI, ESLint, Prettier, `knip` |  |
| Package manager | pnpm for the web project | Verify compatibility with the chosen AI Studio export/runtime. |
| Future native clients | Not selected yet | Reuse the versioned backend/API and design tokens. Select Android/iOS frameworks only in the native phase; record platform, developer tooling, store requirements and cost before implementation. |
| Hosting | Production hosting vendor is not chosen yet. Compare credible options for uptime, Iraq latency, total cost at staged user counts, data processing/storage location, backup/restore, portability and support. Prefer Iraqi-region infrastructure where it meets these criteria; accept a documented non-Iraqi region when it is more reliable or economical. Google AI Studio Preview/Cloud Run is a build/deployment option, not automatically the final IRQ production decision. Do not incur paid-service charges without owner approval. |

### 2.1 Environment variables (validate with Zod at boot; fail fast only for enabled services)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `UPLOADTHING_TOKEN`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_APP_URL`, `SENTRY_DSN`, `ANALYTICS_HOST`. Provide `.env.example` with comments and never commit real values. Require only variables for core services enabled in the current phase; provider-specific variables remain optional until that provider is approved and configured. Never fail the whole app boot because a disabled future feature has no secret.

## 3. Architecture

### 3.1 Folder structure

```
app/
  (marketing)/            landing, about, help, legal
  (auth)/                 login, register, verify, forgot, onboarding
  (app)/                  authenticated shell
    home/ explore/ reels/ video/ live/ messages/ communities/ market/
    notifications/ search/ compose/ u/[username]/ p/[id]/ settings/ wallet/ create/
  (admin)/admin/          moderation and operations
  api/                    webhooks, realtime auth, upload routes, health
components/ ui/ shell/ feed/ post/ chat/ media/ market/ profile/ canvas/ settings/
lib/ db/ auth/ dal/ actions/ realtime/ video/ search/ security/ i18n/ utils/
messages/ ar.json en.json
scripts/ seed.ts check-contrast.ts
docs/ DECISIONS.md ASSETS.md DESIGN_AUDIT.md SECURITY.md
tests/ unit/ e2e/
PROGRESS.md
```

### 3.2 Layering rules

- `lib/dal/*` is the only code that touches the database. It is marked `server-only`, takes the current user explicitly, and performs the authorization check inside every function (never trust the caller).
- A versioned `/api/v1/*` HTTP contract is the shared client boundary for PWA and future native clients. Validate every input and output with Zod, authenticate, authorize, rate-limit, call the domain/DAL layer and return a typed result `{ ok: true, data } | { ok: false, code, message }`. Publish an OpenAPI description and compatibility policy. Never throw raw errors to clients.
- Next.js Server Components may use the DAL for server-rendered reads. Mutations required by clients use the same domain service and authorization rules behind the versioned API; a feature must not exist only as a Server Action. Route handlers also own webhooks, uploads, realtime auth, push subscription and health.
- Feeds use cursor pagination (`createdAt` + `id`), never offset.
- Every mutating action is idempotent where possible (client-generated `clientId`).
- Soft delete with `deletedAt` for user content, hard delete jobs after the retention period.
- Feature flags table (`feature_flags`) so unfinished features ship dark.
- Errors: `error.tsx` and `not-found.tsx` per segment, plus `global-error.tsx`, all with Arabic copy and a retry button.


### 3.3 PWA-first and future-native client contract

The PWA is the first client, not a throwaway prototype. Keep all permission checks, business rules, notifications and data access in the shared server/domain layer. Every client-visible operation that a future native app will need is represented by a documented, versioned API or a separately documented realtime event. Use stable identifiers, cursor pagination, idempotency keys and explicit error codes. Do not expose database schema as the public API.

Keep web-specific code (Next.js rendering, service worker, browser permissions) separate from domain services and API contracts. Do not promise parity for OS features that are browser-dependent. The native phase may add platform push, camera/AR and background behaviors without changing authorization or core records. Google AI Studio Build supports a web full-stack mode and a separate native Android path; for this phase select web mode, sync/export source to GitHub, and do not let automatic Firebase setup replace the PostgreSQL/Better Auth decision. [1] [2]

## 4. Design system

UI/UX quality is the top priority of this product. Study and apply current best practice for readable Arabic interfaces, calm color, generous spacing and tasteful motion. The design must work for all ages and all education levels, so it favors clarity over decoration.

### 4.1 Themes and color tokens

Define every color as a semantic CSS variable. Components use only semantic names. Provide four themes: **light (رمال بغداد)**, **dark (بغداد كحّلة)**, **calm (هادئ)** and **high contrast (تباين عالٍ)**. The app follows the device by default, with a manual override in settings.

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#FAF9F7` | `#0A0F1A` |
| `--surface` | `#FFFFFF` | `#111827` |
| `--surface-2` | `#F3EFE8` | `#1A2333` |
| `--border` | `#E7E0D4` | `#263247` |
| `--text` | `#2A2622` | `#F1F5F9` |
| `--text-muted` | `#5F5A54` | `#A3B1C6` |
| `--primary` (buttons, rings) | `#0E7490` | `#22D3EE` |
| `--primary-fg` (text on primary) | `#FFFFFF` | `#04222B` |
| `--primary-text` (links, small text) | `#0A5568` | `#67E8F9` |
| `--accent` copper (large text, icons, highlights) | `#B45309` | `#F0A04B` |
| `--accent-text` (small copper text) | `#8A3F06` | `#F5B877` |
| `--success` | `#2F6B3F` | `#4ADE80` |
| `--warning` | `#8A5A00` | `#FBBF24` |
| `--danger` | `#B42318` | `#F87171` |
| `--info` | `#1D5C8A` | `#60A5FA` |
| `--ring` | `#0E7490` | `#22D3EE` |
| `--overlay` | `rgba(30,26,22,.55)` | `rgba(0,0,0,.65)` |
| `--glass-bg` | `rgba(255,255,255,.78)` | `rgba(17,24,39,.72)` |
| `--glass-border` | `rgba(14,116,144,.18)` | `rgba(255,255,255,.12)` |

Tints for soft backgrounds (badges, chips, verified marks): primary tint `#E3EDEF` (light) and `#0F2A33` (dark); accent tint `#F6E6D2` and `#3A2616`; success tint `#E4EEE5` and `#12301C`; danger tint `#FBE4E1` and `#3B1613`.

**Calm theme:** low saturation sepia-gray (`--bg #F4F1EA`, `--surface #FBF9F4`, muted primary `#3D6A78`), no pure white, reduced shadows, slower motion. **High contrast theme:** black or white backgrounds, 7:1 text contrast, 2px borders, no transparency or blur.

**Per-user accent:** 8 presets (teal default, copper, indigo, green, rose, violet, slate, gold). The system must auto-derive `--primary-fg` and `--primary-text` and reject any preset that fails contrast.

**Contrast rule:** write `scripts/check-contrast.ts` that reads every token pair used in the app and fails CI when normal text is below 4.5:1, large text below 3:1, or UI boundaries and icons below 3:1, in all four themes.

**Semantic color use:** copper is for commerce and highlights (prices, merchant badges, calls to action in the market), teal is for social actions (follow, send, links). Never use red for anything except danger and unread-critical badges. Never rely on color alone: pair with an icon or text.

### 4.2 Typography

- **Cairo** (variable, 400 to 800): all UI and body text. **Reem Kufi** (600 and 700): logo, page titles and display numbers only, never body. **Noto Naskh Arabic** (optional): long-form reading mode for articles.
- Arabic needs taller lines: body line-height 1.7, headings 1.35, buttons 1.2. Never use letter-spacing on Arabic.
- Scale (root 15px on mobile, 16px on desktop): xs 12, sm 13, base 15, lg 17, xl 20, 2xl 24, 3xl 30, 4xl 38. Titles on mobile never exceed 24px.
- **Text size setting:** 85% to 150% through a root variable `--font-scale`, applied to the whole interface. Test the layout at 150%.
- Numerals: setting for Arabic-Indic (٠١٢) or Western (012). Default Arabic-Indic for counts and dates, Western for phone numbers, codes and prices input. Use `Intl.NumberFormat('ar-IQ')`.
- Dates: Gregorian with Iraqi month names (كانون الثاني، شباط، آذار، نيسان، أيار، حزيران، تموز، آب، أيلول، تشرين الأول، تشرين الثاني، كانون الأول). Relative time with correct Arabic plurals ('قبل ساعتين', 'قبل ٣ أيام').
- Usernames, URLs, code and mixed Latin text are wrapped in `<bdi>` or `dir='ltr'` so punctuation does not jump.

### 4.3 Spacing, shape, depth

4px grid (4, 8, 12, 16, 20, 24, 32, 40, 56, 72). Radii: sm 8, md 12, lg 16, xl 20, 2xl 28, full 999. Cards have a 1px border and almost no shadow; elevation is for floating things only (sheets, menus, the bottom bar). **Glass** (bottom bar, desktop sidebar, sheets headers): `background: var(--glass-bg); backdrop-filter: blur(16px) saturate(140%); border: 1px solid var(--glass-border)`. If `backdrop-filter` is unsupported, or the user turns on 'reduce transparency', use a solid `--surface`. Z-index scale: base 0, sticky 10, bar 20, dropdown 30, sheet 40, modal 50, toast 60, canvas-guard 70.

### 4.4 Motion

Durations 120 / 200 / 320 / 480 ms. Easings: standard `cubic-bezier(.2,.8,.2,1)`, exit `cubic-bezier(.4,0,1,1)`. Micro-interactions: button press scale .97, like burst (heart pops with a small particle ring, 480 ms), follow button morph, bottom sheet spring, skeleton shimmer, tab indicator slide, story progress, page transitions with the View Transitions API (fade and slight slide, mirrored for RTL). **All motion respects `prefers-reduced-motion` and an in-app 'reduce motion' toggle** (replace movement with simple fades). No autoplaying motion longer than 5 seconds that cannot be paused.

### 4.5 Imagery, avatars, illustrations

- Avatars are circles. Fallback: first letter on a tinted circle, color derived from the user id from a palette of 8 tints that pass contrast. Story ring: 2.5px primary ring with a 3px gap; seen stories use a muted ring; merchants use a copper ring.
- Media aspect ratios: post media 4:5 default (allow 1:1, 16:9, 9:16), covers 3:1, video 16:9, reels 9:16. Use blurhash placeholders and `next/image` with responsive `sizes`.
- Illustrations and empty states: find openly licensed SVG sets (for example unDraw-style) and recolor with CSS variables so they follow the theme. Use Lottie only for success, loading and celebration moments, lazy loaded, with a static fallback for reduced motion. Record licenses in `/docs/ASSETS.md`.
- Sounds (optional, off by default): short message-sent, notification and like sounds, with a master toggle.

### 4.6 Component inventory

Build or adapt every one of these with all states (default, hover for pointer devices only, focus-visible, active, disabled, loading, error):

Button (primary, secondary, ghost, outline, danger, link, icon; sm, md, lg; loading spinner), Input, Textarea (auto-grow), Select, Combobox, Checkbox, Radio, Switch, Slider, Tabs, SegmentedControl, Chip, Badge, Avatar, AvatarStack, StoryRing, Card, Sheet (bottom sheet on mobile, side panel on desktop), Dialog, Drawer, Popover, DropdownMenu, ContextMenu (long-press on touch), Tooltip (pointer devices only), Toast (sonner), Skeleton, EmptyState, ErrorState, OfflineBanner, InfiniteList (virtualized), MediaViewer (lightbox with swipe, pinch zoom, keyboard), Carousel, VideoPlayer (custom controls, captions, speed, quality, picture-in-picture, keyboard shortcuts), AudioPlayer with waveform for voice notes, EmojiPicker, MentionPicker, HashtagPicker, ReactionPicker, ShareSheet, ReportDialog, ConfirmDialog, DatePicker (Gregorian, Iraqi names), Stepper, DataTable and Pagination (admin only), CopyField, QRCode, CodeEditor, ColorPicker, ImageCropper (avatar and cover), ProgressBar, Rating, MoneyInput and Money display (IQD, no decimals), PhoneInput (+964 default).

Touch targets are at least 44x44px. Focus ring: 2px `--ring` with 2px offset on every interactive element. Hover styles exist only inside `@media (hover: hover)`.

### 4.7 Responsive shells (mandatory behavior)

Breakpoints: 360 (small phones), 480, 768 (tablet), 1024, 1280 (desktop), 1536, 1920, 2560. Content never stretches beyond its max width. Test at 320, 360, 390, 768, 1024, 1280, 1536, 1920 and 2560.

**Mobile (below 768):**

- Top header, 56px: centered logo; at the start side a 'منشور جديد' icon button (plus in a rounded square); at the end side the notifications bell with an unread dot. On inner pages the header becomes a back button, a title, and contextual actions.
- Floating glass **bottom bar**, icons only, five equal tabs: الرئيسية, ريلز, المحادثات (same slot & outline style as the other four tabs, with an unread badge), السوق, الملف الشخصي. Active tab uses `--primary` and a small dot. The bar floats 16px above the bottom with the safe-area inset, max width 340px, and **docks to the user's handedness side** (right-handed = 16px from physical right edge, left-handed = 16px from physical left edge, center = centered). It hides on scroll down and returns on scroll up (can be turned off in settings). Long-press the chat tab (500 ms) opens the recent-chats sheet; this shortcut is invisible and does not change the tab's appearance.
- Pages have bottom padding equal to the bar height so nothing is hidden behind it.

**Tablet (768 to 1199):** a 72px glass rail on the start side with icons, labels appear on focus or hover; one content column up to 680px centered; side panels open as sheets.

**Desktop (1200 and above):** a 264px glass sidebar on the start side (logo, nav items with labels and badges, a full-width 'منشور جديد' button, a mini account card with a switch-account menu); a center column 600 to 680px; an end-side panel 340px with search, trends, who to follow, and merchants near you. From 1600px the gutters grow; from 2000px containers scale up but keep readable line lengths. Chat and Communities become multi-pane layouts on desktop (list, thread, details).

**RTL:** `dir='rtl'` on `<html>`. Use logical properties only. Mirror directional icons (arrows, back, forward, send, reply). Keep media controls order consistent with the device convention (play button stays at the same place users expect, timelines run right to left). Test with long Arabic words, mixed Arabic and English, emoji, and 150% text size.

## 5. Data model (Drizzle schema)

Use UUID v7 primary keys, `createdAt` and `updatedAt` on every table, `deletedAt` for user content. Add indexes on every foreign key and on every column used in a feed or list query. Tables (columns listed are the minimum):

**Identity:** `users` (id, username unique lowercase 3-30 chars `[a-z0-9_.]`, displayName, email, emailVerifiedAt, phone nullable, passwordHash handled by the auth library, avatarUrl, coverUrl, bio 160 chars, website, location text, province enum of the 19 Iraqi governorates, birthDate nullable, gender nullable and optional, accountType enum personal|creator|merchant, isVerified, verifiedKind enum none|identity|merchant|official, status enum active|suspended|deactivated|pending\_delete, lastSeenAt, handedness enum right|left|center), `sessions`, `accounts`, `verifications`, `passkeys`, `two_factor`, `devices` (userId, label, userAgentHash, lastIpHash, lastActiveAt, pushSubscription), `user_settings` (userId, jsonb validated by a Zod schema, versioned), `user_blocks` (blockerId, blockedId), `user_mutes` (userId, target kind user|word|hashtag|community, value, until), `follows` (followerId, followingId, status enum active|pending), `close_friends`, `profile_links` (userId, label, url, order), `profile_views` (optional, off by default).

**Content:** `posts` (id, authorId, kind enum media|text|video|reel|poll|article|repost|quote, text up to 5,000, language, visibility enum public|followers|close\_friends|private|community, communityId nullable, replyToId nullable, rootId nullable for threads, quoteOfId, repostOfId, locationText, province, commentsMode enum all|followers|mentioned|off, allowRepost, isPinned, isSensitive, scheduledAt, publishedAt, editedAt, counters likeCount commentCount repostCount shareCount viewCount saveCount stored denormalized and updated by jobs), `post_media` (postId, kind image|video|audio, url, blurhash, width, height, durationMs, altText, order, videoAssetId), `post_products` (postId, productId, x, y for tags), `polls`, `poll_options`, `poll_votes`, `hashtags`, `post_hashtags`, `mentions`, `likes` (userId, targetKind, targetId, reaction enum like|love|haha|wow|sad|care), `comments` (postId, authorId, parentId, text, mediaUrl, likeCount, isPinnedByAuthor), `saves` (userId, postId, collectionId), `collections`, `reposts`, `reports`, `post_edits` (history).

**Stories:** `stories` (id, authorId, kind image|video|text, mediaUrl, text, background gradient key, stickers jsonb, audience enum all|close\_friends|custom, expiresAt = createdAt + 24h, isHighlighted), `story_views`, `story_replies`, `highlights` and `highlight_items`.

**Messaging:** `conversations` (kind dm|group|channel|community\_room, title, avatarUrl, createdBy, lastMessageId, isMuted per member elsewhere, disappearingSeconds nullable), `conversation_members` (role owner|admin|moderator|member|subscriber, mutedUntil, lastReadMessageId, pinnedAt, archivedAt, notifications level), `messages` (conversationId, senderId, kind text|image|video|audio|voice|file|sticker|location|contact|post\_share|product\_share|order\_card|system|poll, text, replyToId, forwardedFromId, editedAt, deletedForAll, expiresAt, clientId unique per sender), `message_receipts` (delivered, read), `message_reactions`, `message_attachments`, `message_pins`, `invite_links`, `chat_folders`.

**Communities:** `communities` (slug, name, description, iconUrl, bannerUrl, privacy public|private|hidden, rules jsonb, province nullable), `community_members` (role, status, joinedAt), `community_channels` (kind text|voice|announcement|forum, name, order, permissions jsonb), `community_roles` (name, color, permissions bitmask), `community_events`, `community_bans`.

**Video and live:** `video_assets` (providerId, status, duration, ratio, thumbnailUrl, captionsUrl), `videos` (long video metadata: title, description, chapters jsonb, categoryId, visibility), `playlists`, `playlist_items`, `live_streams` (hostId, title, status scheduled|live|ended, roomName, startedAt, endedAt, peakViewers, chatConversationId, productIds), `live_gifts`, `watch_history` (optional and clearable), `video_progress`.

**Market:** `shops` (ownerId, slug, name, logoUrl, bannerUrl, about, province, city, phoneForOrders, workingHours jsonb, policies jsonb, verifiedAt, ratingAvg, ratingCount, status), `products` (shopId, title, description, priceIqd integer, compareAtPriceIqd, currency fixed IQD, categoryId, condition new|used, stock, sku, status draft|active|sold\_out|archived, province, tags), `product_media`, `product_variants`, `categories` (tree), `carts` and `cart_items`, `orders` (buyerId, shopId, status placed|accepted|preparing|ready|completed|cancelled|disputed, totalIqd, paymentMethod cash\_on\_meet|bank\_transfer|other\_manual|t\_coins\_voucher, buyerNote, sellerNote, meetingInfo text, since there is no delivery service the order records how buyer and seller agree to hand over the goods), `order_items`, `order_events`, `reviews` (verified purchase only), `shop_followers`, `shop_announcements`, `wishlists`.

**Economy (virtual):** `wallets` (userId, balance integer T-Coins), `wallet_transactions` (append-only ledger, kind, amount, refId, balanceAfter), `gifts_catalog`, `creator_payout_requests` (stub only).

**Canvas (section 14):** `canvases`, `canvas_versions`, `canvas_assets`, `canvas_forks`, `canvas_stars`, `canvas_reports`, `canvas_scans`.

**Platform:** `notifications` (userId, kind, actorId, targetKind, targetId, groupKey, readAt, data jsonb), `notification_preferences`, `push_subscriptions`, `audit_logs`, `moderation_actions`, `appeals`, `feature_flags`, `rate_limit_events` (if not only Redis), `data_export_jobs`, `deletion_jobs`, `webhook_events` (idempotency), `search_documents` (denormalized text for FTS), `trending_snapshots`, `invites`, `referrals`, `announcements`.

Future-phase tables (bots, camera effects) are added only when their feature phase is approved; they must use allowlisted declarative definitions and must not create a generic user-code execution service.

Seed script creates: 30 users (various roles), 6 communities, 5 shops with 40 products, 200 posts of all kinds using licensed sample media, stories, conversations, and 3 safe JSON profile designs. Seed runs only outside production.

## 6. Authentication, onboarding and account pages

All auth pages are centered cards on mobile (full width, 16px padding) and a two-column layout on desktop (form at the start side, a calm illustration and three short value points at the end side). Every form has inline validation in Arabic, a visible show/hide password toggle, and never loses typed data on error.

### 6.1 `/login`

Fields: email or username, password. Buttons: 'تسجيل الدخول' (primary, loading state), 'الدخول بـ Google', 'الدخول برابط سحري' (magic link), 'الدخول بمفتاح المرور (Passkey)'. Links: 'نسيت كلمة المرور؟', 'إنشاء حساب جديد'. Rules: generic error text ('البيانات غير صحيحة') so accounts cannot be enumerated; after 3 failures show Turnstile; after 8 failures lock for 15 minutes; if 2FA is on, show the code step.

### 6.2 `/register` (three short steps)

1. Email or phone, password with a strength meter (minimum 10 characters, check against common-password list), Turnstile, acceptance of terms and privacy (links). 2. Verify email with a 6-digit code (resend after 45 seconds). 3. Username (live availability check, suggestions), display name, birth date (ask only to enforce the minimum age of 13 and to apply safer defaults under 18; never show it publicly unless the user chooses). Account type chooser: 'شخصي', 'مبدع', 'تاجر' with one-line explanations. Users under 18 get private-by-default accounts, no DMs from strangers, no live streaming, no market selling.

### 6.3 `/onboarding` (skippable, resumable)

Steps: profile photo with cropper; short bio; choose province; pick interests (24 topic chips); follow suggestions (people, merchants, communities in the chosen province); import contacts (optional, hashed matching, explicit permission); choose appearance (theme, text size, handedness for the bottom bar, with a live preview); allow notifications (explain value first, then the browser prompt). Final screen shows a short interactive tour with four coach marks (compose, stories, chat, market).

### 6.4 Other account pages

`/forgot` and `/reset` (rate limited, tokens expire in 30 minutes, single use). `/verify-email`. `/two-factor` (TOTP and backup codes). `/account-recovery`. `/suspended` (reason, appeal button). `/deactivated` (reactivate). `/delete-pending` (30-day grace with cancel button). `/invite/[code]`.

## 7. The application shell and navigation

Shell components: `AppHeader` (mobile), `BottomBar` (mobile), `SideRail` (tablet), `Sidebar` (desktop), `RightPanel` (desktop), `CommandPalette` (desktop, opens with Ctrl/Cmd+K: search people, posts, communities, products, settings, and actions like 'منشور جديد'), `OfflineBanner`, `InstallPrompt` (PWA, shown after meaningful use, dismissible), `ToastRegion`, `GlobalComposerSheet`, `MediaViewerHost`, `CallBar` (floating bar when in a call or live room, visible on every page).

**Navigation items and destinations:** الرئيسية `/home`, استكشاف `/explore`, ريلز `/reels`, فيديو `/video`, مباشر `/live`, المحادثات `/messages`, المجتمعات `/communities`, السوق `/market`, الإشعارات `/notifications`, المحفظة `/wallet`, الملف الشخصي `/u/[username]`, الإعدادات `/settings`. On mobile the bottom bar holds five of these and the rest live in a 'المزيد' sheet reached from the profile tab menu or the sidebar on bigger screens.

**Desktop sidebar order:** الرئيسية, استكشاف, ريلز, فيديو, مباشر, المحادثات (badge), المجتمعات, السوق, الإشعارات (badge), المحفظة, الملف الشخصي, then a 'منشور جديد' button and the account card. Active item: tinted background, primary text, a 3px start-side indicator.

**Keyboard shortcuts (desktop):** `g h` home, `g m` messages, `n` new post, `/` search, `?` shortcuts help, `j` and `k` next and previous post, `l` like, `c` comment, `s` save, `Esc` closes layers. Shortcuts are listed in a dialog and can be disabled in settings.

## 8. Home feed `/home`

**Layout:** stories row, filter chips, then the feed. Pull-to-refresh on mobile; a 'منشورات جديدة' pill appears when new posts arrive while scrolling.

**Stories row:** first item 'قصتك' (dashed ring, plus icon) opens the story creator. Then followed users with unseen stories first, merchants with a copper ring. Horizontal scroll with snap, no scrollbar. Tapping opens the story viewer (8.4).

**Filter chips (sticky under the header):** الكل (ranked), المتابَعون (chronological, only people followed), محافظتي (posts from the user's governorate), تجار (merchant posts and ads), مجتمعاتي. The last chosen chip is remembered.

**Ranking v1 (simple and explainable):** score = freshness decay + relationship strength (follow, close friend, recent interactions) + engagement rate + province match + diversity penalty (no more than 2 posts in a row from one author) minus penalties for reported or muted content. A 'لماذا أرى هذا؟' item in every post menu explains the top reason. Provide a setting to switch to a purely chronological feed.

### 8.1 Post card (all kinds) — edge to edge on mobile

On mobile the media runs from screen edge to screen edge with no card border or side padding (like a modern photo feed); text-only posts sit on a white surface separated by hairlines. On desktop the card is 600 to 680px wide with rounded corners.

**Header:** avatar (story ring if active), display name (verified mark), second line: location and time, or the audio track for media posts. End side: 'المزيد' (three-line menu icon). **Menu items:** حفظ, نسخ الرابط, مشاركة عبر محادثة, لماذا أرى هذا؟, إخفاء هذا المنشور, كتم الحساب, إلغاء المتابعة, حظر, إبلاغ; for the owner: تعديل, تثبيت في الملف, تغيير من يستطيع التعليق, إخفاء عدد الإعجابات, أرشفة, حذف (with confirm).

**Media area:** single image, carousel (up to 10, counter badge '١/٥' on the top corner, dots below, swipe, arrow keys on desktop), or inline video. Double tap or double click likes with the heart burst. A mute toggle on videos (remembers the choice), autoplay only on Wi-Fi or when data saver is off, and only the most visible video plays. A small bag button on the media corner opens the tagged products sheet when the post has products (name, price in IQD, 'اطلب' and 'عرض المتجر'). Alt text is shown to screen readers and via an 'ALT' badge.

**Action row (icons only, 44px targets):** إعجاب (long-press or hover opens the reaction picker with 6 reactions), تعليق (opens comments), إعادة نشر (menu: إعادة نشر, اقتباس), مشاركة (opens ShareSheet), and حفظ at the far end (long-press chooses a collection). Counts appear under the row as 'أعجب به علي و٢٣ آخرين' and 'عرض ٢٤ تعليقاً'. Below: caption with clamp to 3 lines and 'المزيد', hashtags and mentions as links, then the relative time.

**Text post (short text and threads):** larger text (17px, line-height 1.8), up to 5,000 characters with 'read more' after 6 lines, link preview card, optional poll, 'سلسلة · ٣ منشورات' chip that opens the thread view. Actions: رد, إعادة نشر, إعجاب, مشاركة, حفظ with small counts.

**Long video post:** 16:9 player at the full width, big play button, duration badge, title (2 lines), channel line, views count, and the same actions. Opens `/video/[id]`.

**Poll post:** 2 to 4 options, duration (1 hour to 7 days), results visible after voting or after it ends, one vote per user, ability to see who voted only for the owner when the poll is not anonymous.

**Repost and quote:** a small header line 'أعاد نشره فلان', quote shows the original in a nested card.

**Sensitive content:** blurred with a 'محتوى حساس' overlay and a 'عرض' button; users can turn this off in settings.

**Sponsored post (merchants):** clear 'إعلان' label, merchant ring, product strip with price and 'اطلب'. No more than one sponsored post per 8 organic ones.

**States:** skeleton cards while loading, 'لا توجد منشورات بعد' empty state with follow suggestions, error card with retry, offline cached feed (last 30 posts) with a banner.

### 8.2 Comments (sheet on mobile, panel on desktop)

Sorted by 'الأكثر ملاءمة' (default), 'الأحدث', 'المتابَعون'. Each comment: avatar, name, text, time, 'إعجاب', 'رد', menu (نسخ, إبلاغ, حذف, حظر, and for the post owner تثبيت). Replies are nested one level with 'عرض ٣ ردود'. Composer pinned at the bottom with emoji, mention picker, GIF/sticker button (phase 8), image attach, send button disabled when empty. Optimistic insert with retry on failure. Mentioned users get notified.

### 8.3 Post detail `/p/[id]`

Full post, threaded comments, related posts, and a share button with the canonical URL and Open Graph image so links look good when pasted into other apps (generate OG images with `next/og`, Arabic font embedded). Threads render as a vertical line connecting posts of the same author.

### 8.4 Story viewer and creator

**Viewer:** full screen, progress bars at the top (images 5 seconds, videos up to 60), tap end side or start side for next and previous (mirrored for RTL), hold to pause, swipe down to close, swipe up for replies, 'أرسل رسالة' input with quick reactions, three-dots menu (كتم, إبلاغ, مشاركة عبر محادثة), and for owners a viewers list with 'حذف' and 'حفظ في المميّزات'. Keyboard: arrows and space. Product sticker opens the product sheet. **Creator `/create/story`:** camera or gallery, text mode with gradient backgrounds, stickers (poll, question, mention, location, time, product for merchants), drawing tool, text styles using Arabic-friendly fonts, audience picker (الجميع, الأصدقاء المقربون, مخصص), 'شارك' button. Stories expire after 24 hours; highlights keep them.

### 8.5 Composer `/compose` (sheet on mobile, dialog on desktop)

Type switcher at the top: منشور (media), نص, فيديو, ريل, استطلاع, قصة, مباشر, منتج (merchants). Common parts: auto-growing text field with character counter (turns warning at 90%), mention and hashtag suggestions, emoji picker, media picker with reorder by drag, per-image alt text and crop, location (province and city text, no GPS required), audience (الجميع, المتابعون, الأصدقاء المقربون, مجتمع معين), comments setting, allow reposts toggle, sensitive toggle, schedule (date and time picker), save as draft (auto-saves every 5 seconds), 'نشر' button with upload progress, and a confirm-on-exit dialog if there are unsaved changes. Video upload shows progress, processing state, and a thumbnail picker. Product tagging lets merchants tap on the image to place tags.

### 8.6 Explore `/explore` and Search `/search`

**Explore:** search bar, topic chips, a grid of trending media (3 columns mobile, 5 desktop, mixed sizes), 'الأكثر تداولاً في محافظتك', suggested people, communities, shops. **Search:** tabs الكل, الأشخاص, المنشورات, الوسوم, الفيديو, المجتمعات, السوق, المتاجر. Recent searches (clearable), suggestions while typing, filters (province, time, media only), and spell tolerance for Arabic (see 16.3).

### 8.7 Notifications `/notifications`

Tabs: الكل, التفاعلات, المشاركات (mentions), الطلبات (orders), النظام. Grouped items ('أعجب بمنشورك علي و٥ آخرون'), time sections (اليوم, هذا الأسبوع, أقدم), follow-request approve and decline buttons inline, 'تعليم الكل كمقروء', per-item menu (حذف, إيقاف هذا النوع), realtime updates through Pusher, browser push when the tab is closed and permission is granted. Kinds: like, reaction, comment, reply, mention, follow, follow request accepted, repost, quote, story reply, story mention, message request, community invite, community post approved, live started by someone followed, order placed, order status changed, review received, price drop on a wishlist item, gift received, canvas starred or forked, canvas approved or rejected by moderation, security alert (new device login), system announcement.

## 9. Messaging `/messages`

**Layout:** mobile shows the conversation list, and a tapped conversation opens full screen with a back button. Tablet and desktop show panes: list (360px), thread (flexible), details (320px, toggled by the info button). Deep links: `/messages/[conversationId]`.

### 9.1 Conversation list

**Header:** title 'المحادثات', 'محادثة جديدة' button, search field ('ابحث بالمحادثات والأشخاص'). **Filter chips:** الكل, شخصية, مجموعات, قنوات, مجتمعات, تجار, غير مقروء, plus user-made **folders** ('مجلد جديد' with included chats). **Sections:** 'مثبتة' (up to 5), 'طلبات المراسلة' (messages from people not followed: accept, delete, block, report; content is hidden until accepted), 'المؤرشفة'.

**Row:** avatar with optional online dot (only if both sides allow), name with verified mark, last message preview (sender prefix in groups, 'صورة', 'رسالة صوتية 0:12', 'ملف'), time (today shows clock time, then weekday, then date), unread badge in primary (muted chats use gray), delivery ticks for the user's own last message, a typing indicator 'يكتب الآن...', a draft marker 'مسودة:', and for merchant chats an order chip such as 'طلب #1042 — قيد التجهيز'. **Mobile swipe actions:** swipe toward the end: pin, mute; toward the start: archive, delete. **Desktop:** hover reveals a menu button; right click opens the same menu (تثبيت, كتم, أرشفة, تعليم كمقروء, حذف, حظر).

**New chat sheet:** search people, suggested contacts, and three shortcuts: 'مجموعة جديدة', 'قناة جديدة', 'مجتمع جديد'. Group creation: pick members, name, icon, optional description, disappearing timer.

### 9.2 Thread

**Header:** back (mobile), avatar, name, status line ('متصل الآن', 'آخر ظهور قبل ساعة', or 'يكتب...', hidden when privacy forbids), voice call button, video call button, menu. **Menu:** معلومات المحادثة, بحث في المحادثة, كتم الإشعارات, الرسائل المختفية (معطّل، 24 ساعة، 7 أيام، 90 يوماً), خلفية المحادثة, تصدير المحادثة, مسح المحادثة, حظر, إبلاغ.

**Message list:** grouped by day with date chips (Iraqi month names), a 'رسائل غير مقروءة' divider, a floating 'للأسفل' button with unread count, loading older messages upward with no jump, and a sequence number per conversation for ordering. **Bubbles:** own messages on the end side in primary tint, others on the start side in surface color; radius 18 with a smaller corner toward the sender; consecutive messages from one sender are grouped with only the last showing the time; max width 78% on mobile, 560px on desktop.

**Message kinds:** text (links become previews; Arabic and English mixed correctly), image and video (grid for several, tap opens the viewer), voice note (waveform, play, speed 1x/1.5x/2x, transcript later), file (name, size, type icon, download), location (map thumbnail, text only in v1), contact card, sticker, poll, shared post, shared product, order card (status and 'view order'), system messages (joined, left, renamed, timer changed), deleted placeholder ('تم حذف هذه الرسالة').

**Message actions** (long-press on touch, right-click on desktop, a hover toolbar on desktop): رد (also swipe toward the start), تفاعل (6 quick reactions plus more), إعادة توجيه, نسخ, تثبيت, حفظ (star), تعديل (own text within 15 minutes, shows 'edited'), حذف (لدي فقط / لدى الجميع within 48 hours), تحديد متعدد (multi-select with forward, delete, copy), إبلاغ. **Receipts:** one tick sent, two ticks delivered, two primary ticks read; users can turn read receipts off (then they also lose seeing others').

**Composer:** auto-growing text field (max 6 lines then scroll), emoji button opening a panel (emoji, stickers, GIFs in a later phase), attach button opening a menu (صورة وفيديو, كاميرا, ملف, موقع, جهة اتصال, استطلاع, منشور, and for merchants منتج), a send button that morphs into a microphone when the field is empty: hold to record, slide toward the start to cancel, slide up to lock hands-free, visible timer and waveform, release to send. Enter sends on desktop and Shift+Enter makes a new line (configurable). Reply preview and edit mode bars sit above the field with a close button. Drafts autosave per conversation. Uploads show progress with a cancel button. Failed messages show a red retry icon and are queued while offline.

### 9.3 Details pane (and sheet on mobile)

**Direct chat:** large avatar, name, username, bio, buttons (ملفه, كتم, بحث), shared media tabs (وسائط, ملفات, روابط, موسيقى), common groups, disappearing messages, block and report. **Group:** name and icon edit, description, member list with roles and a search field, 'إضافة أعضاء', invite link (create, copy, share QR, reset, optional join approval, optional expiry and use limit), permissions (who can send, send media, add members, edit info, pin), admin tools (promote, demote, remove, ban), 'مغادرة المجموعة', 'إبلاغ'. Group size limit 1,000. **Channel:** subscribers count, only admins post, per-post views and reactions, optional discussion group for comments, scheduled posts, post signatures toggle, subscribers can mute or leave. Public channels have a short link and appear in search.

### 9.4 Calls (LiveKit)

1:1 voice and video calls first, group calls up to 8 later. **Outgoing/incoming:** full-screen incoming call on mobile with accept and decline and a quick text reply, a banner on desktop, ringtone (toggle), missed-call system message in the thread. **In call:** large remote view, self-view tile (draggable), controls: mute, camera, flip camera, speaker, screen share (desktop browsers), reactions, add person (group), end call (red). Network quality indicator and automatic audio-only fallback. Permission prompts explain why before the browser asks, and show recovery steps when denied. Ringing works while the tab is open or through Web Push; document this honestly in the UI ('افتح تواصل لاستقبال المكالمات').

### 9.5 Privacy, safety and honesty

- **Encryption wording:** v1 protects chats in transit (TLS) and at rest. Do NOT show 'end-to-end encrypted' anywhere until it is truly implemented. Show a small lock line: 'محادثتك محمية أثناء النقل والتخزين'. A later phase may add optional 'secret chats' with end-to-end encryption; design the message schema so a ciphertext field can be added.
- Who can message me: الجميع, المتابعون فقط, لا أحد. Under 18: only people they follow or who follow them. Media from strangers is blurred until accepted.
- Anti-spam: new accounts may start at most 20 new conversations per day; link and phone-number patterns in first messages are scored; repeated identical messages are throttled; users can report with the last 10 messages attached as evidence.
- Delivery: write to the database first (idempotent by `clientId`), then publish on Pusher. Channels: `private-user-{id}` (notifications, list updates), `private-conv-{id}` (messages, typing, receipts). Use presence channels only for open voice rooms and live chat to control cost. On reconnect fetch missed messages with `after=sequence`.

## 10. Communities `/communities`

The Discord-like space: persistent groups with channels, roles and voice rooms.

**Discovery `/communities`:** search, topic chips, 'مجتمعات في محافظتك', 'الأكثر نشاطاً', 'مقترحة لك', a 'my communities' strip, and a 'إنشاء مجتمع' button. **Create flow:** name, link slug (availability check), icon and banner, privacy (عام, خاص بطلب انضمام, مخفي بدعوة), topic, province (optional), rules list, starter channels template (عام, إعلانات, نقاش, غرفة صوتية).

**Community home:** banner, icon, name, member count, 'انضمام' button (becomes 'طلب انضمام' for private, 'منضم' with a menu for members), tabs: الرئيسية (community feed of posts), القنوات, الأعضاء, الفعاليات, عن المجتمع, الإعدادات (admins). Desktop uses three panes: channel list, channel content, members list.

**Channel types:** نصية (chat like groups, with threads), إعلانات (read-only for members), منتدى (forum: each topic is a thread with title, tags, pinned topics, solved mark), صوتية (voice room). Every channel supports pinned messages, slow mode (off to 6 hours), permissions overrides, and a mention picker with @everyone limited to roles that may use it.

**Voice rooms (LiveKit):** join button shows a participant list; in room: tiles with a speaking ring animation, controls (كتم, صمت, مشاركة الشاشة on desktop, رفع اليد, مغادرة), push-to-talk option, noise suppression toggle, a floating mini-bar (`CallBar`) while browsing elsewhere, limit 25 speakers. **Stage mode** for events: speakers and audience, hand raising, host invites to speak.

**Roles and permissions:** roles with name, color, order and a permission matrix: view channels, send messages, attach files, embed links, add reactions, mention everyone, manage messages, kick, ban, manage channels, manage roles, manage events, manage community, speak in voice, move members, bypass slow mode. Default roles: المالك, مشرف, مساعد, عضو, جديد.

**Moderation tools:** AutoMod (blocked words, link allow-list, new-member restrictions for the first 10 minutes), reports queue, ban list with appeal, audit log (who did what), welcome screen, rules acceptance gate, verification level (none, verified email, account older than 5 minutes, older than 10 minutes), message cleanup tools. **Events:** create (title, time, channel or place, description, cover), RSVP ('مهتم', 'سأحضر'), reminders 1 hour before. **Invites:** links with expiry and use limits, QR code.

## 11. Reels, long video and live

The three video experiences share one top segmented control: **ريلز | مباشر | فيديو**, shown over the content on mobile and as page tabs on desktop.

### 11.1 Reels `/reels`

Full-viewport vertical feed with scroll snapping (mouse wheel, arrow keys, swipe). Each item: HLS video with adaptive bitrate, first frame poster, loop. **Action rail (end side):** creator avatar with a follow plus, إعجاب, تعليق (opens comments sheet), مشاركة, هدية (virtual gift, phase 8), حفظ, المزيد. **Bottom info:** creator name with verified mark, follow button, caption (2 lines with expand), audio name (opens the sound page), and for merchants a product card with price and 'اطلب'. **Controls:** tap to pause, double tap to like with heart burst, hold for pause, a scrubbable progress bar, mute toggle (remembered), captions toggle, speed menu (0.5x to 2x), 'لست مهتماً' and 'لماذا أرى هذا؟' in the menu. Preload the next two items only; data saver caps quality at 480p and disables preloading. Desktop: a centered 9:16 player about 420px wide with the rail beside it and up and down buttons; shortcuts `j` and `k`, `space`, `m`, `l`, `c`.

**Create `/create/reel`:** upload or record (MediaRecorder where supported), trim, speed, a few filters, text and stickers overlay, captions (auto-captions via the video provider when available), cover picker, audio (original or a library of royalty-free sounds that you find and license; list in ASSETS.md), product tag, audience, comments setting, 'نشر'.

### 11.2 Long video `/video`

**Home:** category chips (الكل, تعليم, تقنية, ترفيه, رياضة, طبخ, أخبار, موسيقى, ألعاب), a responsive grid (1 column on phones, 2 on tablets, 3 to 4 on desktop). **Card:** 16:9 thumbnail with duration badge, channel avatar, title (2 lines), channel name, views and time, menu (حفظ للمشاهدة لاحقاً, أضف إلى قائمة, مشاركة, لست مهتماً, إبلاغ).

**Watch page `/video/[id]`:** player with play and pause, seek bar with chapter markers and hover preview, volume, speed (0.5x to 2x), quality (auto, 1080, 720, 480, 360, 240), captions, picture-in-picture, theater mode, fullscreen, resume from last position, mini-player when scrolling away on mobile, keyboard shortcuts (`k`, `j`, `l`, `f`, `m`, `c`, arrows, digits). Under the player: title, channel row (avatar, name, subscribers, 'تابع' and a bell for notifications), actions (إعجاب, مشاركة, حفظ في قائمة, إبلاغ), collapsible description with chapters as links, comments (same component as posts), 'up next' list on the end side on desktop, and an autoplay-next toggle. **Playlists** `/video/playlist/[id]`. **Studio `/studio`:** upload with title, description, chapters editor, thumbnail upload or pick, category, visibility (عام, غير مدرج, خاص), schedule, captions upload; list of videos with status; basic analytics (views, watch time, followers gained, top videos).

### 11.3 Live `/live`

**Browse:** 'مباشر الآن' grid with viewer counts and a red live badge, categories, a 'من تتابعه' row, scheduled streams with reminder buttons.

**Watch `/live/[id]`:** player (WebRTC or HLS via LiveKit egress) with a quality menu, a chat panel (end side on desktop, bottom half sheet on mobile with a toggle) showing messages, pinned message, moderator badges, slow mode and followers-only chat indicators; a gifts bar (virtual gifts, full-screen animation overlay, disabled in reduced motion mode), a viewer count, follow, share, report. For merchants a product carousel with 'اطلب'. **Go live `/live/start`:** title, category, cover, audience, chat settings (slow mode, followers only, banned words), attach products, camera and microphone test with a preview, 'ابدأ البث' button. **Host controls:** mute, camera, flip, end stream (confirm), moderators list, timeout and ban in chat, pin product, a post-stream summary (peak viewers, duration, gifts, new followers). **Rules:** users under 18 cannot go live; new accounts need a verified email; the feature flag can require a minimum follower count.

## 12. Market and wallet

IRQ تواصل is a place where merchants sell directly in IQD. **There is no delivery service and no payment processing in this scope.** The buyer and seller agree on handover and payment, and the interface says so clearly ('المنصة لا تتولى التوصيل أو الدفع، اتفق مع البائع').

### 12.1 Market home `/market`

Province chip at the top (tap to change), search field, category chips, banner 'من محافظتك', sections (جديد, الأكثر طلباً, عروض, متاجر موثّقة, قريب منك), a floating 'افتح متجرك' button for non-merchants. **Product card:** square image, title (2 lines), price in copper bold formatted like '١٢٥٬٠٠٠ د.ع', shop name with verified mark and city, wishlist heart, badges (جديد, مستعمل, نفدت الكمية, خصم ٪). Grid: 2 columns on phones, 3 on tablets, 4 to 5 on desktop.

**Filters sheet:** category tree, price range slider (IQD), condition, province and city, rating, verified shops only, in stock only. **Sort:** الأحدث, الأقل سعراً, الأعلى سعراً, الأقرب, الأعلى تقييماً. Saved searches with alerts (later).

### 12.2 Product page `/market/p/[id]`

Gallery (swipe, pinch zoom, video, thumbnails on desktop), title, price with compare-at price struck through, variants as chips (size, color) with stock per variant, stock status, shop card (logo, name, verified, rating, average response time, 'متابعة', 'مراسلة'), description, specifications, reviews summary with photo reviews (verified purchases only), questions and answers, similar products, share, report listing. **Sticky bottom bar:** 'اطلب الآن' (copper primary), 'مراسلة البائع', wishlist.

### 12.3 Cart, checkout and orders

**Cart `/market/cart`:** items grouped by shop with quantity steppers, remove, saved for later, per-shop subtotal, and a note that each shop is a separate order. **Checkout `/market/checkout`:** buyer name and phone (prefilled, editable), handover method offered by the seller ('استلام من المتجر' or 'اتفاق مع البائع'), payment method chosen from what the seller accepts (دفع عند الاستلام, تحويل مصرفي with the seller's instructions, other), note to seller, order summary, 'تأكيد الطلب'. Confirming creates the order, opens a chat with the seller containing an order card, and notifies the seller. **Buyer orders `/market/orders`:** tabs (قيد المعالجة, مكتملة, ملغاة), timeline per order (تم الطلب, قبله البائع, يتم التجهيز, جاهز للاستلام, مكتمل), buttons: مراسلة البائع, إلغاء (only before acceptance), تأكيد الاستلام, فتح نزاع (within 7 days), تقييم (after completion: stars, text, photos).

### 12.4 Shop page `/shop/[slug]`

Banner, logo, name, verified mark, rating and review count, followers, province and city, about, working hours with an 'open now' indicator, policies, buttons ('متابعة', 'مراسلة', share, report), tabs: المنتجات, المنشورات, التقييمات, عن المتجر, قصص مميّزة.

### 12.5 Seller dashboard `/market/seller`

**Overview:** orders today, orders awaiting action, revenue recorded manually, product views, low-stock alerts. **Products:** list with search and filters, create or edit (up to 10 images and a video, title, description, price, compare-at price, category, condition, variants with stock and SKU, tags, status draft or active), bulk actions (hide, delete, change stock), duplicate. **Orders:** queue with actions (قبول, رفض with a reason, تجهيز, جاهز, اكتمل, إلغاء), chat shortcut, printable order slip. **Customers, Reviews (reply publicly), Promotions** (percentage discounts with dates; boosting a post or product with T-Coins), **Shop settings** (name, logo, banner, about, hours, policies, handover methods, payment instructions, vacation mode, pause new orders), **Analytics** (views, conversion, top products). **Verification:** upload trade license or ID, admin reviews, badge granted or rejected with a reason. **Fraud protections:** new sellers have order and listing limits, a 'أبلغ عن احتيال' button on every listing and chat, repeated reports hide the listing for review.

### 12.6 Wallet `/wallet`

T-Coins are a **virtual in-app currency**, not money. Show the balance, an append-only transaction list, the gifts catalog, boosted-post purchases, and a creator earnings view in which cash-out is a disabled button labeled 'قريباً'. Never present T-Coins as real money. Real-money payments are a future `PaymentProvider` implementation.

## 13. Profile `/u/[username]`

The profile page is made of two parts: a **system layer** (always rendered by the app, always trustworthy: identity bar, follow, message, report, block) and the **profile content**, which uses either the default design or the owner's published Profile Canvas (section 14). The default design is described here.

**Header (default design):** cover image (3:1, with a soft gradient if none), avatar 96px overlapping the cover (story ring if an active story, tap opens the story, long press opens the photo), display name with verified mark (identity, merchant or official), `@username` in LTR, bio (160 chars, links and hashtags are tappable), up to five links with favicons, province and city, join date ('انضم في تشرين الأول ٢٠٢٦'), a merchant chip that opens the shop, and a stats row: منشورات, متابعون, يتابع (each opens a searchable list with mutual followers first; owners can remove followers).

**Buttons for visitors:** 'متابعة' (becomes 'طلب متابعة' for private accounts, 'يتابعه' with a menu to unfollow or add to close friends), 'مراسلة', a bell for post notifications, and a menu (مشاركة الملف with QR card, نسخ الرابط, كتم, حظر, إبلاغ, إبلاغ عن تصميم الملف). **Buttons for the owner:** 'تعديل الملف', 'مشاركة الملف', a prominent 'صمّم ملفك' button that opens the Canvas editor, 'الإعدادات'.

**Highlights row:** circles of saved stories with titles. **Tabs:** منشورات (3-column grid, a pinned post first), ريلز, فيديو, نصوص (text posts and threads as a list), مشار إليه (tagged), المتجر (merchants), and for the owner only: محفوظات and إعجابات (private). **States:** private account ('هذا الحساب خاص' with follow request), blocked ('لا يمكنك عرض هذا الملف'), suspended, deactivated, not found, empty tab messages.

**Edit profile `/settings/profile`:** avatar and cover change with cropper and remove, display name (50), username (change at most once every 14 days, with availability check and a note that old links stop working), bio (160 with counter), links editor (add, reorder by drag, delete), province and city, birth date visibility, account type switch (to merchant starts the shop flow), 'حفظ' with unsaved-changes guard.

## 14. Profile Canvas (signature feature)

### 14.1 Concept and safety boundary

Profile Canvas remains a signature feature of IRQ تواصل. A user describes a visual idea in Arabic, adjusts it in a visual editor or through an AI-assisted prompt, previews the result, and explicitly approves publication. The app preserves the user's creative intent while keeping profile identity, safety controls and actions trustworthy.

**Version 1 never executes arbitrary user- or AI-generated HTML, CSS, JavaScript, web components, scripts, iframes or external code.** A separate origin, iframe sandbox and CSP are useful defense-in-depth controls, but they are not the product's primary security boundary. Version 1 accepts a strict, versioned JSON design configuration and renders it using IRQ-owned components and an allowlist of tokens, layouts, blocks, patterns and motion presets. No `eval`, `new Function`, dynamic import, user script, remote URL or code editor is part of the publish path. This retains AI-assisted customization without turning profile viewing into execution of untrusted code. [10] [11] [12]

The public system layer is always rendered by IRQ تواصل and cannot be hidden or restyled by a profile design. Visitors see only approved published configurations. The owner can revert to the default profile in one action. Reduced motion, data saver, contrast and viewer preferences override the design.

### 14.2 Pages and entry points

- `/canvas` design gallery; `/canvas/[id]` detail; `/canvas/mine` drafts and published designs; `/canvas/editor/new` and `/canvas/editor/[id]`; `/canvas/templates`.
- Entry points: the owner's profile button 'صمّم ملفك', Settings > المظهر > تصميم الملف, an optional onboarding card, and 'استخدم هذا التصميم' on a gallery detail.
- All imported designs remain drafts until the owner reviews and approves them. Applying a gallery design never publishes it automatically.

### 14.3 Editor

**Desktop:** a left panel for blocks, assets and templates; center preview; right panel for appearance, AI assistance, history and validation. **Mobile:** a four-item editor navigation: معاينة، تخطيط، مظهر، ذكاء اصطناعي; the preview is full-screen with an expandable settings sheet. There is no executable code tab.

Toolbar: back, inline design name, undo/redo, device preview (390, 768, 1280 CSS px), light/dark preview, 100%/150% text test, reduced-motion test, 'فحص', 'معاينة كزائر', 'حفظ مسودة', and the primary 'اعتماد ونشر'. Drafts autosave every 10 seconds and show a clear saved/error state.

The visual editor controls only allowlisted settings: approved palette tokens, contrast-safe accent presets, allowlisted Arabic/Latin fonts, solid/gradient/pattern backgrounds, uploaded media selected from the user's IRQ assets, predefined layout blocks (cover, avatar, name, bio, links, stats, highlights, pinned post, posts grid, shop link, badges, optional music widget), spacing/radius within bounded ranges, and named animations from the platform catalogue. Reordering and hiding optional blocks is supported; identity, follow/message/share controls, safety/report controls and required accessibility content are not removable.

### 14.4 AI prompt and paste workflow

1. The user writes a wish in Arabic and optionally selects style, approved colors, layout and named effects. The app builds a prompt that includes the current JSON schema, allowed component list, contrast/accessibility rules and code-execution prohibition.
2. 'نسخ البرومبت' copies the prompt and 'تنزيل كملف .txt' saves it. The user may use Google AI Studio or another assistant. An optional direct AI integration is behind an explicit provider interface and remains disabled until separately configured.
3. The user pastes the AI result. The import accepts only JSON matching the versioned design schema. Markdown code fences may be stripped as a convenience, but HTML/CSS/JS blocks are rejected with a clear explanation. Unknown fields, oversized strings, arbitrary URLs and unsupported tokens fail closed.
4. The app validates the JSON, creates a draft, renders it with the trusted IRQ renderer, displays findings and lets the owner preview it as a visitor. The owner explicitly approves publication.
5. 'طلب تعديل' creates a follow-up prompt from the new wish and current JSON. 'أصلح الإعدادات' may request corrected JSON using the exact validation messages. Neither flow executes generated source code.

Prompt output contract:

```json
{
  "schemaVersion": 1,
  "theme": {"preset": "sand", "accent": "teal", "background": "surface", "font": "cairo"},
  "layout": "editorial",
  "blocks": [
    {"type": "cover", "visible": true, "settings": {}},
    {"type": "identity", "visible": true, "settings": {}},
    {"type": "bio", "visible": true, "settings": {"alignment": "start"}},
    {"type": "posts-grid", "visible": true, "settings": {"columns": 3}}
  ],
  "motion": {"preset": "subtle", "intensity": 1}
}
```

The schema is authoritative; example values must correspond to real allowlist entries. Never accept renderer code, event handlers, raw CSS declarations, raw HTML, JavaScript, or remote executable assets from this JSON.

### 14.5 Runtime and rendering boundary

The trusted application renders JSON through reviewed IRQ components. The public profile API returns the validated configuration plus ordinary public profile data, never private settings, session tokens, contact data or unpublished drafts. Uploaded assets pass the same upload validation, moderation and access controls as other product media. The renderer uses semantic CSS variables and logical RTL properties. Unknown schema versions render the default profile and a recoverable notice.

### 14.6 Validation, limits and accessibility

Use Zod schemas at import, save, API and render boundaries. Reject unknown keys and values; cap block count, nesting depth, label length, asset count and asset bytes in the shared `lib/limits.ts`. Allow only internal asset IDs, not arbitrary URLs. Re-check contrast, headings, focus, minimum type sizes, responsive behavior and motion rules in the validator. The renderer always retains 44×44 CSS px interactive targets as IRQ's product target; WCAG 2.2 AA's minimum target criterion is 24×24 CSS px with exceptions, while 44×44 is the enhanced AAA criterion. [8] [9]

### 14.7 Versions, approval, gallery and moderation

Every save creates an immutable version `{ canvasId, number, configJson, message, createdAt, validationResult, status }`. Exactly one valid version is published at a time. Publish runs schema/accessibility checks, shows before/after preview and rights/content confirmations, then atomically switches the public version. Provide a 10-second undo to restore the previous version. Moderation may hide a reported design pending review and appeal; all actions are audited and explained to the owner.

Gallery routes `/canvas` and `/canvas/[id]` provide search, filters, static thumbnails, designer, compatibility badges, star/fork counts and a safe preview. Forking copies an allowed JSON design to a draft and retains attribution. Viewer settings include all designs, followed accounts only, safe mode and disable all custom designs. A global feature flag can disable all custom profile designs or the gallery.

### 14.8 Templates and tests

Ship at least 12 original, mobile-first JSON templates with light/dark support, RTL, accessible contrast and reduced-motion handling: رمال، دجلة، نخيل، بغداد ليلاً، زجاج، مجلة، ريترو ٩٠، معرض، متجر، بث، شاعر، تقني. Record every asset and license in `docs/ASSETS.md`.

Tests cover schema fuzzing, prototype-pollution-shaped keys, untrusted HTML/JS rejection, arbitrary URL rejection, authorization on draft/publish, moderation rollback, version restore, ownership of uploaded assets, 320–2560px preview, all themes, RTL, keyboard navigation, reduced motion, 150% text and error/empty/offline states. There is no code-execution escape suite because executable profile code is out of scope; security tests verify that it cannot be imported or invoked.

## 15. Settings `/settings`

**Layout:** mobile shows a grouped list that opens detail pages with a back button; desktop shows a two-pane layout (navigation 280px, content up to 720px). A search field at the top ('ابحث في الإعدادات') filters every setting by title and description. Every section has 'إعادة الضبط للافتراضي'. Row types: toggle, select, slider, segmented choice, link to a sub-page, read-only value, and danger action (red, with confirmation).

**Persistence rules:** settings are stored server-side in `user_settings` (jsonb validated by Zod, versioned for migrations) and mirrored locally for instant effect. Appearance settings apply immediately without reload. Saves are optimistic with rollback and a toast on failure. Sensitive changes (email, password, 2FA off, delete account, passkeys) require re-authentication (password or passkey) and send a security email.

### 15.1 الحساب (Account)

Edit profile (link to 13), email (change with verification of the new address), phone (add and verify with OTP when an SMS provider exists), username, password (change, strength meter, sign out other devices option), linked accounts (Google connect and disconnect), passkeys (add, name, remove), two-factor (set up TOTP with QR, download backup codes, regenerate, disable), **active sessions and devices** (list with device, browser, approximate city, last active, current marker, 'تسجيل خروج' per device and 'تسجيل خروج من كل الأجهزة'), login alerts toggle, account type (personal, creator, merchant), verification request (identity or merchant), switch account (multiple accounts, up to 5), deactivate account (temporary), **delete account** (30-day grace, explains exactly what is deleted, requires re-authentication, can be cancelled by logging in).

### 15.2 الخصوصية والأمان (Privacy and safety)

Private account toggle; who can follow me (الجميع / بطلب); who can see my posts, stories, followers list, following list, likes (each with الجميع / المتابعون / أنا فقط); who can message me; who can add me to groups; who can mention or tag me; who can comment (الجميع, المتابعون, المذكورون, لا أحد); who can reply to stories; who can call me; show activity status; show last seen; read receipts; typing indicator; suggest my account to others; show my profile in search engines (off by default); contacts sync (explicit, hashed matching, with a delete-my-uploaded-contacts button); location text on posts default; **blocked accounts**, **muted accounts**, **muted words and hashtags** (with duration), **hidden words filter** for comments and message requests (offensive words list on by default, custom words), **restricted accounts**, **close friends** manager, **sensitive content control** (أقل / افتراضي / أكثر), 'حماية الصور' (disable saving images from my profile where technically possible and blur unsolicited images), data used for recommendations with 'إعادة ضبط التوصيات', analytics consent, Do Not Track respect, 'فحص الأمان' (security checkup wizard: password strength, 2FA, passkey, sessions, recovery email, linked accounts, with a score).

### 15.3 الإشعارات (Notifications)

Master switch; a **matrix** of categories by channel (in-app, push, email): likes, comments, replies, mentions, follows and follow requests, reposts and quotes, story replies and mentions, direct messages, group messages, channel posts, community activity, live streams from followed accounts, orders (buyer), orders (seller), price drops and back in stock, reviews, gifts and wallet, Canvas stars and forks and moderation results, security alerts (cannot be fully disabled), announcements. Quiet hours (start, end, days), do not disturb now (1 hour, until tomorrow), sound and vibration toggles with tone choice, email digest (لا, يومي, أسبوعي), per-account post notifications list, push status card (granted, blocked with step-by-step instructions to fix, or not asked) and a 'إرسال إشعار تجريبي' button.

### 15.4 المظهر والإتاحة (Appearance and accessibility)

Theme (نظام الجهاز, فاتح, داكن, هادئ, تباين عالٍ) with live preview cards; accent color presets (8); **text size slider** 85% to 150% with a live sample paragraph; font style (Cairo قياسي, Naskh للقراءة, خط النظام); density (مريح, عادي, مضغوط); numerals (١٢٣ or 123); reduce motion; reduce transparency; autoplay (أبداً, على Wi-Fi فقط, دائماً); captions on by default; default video quality; **data saver (وضع خفيف)** that lowers image and video quality, stops preloading and disables heavy effects; **bottom bar handedness** (يمين, يسار, منتصف) with a live demo; hide bar on scroll; haptics; interface sounds; keyboard shortcuts on or off; colorblind helpers (add shapes or patterns next to color-only states); 'تصاميم الملفات' viewer controls (14.12); 'تصميم ملفي' shortcut to the Canvas editor.

### 15.5 اللغة والمنطقة

Language (العربية default, English), governorate and city, time zone (Asia/Baghdad default), first day of week (Saturday default), date format (Gregorian with Iraqi month names or numeric), currency display (IQD fixed in this scope).

### 15.6 المحادثات

Enter key sends (on desktop), media auto-download (Wi-Fi, mobile data, never, per media type), save received media to the device, link previews, default disappearing timer, archive behavior (stay archived when a new message arrives or not), chat wallpaper, emoji style, sticker packs, voice message speed memory, chat export (per chat, as a zip with JSON and media), chat backup is not offered in this scope.

### 15.7 المحتوى والاهتمامات

Interests editor (24 chips), muted topics, preferred content languages, default feed (مرتب / متسلسل زمنياً), 'لماذا أرى هذا' history reset, sensitive content preference, auto-translate (later).

### 15.8 المبدع والتاجر

Creator tools toggle (analytics, scheduling), shop settings link, default handover and payment instruction text, business hours with holidays, **auto replies** (away message with schedule, greeting message for new chats, quick replies shortcuts typed with a slash), customer labels, order notification rules, vacation mode, payout (disabled placeholder).

### 15.9 البيانات والتخزين

Storage used by the app on this device with 'مسح الذاكرة المؤقتة', offline content size, **download my data** (request a zip of profile, posts, comments, messages, media metadata, settings; notify by email when ready, link valid 7 days), clear search history, clear watch history, connected apps and API tokens (developer section, later phase), deleted content recovery (30 days).

### 15.10 المساعدة والدعم

Help center, 'أبلغ عن مشكلة' (with an opt-in checkbox to attach diagnostics: app version, device type, last errors), contact support, safety center, community guidelines, terms, privacy policy, open-source licenses, app version and 'تحقق من التحديثات', and 'تسجيل الخروج'.

## 16. Platform services

### 16.1 Realtime event contract

Channels: `private-user-{userId}` (events: `notification.new`, `conversation.updated`, `message.new`, `story.new`, `order.updated`, `call.incoming`, `wallet.updated`), `private-conv-{conversationId}` (`message.new`, `message.edited`, `message.deleted`, `receipt.updated`, `typing`, `member.updated`), `presence-room-{roomId}` (voice rooms and live chat only), `private-community-{id}` (`channel.updated`, `event.new`). Every payload is small (ids and minimal fields) and the client re-fetches details through the DAL. The `/api/realtime/auth` endpoint checks membership for every channel request. Typing events are throttled (once per 3 seconds) and never persisted. If Pusher is unreachable the client falls back to polling every 10 seconds and shows a quiet 'connecting' state.

### 16.2 Notification engine

Events create notification rows through an Inngest function that applies: recipient preferences, mute and block rules, quiet hours, grouping by `groupKey` (for example `post:123:likes`), de-duplication within 10 minutes, and per-user caps (at most 20 pushes per hour, urgent kinds excepted). Delivery: in-app through Pusher, Web Push to registered subscriptions (dead subscriptions are removed on 404 or 410), and email only for security, orders and digests. Every email has an unsubscribe link and a link to notification settings. Notification text is built from templates with Arabic plural rules.

### 16.3 Arabic search

Store a normalized copy of searchable text in `search_documents`. **Normalization function (shared by indexing and querying):** remove diacritics (tashkeel) and tatweel; unify alef forms (أ إ آ ٱ → ا); ى → ي; optionally ة → ه for matching only; ؤ → و and ئ → ي; convert Arabic-Indic and Persian digits to Western digits; lowercase Latin; collapse whitespace; strip punctuation; keep hashtags and mentions. Use Postgres `to_tsvector('simple', normalized)` with a GIN index plus `pg_trgm` GIN indexes on usernames, display names, hashtags and product titles for typo tolerance and prefix search. Query with `websearch_to_tsquery` (never concatenated SQL), rank with `ts_rank_cd` weighted (name A, username A, text B, tags C) combined with recency and social closeness (followed, mutual, same province). Provide an editable `search_synonyms` table for Iraqi dialect variants (seed with a few examples) and a simple Latin-to-Arabic transliteration table (Arabizi such as '7' and '3') for common search words as a later improvement. Autocomplete returns people, hashtags, communities and shops within 150ms using prefix indexes. Add Vitest tests with real Arabic samples.

### 16.4 Media pipeline

**Images:** UploadThing with server-side checks (magic bytes, max 15MB, max 8000px side), strip EXIF including GPS, generate 320, 640, 1080 and 1600px variants in AVIF and WebP with `sharp` in a background job, compute blurhash, store alt text. **Video:** Mux direct upload, idempotent webhooks (`webhook_events`), poster and thumbnail generation, captions track, status states (uploading, processing, ready, errored) shown in the UI. **Audio and voice notes:** record as WebM/Opus, waveform computed client-side, max 5 minutes. **Safety:** a `MediaModeration` interface (implemented with a provider you select and document) classifies uploads before they become public for new accounts, a hash blocklist for removed content, and a quarantine state. **Quotas:** per user storage and daily upload counts, visible in settings.

### 16.5 Background jobs (Inngest)

Notification dispatch, counters reconciliation (likes, comments, follows), story expiry at 24 hours, scheduled post publish, disappearing messages purge, soft-delete hard purge after 30 days, account deletion after the grace period, data export builder, email digests, trending computation every 10 minutes (hashtags, posts, products, communities per province), moderation scans (media, text, Canvas), Canvas thumbnail generation, video webhook processing, dead push subscription cleanup, `search_documents` sync, order auto-cancel for unanswered orders after 72 hours (configurable).

### 16.6 Caching

Public, non-personalized pages (logged-out profiles, public posts, shops, products, Hub) use `use cache` with tags and `cacheLife`; revalidate with tags when content changes. Anything that depends on the viewer stays dynamic and streams with Suspense. Static assets use immutable hashed URLs. Never cache responses containing private data.

### 16.7 SEO and sharing

Server-render public pages with correct metadata, canonical URLs, Open Graph and Twitter cards with images from `next/og` (embed Cairo for Arabic), `sitemap.xml`, `robots.txt` that respects privacy settings, `noindex` for private, suspended or blocked content, JSON-LD (`Product` with `priceCurrency: IQD`, `Organization`, `VideoObject`, `Person`), `lang='ar'` and `hreflang`.

### 16.8 PWA and platform-dependent behavior

Provide a valid web manifest, IRQ تواصل app icons, RTL metadata, theme colors, shortcuts and an install prompt shown only after meaningful use. Service worker caches the app shell and non-sensitive public media with explicit cache lifetimes. Never cache private messages, session material or personalized responses as public assets.

Offline behavior: show an explicit offline banner; allow safe local drafts for posts and messages; queue only idempotent actions with client-generated IDs and show pending/sent/failed states. Attempt delivery when the app is open and online. Background Sync is an optional enhancement only where feature detection confirms support; it has limited browser availability and browsers may stop a worker, so never promise that every queued message will send after the app is closed. Provide a visible retry path when the user reopens the PWA. [4] [5] [6]

Push notifications are opt-in, requested only after a user action and only when supported. On iOS/iPadOS, explain that web push requires adding the web app to the Home Screen and granting permission from a direct user gesture; show platform-specific guidance and a graceful unsupported/blocked state. A web push alert does not guarantee incoming-call behavior or automatic call pickup while the app is closed. [7]

Google AI Studio Build can preview, sync to GitHub or export source, and deploy a full-stack app to Cloud Run. Deployment quotas, billing and region constraints must be checked before production; the AI Studio-generated URL is not automatically IRQ's final production domain. Keep source portable and apply the owner-approved hosting decision. [1] [2] [3]

## 17. Admin and moderation `/admin`

Roles: مالك, مدير, مشرف, دعم, محلل. Two-factor is mandatory for every admin role. Every action is written to an immutable audit log. User impersonation does not exist.

**Pages:** Dashboard (daily and monthly users, signups, posts, messages, open reports, median resolution time, queue health); **Users** (search by id, username, email, phone; profile view with sanctions history; actions: warn, restrict, suspend with duration, ban, restore, verify, remove verification, force sign-out, reset 2FA after identity check); **Reports queue** (filters by type, priority, age, language; a case page with the content in context, previous reports, reporter anonymity toward the reported user, action buttons, templated messages in Arabic, internal notes, and links to appeals); **Content tools** (search and take down posts, comments, messages reported with evidence, stories, reels, videos, live streams; legal takedown record); **Communities**; **Market** (merchant verification queue with document viewer, listing reports, order disputes with a mediation timeline and decision buttons); **Canvas** (14.13); **Appeals**; **Feature flags**; **Announcements** (in-app banners with audience and schedule); **Safety rules** (keyword lists, spam thresholds, new-account limits); **Rate limits**; **Audit log viewer**; **Data requests** (export and deletion status); **System health** (job queues, webhook failures, error rates); **Policy editor** (guidelines, terms, privacy, with versions).

**Policy categories:** harassment and hate, sexual content, graphic violence, self-harm, dangerous organizations and illegal activity, scams and fraud, impersonation, intellectual property, spam, minors' safety. **Service targets:** urgent cases (child safety, credible threats, extortion) within 1 hour, standard within 24 hours, appeals within 72 hours. **Self-harm reports:** show the reporter and the person concerned a support resources screen (local helplines as configurable placeholders that must be verified before launch) and prioritize review. **Extortion and harassment of women:** a dedicated report reason ('ابتزاز أو تهديد'), instant block-and-report, guidance text on preserving evidence and contacting the competent authorities, and urgent routing. **Child safety:** zero tolerance, immediate removal, escalation procedure documented in `/docs/SECURITY.md`; never display or store such media beyond what the legal process requires.

## 18. Public pages

`/` landing (hero with tagline, three value sections: connect, create, sell; a Profile Canvas showcase; merchants call to action; PWA install; FAQ; footer), `/about`, `/merchants` (seller landing with how it works and a 'افتح متجرك' button), `/canvas-guide` (how to design a profile, with the prompt flow explained), `/help` (search, categories, MDX articles), `/safety` (safety center), `/guidelines`, `/terms`, `/privacy`, `/cookies`, `/contact` (form with Turnstile), `/status`, `/.well-known/security.txt`, branded 404 and 500 pages, a maintenance page. **Legal pages:** write clear plain-language drafts and add a visible internal note in `/docs/DECISIONS.md` that an Iraqi lawyer must review them before launch. Do not invent legal citations.


### 18.1 Future modules: bots and camera effects

These modules are part of the longer IRQ تواصل roadmap, not a reason to overload the first PWA release.

**Bots:** after core messaging is stable, add bot accounts, a discoverable bot directory, scoped API credentials, commands, interactive message cards, event subscriptions and an owner/admin management view. Version 1 of bot creation uses declarative triggers and approved actions, not arbitrary server-side JavaScript. Every bot has least-privilege scopes, owner revocation, quotas, webhook signature validation, audit logs, moderation review and a global kill switch. Bots cannot read private messages unless a member explicitly invokes or adds them to a conversation and the UI discloses the exact access. Add tables only in the bot phase: `bots`, `bot_versions`, `bot_permissions`, `bot_commands`, `bot_events`, `bot_webhook_events`.

**Camera effects and filters:** a PWA-first release may offer a small set of opt-in 2D overlays and color effects using browser-supported camera APIs after an explicit permission explanation; detect support at runtime. Advanced face-tracked AR lenses comparable to dedicated native camera apps are deferred to the native phase and require an approved `EffectProvider`, privacy review, license/cost review and device performance testing. Process camera frames on-device where feasible, do not retain face/biometric data by default, and never claim a filter is private or on-device unless verified. Add a `camera_effects` catalog and creator/review routes only when the capability is approved.

## 19. Internationalization and accessibility

**i18n:** next-intl with `ar` default and `en` fallback; no hard-coded strings; ICU messages with the full Arabic plural categories (zero, one, two, few, many, other); gender-neutral wording where possible; `Intl` for dates, numbers and relative time with `ar-IQ`; bidi isolation for mixed text; translation keys grouped by feature; a CI check that fails when a key is missing in either language.

**Microcopy tone:** short, warm, respectful, never blaming, no technical jargon, light Iraqi flavor only where natural. Examples: error 'صار خطأ بسيط، جرّب مرة ثانية'; empty feed 'ما كو منشورات لسه، تابع ناس حتى يمتلي الفيد'; delete confirm 'تريد تحذف هذا المنشور؟ ما راح تقدر ترجعه'; offline 'انقطع الاتصال. المسودة محفوظة على هذا الجهاز؛ سنحاول الإرسال عند رجوع الاتصال'; success 'تم النشر'. Never imply that a PWA will reliably deliver queued messages after it has been closed. Provide a microcopy guide in `/docs/MICROCOPY.md` with 60 common strings.

**Accessibility (WCAG 2.2 AA as the minimum):** landmarks and skip links; logical heading order; labels for every control; visible focus; keyboard operation for every feature, including drag and drop alternatives (move up and down buttons); dialogs trap and restore focus; toasts and new-message announcements use polite live regions; custom widgets follow ARIA authoring practices; touch targets target 44×44 CSS px as IRQ's enhanced product goal (WCAG 2.2 AA minimum is 24×24 CSS px with exceptions; 44×44 is the enhanced AAA criterion); no information by color alone; text spacing and 320px reflow without horizontal scrolling; no timing traps; accessible authentication (paste allowed in password fields, passkeys, no puzzles); alt text prompts on upload; captions for video; reduced motion; high contrast theme; screen reader tested flows (sign in, post, read feed, chat, order). Run axe on every route in CI and keep a manual checklist in `/docs/A11Y.md`.

## 20. Security (non-negotiable)

Write a threat model in `/docs/SECURITY.md` before Phase 2 and keep it updated. Required controls:

**Authentication:** Better Auth with argon2id password hashing handled by the library; session cookies `HttpOnly`, `Secure`, `SameSite=Lax`, rotated on login and privilege change, with idle and absolute lifetimes; breached-password check using a k-anonymity range API; login throttling per IP and per account; Turnstile after failures; email and device alerts on new logins; TOTP and passkeys; recovery flow that never reveals whether an account exists.

**Authorization:** object-level checks inside every DAL function (owner, member role, visibility, block lists, community permissions, order participants). Write IDOR tests for every resource type (post, comment, message, conversation, order, shop, canvas, upload). Admin routes check role and 2FA on every request.

**Input and output:** Zod on every boundary; parameterized queries only (Drizzle); escape on output, never `dangerouslySetInnerHTML` except through the audited sanitizer; Markdown-free plain text posts with safe linkification; strict limits on lengths and counts.

**Browser security of the main app:** nonce-based CSP without `unsafe-inline` for scripts, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; HSTS with preload candidacy; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy` denying unused features (camera and microphone allowed only on the call, live and recording pages); `Cross-Origin-Opener-Policy: same-origin`. CSRF: Server Actions with origin checks, SameSite cookies, and a custom header plus origin validation for state-changing route handlers.

**Uploads and fetching:** MIME sniffing by magic bytes, extension allowlists, size and dimension limits, EXIF stripping, files served from a separate media origin with `Content-Disposition` where needed. **SSRF defense for link previews:** allow only http and https, resolve DNS and block private, loopback and link-local ranges, pin the resolved IP, follow at most 3 redirects with the same checks, 5-second timeout, 1MB limit, no cookies, run in a job not in the request path.

**Abuse controls:** a rate-limit matrix per action (login, register, post, comment, like, follow, message, report, search, upload, order) per IP and per user with Upstash; new-account limits; scraping protection (cursor pagination limits, no bulk export endpoints for public data); spam heuristics; honeypot field on public forms.

**Secrets and supply chain:** secrets only in the host environment; never in the repo or client bundle; env validated at boot; lockfile committed; Dependabot and `pnpm audit` in CI; no unreviewed postinstall scripts; pin GitHub Action versions; review every new dependency (size, maintenance, license).

**Privacy by design:** collect the minimum; no ad tracking; IP addresses stored hashed with a rotating salt unless needed for abuse; logs without message bodies or tokens; documented retention table in `/docs/PRIVACY_ENGINEERING.md`; encryption at rest through the selected database provider; daily backups and a restore test documented; users can export and delete their data. Compare data processing and storage locations across every approved host, database, email, media, analytics and AI vendor. Prefer Iraq-hosted processing/storage where it satisfies reliability and cost requirements; document any external provider and transfer, retention, support-access and deletion implications before use. Confirm applicable Iraqi legal requirements with a local lawyer before launch; do not assume them.

**Incident readiness:** `/docs/SECURITY.md` includes an incident response checklist, a vulnerability disclosure policy and `security.txt`, and a procedure to rotate every secret within an hour.

## 21. Performance

Budgets on a mid-range Android phone over 4G: LCP under 2.5s, INP under 200ms, CLS under 0.1, initial JavaScript under 170KB gzip per route. Techniques: Server Components and streaming, React Compiler on, route-level code splitting, dynamic imports for the visual profile editor, video player, emoji picker and charts; virtualized long lists; image `sizes`, AVIF and WebP, reserved aspect ratios; font subsetting with `display: swap`; prefetch on intent only; database indexes verified with `EXPLAIN` for the ten heaviest queries; batching to prevent N+1; tag-based caching for public data; bundle analyzer and size budgets that fail CI. Detect low-end devices (`navigator.deviceMemory`, `hardwareConcurrency`, `connection.saveData`) and reduce effects, video preload and animation automatically while still letting the user override in settings.

## 22. Testing and quality gates

- **Unit (Vitest):** normalization, ranking, scanner rules, money and date formatters, permission checks, settings schema migrations.
- **Integration:** DAL against a real Postgres test branch, including authorization matrices.
- **End-to-end (Playwright):** register and onboarding; every post kind; like, comment, reply, repost; follow and private account requests; stories; realtime chat between two browser contexts including typing, receipts and voice notes; group and channel flows; reels scrolling; long video playback controls; live start and watch; market browse, cart, order, seller accept and complete, review; settings persistence and theme switching; Profile Canvas full flow; admin report handling; offline drafts and idempotent retry when the app is open (Background Sync only as optional enhancement where supported); PWA install and update.
- **Visual regression** at widths 320, 390, 768, 1024, 1280, 1536, 1920 in light, dark, calm and high contrast, in RTL, at 100% and 150% text size.
- **Accessibility:** axe on every route; keyboard-only walkthrough tests for critical flows.
- **Performance:** Lighthouse CI with the budgets above.
- **Security:** IDOR matrix, rate limit tests, CSP tests, SSRF tests, profile-design JSON schema/import rejection tests (14.8); verify that HTML, CSS, JavaScript, event handlers, arbitrary URLs and unknown schema keys are rejected and never evaluated.
- **Load:** k6 scenarios for feed, post creation and messaging; record results and set targets in `/docs/PERF.md`.
- **CI gates (all required):** typecheck, lint, unit, integration, e2e smoke, build, contrast script, i18n key check, bundle budget, `knip` for dead code.

## 23. Environments and operations

Preview deployments per pull request with an isolated database branch, a staging environment that mirrors production, and production. Migrations are forward-only, backward compatible for one release, and run before the deploy that needs them. Feature flags gate unfinished work. Observability: Sentry with source maps, structured logs, uptime checks and a public `/status` page. Cost guards: alerts and quotas for every enabled external provider; never activate or bill a provider without owner approval. Keep provider adapters replaceable. Write runbooks in `/docs/RUNBOOKS.md` (database restore, secret rotation, provider outage fallback, mass spam wave, Canvas kill switch, rolling back a release).

## 24. Delivery plan

### 24.1 Phases and definition of done

**Phase 0 — Audit and setup.** Audit the repository against this document; fix the font, color and profile settings problems (0.1); set up CI, environment validation, `.env.example`, `/docs` files, ASSETS.md and DECISIONS.md. *Done when:* build is green, fonts and colors render correctly in all themes (Playwright proof), profile settings bug fixed with a test.

**Phase 1 — Design system and shells.** Tokens, four themes, per-user accent, contrast script, all components in 4.6 with states, the mobile, tablet and desktop shells in 4.7, i18n and RTL foundations, Arabic formatters, DESIGN\_AUDIT.md. *Done when:* a component gallery route (dev only) shows every component in every theme at every breakpoint with zero axe violations and zero contrast failures.

**Phase 2 — Accounts and settings foundation.** Sections 6, 13 (default profile), 15 (all settings that already have features, others hidden behind flags), session management, 2FA and passkeys. *Done when:* a new user can register, verify, onboard, edit the profile and change appearance settings that persist across devices.

**Phase 3 — Content core.** Sections 7, 8 (feed, all post kinds except reels and live, comments, stories, composer, explore, search with Arabic normalization, notifications), a minimal admin with the reports queue. *Done when:* two test users can create every post kind, interact, search in Arabic with correct normalization, and receive realtime notifications.

**Phase 4 — Messaging.** Section 9 including groups, channels, receipts, voice notes, 1:1 calls and push. *Done when:* realtime delivery is verified across two browsers, offline drafts and idempotent retry work; Background Sync is tested only as optional enhancement where supported, and the encryption wording is accurate.

**Phase 5 — Video.** Section 11: reels, long video, studio, live. *Done when:* upload to playback works for all three, data saver is honored, and live chat moderation works.

**Phase 6 — Market.** Section 12 including seller dashboard, orders, reviews, disputes basics and the wallet stub. *Done when:* a seller can list a product, a buyer can order, both can chat about it, and the order completes with a review.

**Phase 7 — Safe Profile Canvas and Hub.** Section 14. AI prompt generates/imports only validated JSON; visual editor, previews, approval, gallery, versions, templates and kill switches work. No arbitrary HTML/CSS/JavaScript is executed.

**Phase 8 — Communities, bot foundation and completeness.** Section 10, safe declarative bot contracts behind a feature flag, gifts, GIFs and stickers, remaining settings and admin/moderation tooling. *Done when:* every route in Appendix A exists and each setting is functional or explicitly flagged off; bots cannot execute arbitrary user code.

**Phase 9 — PWA hardening and launch.** Full security review, performance, accessibility, load tests, SEO, installability, browser capability matrix, privacy, provider cost and recovery runbooks. *Done when:* all CI gates pass on the production build, data-region/provider decisions are documented, and `/docs/LAUNCH.md` is approved.

**Phase 10 — Native clients and advanced camera effects (future).** Build Android/iOS clients only after the API/auth/data contracts and PWA operations are stable. Adapt PWA design tokens into native dp/pt units and platform navigation; implement native push, camera permissions and approved advanced AR effects behind provider and privacy reviews. Do not treat this future phase as part of PWA launch acceptance.

### 24.2 PROGRESS.md format (update continuously)

```text
# PROGRESS
Overall: NN%   Last update: YYYY-MM-DD HH:MM

| Phase | Status (todo/doing/done/blocked) | % | Notes |
|---|---|---|---|

## Current phase tasks
- [x] P3-01 Post card: media edge-to-edge (tests: unit 4, e2e 2)
- [ ] P3-02 Comments sheet

## Missing / not started
- ...

## Risks and blockers
- ...

## Decisions made (see DECISIONS.md)
- ...

## Test status
Unit: pass/fail counts, Integration: ..., E2E: ..., axe violations: 0, Lighthouse: LCP x s, bundle: x KB

## Next up
- ...
```

### 24.3 Brief report after each phase (maximum 10 lines)

```text
Phase N: done / partial
Progress: NN% overall
Done: ...
Missing: ...
Risks: ...
Tests: all green / failing: ...
Next: Phase N+1
```

Do not paste logs or code in the report. If something fails, fix it before reporting.

### 24.4 Final acceptance checklist

- Every route in Appendix A exists, is responsive from 320px to 2560px, and works in RTL.
- All four themes pass the contrast script; text size at 150% breaks nothing.
- No console errors, no hydration warnings, no TODOs, no placeholder content outside seed data.
- Every button described in this document exists and works, or is behind a documented feature flag.
- Profile Canvas accepts only validated JSON designs, never executes arbitrary user code, and its moderation/kill switches are tested.
- Settings persist across devices and apply instantly where specified.
- Data export and account deletion work end to end.
- Accessibility, performance and security gates pass in CI.
- `/PROGRESS.md`, `/docs/DECISIONS.md`, `/docs/ASSETS.md`, `/docs/SECURITY.md`, `/docs/MICROCOPY.md`, `/docs/A11Y.md`, `/docs/PERF.md`, `/docs/RUNBOOKS.md` and `/docs/LAUNCH.md` are complete.

## Appendix A — Route map

**Public:** `/`, `/about`, `/merchants`, `/canvas-guide`, `/help`, `/help/[slug]`, `/safety`, `/guidelines`, `/terms`, `/privacy`, `/cookies`, `/contact`, `/status`, `/u/[username]`, `/p/[id]`, `/video/[id]`, `/shop/[slug]`, `/market/p/[id]`, `/canvas`, `/canvas/[id]`, `/bots`, `/bots/[handle]`, `/c/[communitySlug]` (public communities), `/invite/[code]`.

**Auth:** `/login`, `/register`, `/verify-email`, `/forgot`, `/reset`, `/two-factor`, `/account-recovery`, `/onboarding`, `/suspended`, `/deactivated`, `/delete-pending`.

**App:** `/home`, `/explore`, `/search`, `/reels`, `/video`, `/video/playlist/[id]`, `/studio`, `/live`, `/live/[id]`, `/live/start`, `/messages`, `/messages/[conversationId]`, `/communities`, `/communities/new`, `/communities/[slug]`, `/communities/[slug]/[channelId]`, `/communities/[slug]/settings`, `/market`, `/market/cart`, `/market/checkout`, `/market/orders`, `/market/orders/[id]`, `/market/seller`, `/market/seller/products`, `/market/seller/products/new`, `/market/seller/products/[id]`, `/market/seller/orders`, `/market/seller/customers`, `/market/seller/reviews`, `/market/seller/promotions`, `/market/seller/settings`, `/market/seller/analytics`, `/market/seller/verification`, `/notifications`, `/wallet`, `/compose`, `/create/story`, `/create/reel`, `/canvas/mine`, `/canvas/editor/new`, `/canvas/editor/[id]`, `/canvas/templates`, `/filters` (later feature-flagged), `/filters/[id]` (later feature-flagged), `/bots`, `/bots/[handle]`, `/bots/manage` (later feature-flagged), `/saved`, `/settings` and its sub-pages: `/settings/profile`, `/settings/account`, `/settings/privacy`, `/settings/notifications`, `/settings/appearance`, `/settings/language`, `/settings/chats`, `/settings/content`, `/settings/creator`, `/settings/data`, `/settings/help`, `/settings/security`, `/settings/sessions`, `/settings/blocked`, `/settings/muted`, `/settings/close-friends`.

**Admin:** `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/reports`, `/admin/reports/[id]`, `/admin/content`, `/admin/communities`, `/admin/market`, `/admin/market/verification`, `/admin/market/disputes`, `/admin/canvas`, `/admin/appeals`, `/admin/flags`, `/admin/announcements`, `/admin/safety-rules`, `/admin/rate-limits`, `/admin/audit`, `/admin/data-requests`, `/admin/health`, `/admin/policies`.

**API:** `/api/health`, `/api/v1/*` (documented client API), `/api/realtime/auth`, `/api/uploadthing`, `/api/webhooks/mux`, `/api/webhooks/inngest`, `/api/push/subscribe`, `/api/livekit/token`, `/api/auth/[...all]`, `/api/og/[...slug]`.

## Final instruction to the agent

Start with a Phase 0 audit and a small PWA vertical slice. Build only the current approved phase; do not scaffold all roadmap features with fake functionality. Work phase by phase, keep `PROGRESS.md` truthful, run relevant checks, sync/export the source to the owner-approved GitHub repository, and report in the short format of 24.3. Do not provision Firebase, a paid third-party provider, production databases, public hosting or billing without explicit owner approval. If Google AI Studio offers an automatic Firebase setup that conflicts with PostgreSQL/Better Auth, stop before provisioning and document the choice. Do not ask for routine design decisions; do ask before choices involving spending, data region, legal/privacy, irreversible public release or a material architecture migration. Native apps come later and share the documented API; arbitrary executable profile code is not part of the first release.

## Appendix B — Remaining pages in detail (part of the required scope)

These pages appear in Appendix A but were not detailed above. Build them in the phase noted. Every page needs the standard states (loading skeleton, empty, error, offline) and the definition of done in 0.2.

**B.1 `/saved` (Phase 3).** Header 'المحفوظات' with a 'مجموعة جديدة' button. Collections grid (cover from the first four items, name, count, lock icon when private; collections are private by default). Default collection 'كل المحفوظات'. Inside a collection: type tabs (منشورات, فيديو, منتجات, تصاميم), search, multi-select mode with 'نقل إلى' and 'إزالة', rename, delete collection (items stay in 'كل المحفوظات'), drag or up and down buttons to reorder.

**B.2 `/settings/blocked` (Phase 2).** Search, count, rows with avatar, name, username and an 'إلغاء الحظر' button with confirmation. Block behavior to implement and test: both sides stop seeing each other's profile, posts, comments, stories and search results; follows in both directions are removed; mentions, tags, calls and messages are blocked; existing chats become archived and read-only; the blocked user is never told. Blocking from a profile, a comment, a chat or a report dialog uses the same action.

**B.3 `/settings/muted` (Phase 3).** Tabs: حسابات, كلمات, وسوم, مجتمعات. Adding a word asks for scope (الفيد, التعليقات, الإشعارات) and duration (ساعة, يوم, أسبوع, دائم). Each row has 'إلغاء الكتم'. Muted content is hidden without notifying anyone.

**B.4 `/settings/close-friends` (Phase 3).** Search and add, a suggested list, remove, count, and a note that close-friends stories show a green ring. Changes apply immediately to story audience.

**B.5 `/settings/security` and `/settings/sessions` (Phase 2).** Security checkup wizard with steps (password strength, two-factor, passkey, recovery email, linked accounts, active sessions) and a final score card with the remaining recommendations. Sessions list as in 15.1.

**B.6 `/video/playlist/[id]` (Phase 5).** Header with cover, title, owner, count and total duration; buttons 'تشغيل الكل', 'عشوائي', share, privacy (عام, غير مدرج, خاص), rename, delete; the list supports drag reorder with up and down buttons as an alternative, remove, and 'move to top'.

**B.7 `/sound/[id]` (Phase 5).** Sound name, original creator, play preview, usage count, 'استخدم هذا الصوت' (opens the reel creator with the sound attached), 'حفظ', and a grid of reels that use it.

**B.8 `/invite/[code]` (Phase 3 and 8).** Shows the community, group or inviter preview with avatar, name, member count and description, and a 'انضمام' button. A logged-out visitor goes through login or register and returns to the same invite with the code preserved. States: expired, revoked, full, already a member, invalid.

**B.9 `/c/[communitySlug]` (Phase 8).** Public preview for search engines and non-members: banner, name, description, rules, member count, a few recent public posts, and a 'انضمام' call to action. Private and hidden communities show only a locked card.

**B.10 `/tag/[tag]` (Phase 3).** Hashtag header with post count, 'متابعة الوسم' and 'كتم' buttons, tabs الأبرز, الأحدث, فيديو, and a related tags row.

**B.11 `/province/[slug]` (Phase 3).** One page per governorate (all 19) with trending posts, communities, shops and upcoming community events for that province; used by the 'محافظتي' feed filter and the market province chip.

**B.12 `/u/[username]/followers` and `/following` (Phase 3).** Searchable lists, mutual followers first, follow or unfollow buttons inline, 'إزالة متابع' for the owner, and respect for privacy settings.

**B.13 `/insights` and `/insights/p/[id]` (Phase 8).** For creators and merchants: date range picker, cards for reach, impressions, profile visits, follower change, interactions; line chart over time; top posts table; audience by province and by age bucket shown only when the group has at least 100 people; per-post insights with likes, comments, saves, shares, watch time for video. Charts use accessible colors, text alternatives and a table view toggle.

**B.14 `/market/orders/[id]` (Phase 6).** Timeline, item list with variants, totals in IQD, handover and payment details agreed, seller card with a chat button, notes, a printable slip, cancel button when allowed, confirm-receipt button, and a dispute form (reason list, description up to 1,000 characters, up to 5 evidence images) that creates a case visible to both parties and to admin mediation.

**B.15 Seller sub-pages (Phase 6).** *Products table:* image, title, price, stock, status, views, updated, with filters, search, bulk actions and pagination. *Product form fields and validation:* title 3 to 120 characters, description up to 3,000, price whole IQD at least 0, compare-at price greater than price, stock whole number at least 0, 1 to 10 images (the first is the cover) and an optional video, category required, condition required, province and city from the shop by default, variants (up to 3 options, up to 50 combinations) each with its own stock and optional price. *Customers:* name, orders count, last order, labels, chat button. *Reviews:* list with reply box. *Promotions:* percentage or fixed discount, start and end, product selection, and boost with T-Coins. *Verification:* fields for legal name, shop type, document uploads (ID or trade license), a selfie holding the ID optional, status tracker and rejection reasons with resubmit. *Analytics:* date range, views, conversion funnel (views, chats started, orders, completed), top products, and a table view for each chart.

**B.16 Messaging extras (Phase 4).** `/messages/starred` (starred messages grouped by chat with jump-to-message), `/messages/calls` (call history with missed, incoming, outgoing, duration and a call-back button), message-requests dialog, contact-sync consent dialog with a clear explanation and a delete-uploaded-contacts button.

**B.17 Reporting flow, one component for every content type (Phase 3).** Steps: choose reason, choose sub-reason, optional details (500 characters) and optional screenshot, optional 'also block this account', confirmation screen with a reference number and what happens next. Works for post, comment, user, message, story, reel, video, live, product, shop, community and canvas. Self-harm reasons show support resources first (configurable placeholders that must be verified before launch). The extortion and threats reason is marked urgent.

**B.18 Share sheet (Phase 3).** Items: copy link, send in a chat (search and multi-select recipients with an optional message), add to story, share to community, external sharing through the Web Share API when available, QR code for profiles, shops and communities, and report. The shared link always opens a good preview (Open Graph).

**B.19 Verification request flow (Phase 8).** Two kinds: identity and merchant. A short explanation of requirements, forms with document upload, status page (received, under review, approved, rejected with reason), and re-apply after 30 days.

**B.20 Resource error pages (Phase 3).** Distinct, friendly messages for deleted post, expired story, unavailable video, removed product, closed shop, missing or private profile, blocked relationship, suspended account, banned community, invalid or expired link, each with a useful next action button (go home, search, report a problem).

Before Phase 8 ends, add every route above to the end-to-end suite and tick them in PROGRESS.md. The Final instruction above still applies to this appendix.

## References — version 1.1

[1]: https://aistudio.google.com/docs/aistudio-build-mode "Build apps in Google AI Studio"
[2]: https://aistudio.google.com/docs/aistudio-fullstack "Develop full-stack apps in Google AI Studio"
[3]: https://aistudio.google.com/docs/aistudio-deploying "Deploying from Google AI Studio"
[4]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps "Progressive web apps"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API "Background Synchronization API"
[6]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation "Offline and background operation"
[7]: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ "Web Push for Web Apps on iOS and iPadOS"
[8]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html "Understanding SC 2.5.5 Target Size Enhanced"
[9]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html "Understanding SC 2.5.8 Target Size Minimum"
[10]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe "iframe HTML element"
[11]: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html "HTML5 Security Cheat Sheet"
[12]: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html "Content Security Policy Cheat Sheet"
