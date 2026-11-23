# IRQ تواصل (balash) — Change Request and Fix Prompt

You are modifying an existing project: a Vite 8 + React 19 + Tailwind 4 single-page app (RTL Arabic social platform, UI prototype with seed data, no backend). An independent inspection was run on the exported project (installed, type-checked, built, unit-tested, and driven in a real browser at 390x844 and 1440x900). Everything below is based on that inspection. Do exactly what this document says, in the order given, keep the existing stack and visual identity, and do not add features that are not listed.

## 0. Working rules

1. Read this whole document first. Then work through sections 1 to 4 in order. Do not skip a task; if a task cannot be done, write why in `/docs/DECISIONS.md` and continue.
2. Keep RTL-first: use logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rounded-s*`, `rounded-e*`). The only allowed physical left/right is the handedness docking of the bottom bar (task R1).
3. No hard-coded hex colors in components. Use the CSS tokens in `src/index.css`. If a token is missing, add it to all four themes.
4. Every size that defines shell geometry (bottom bar, header, touch targets) must be in `px`, not `rem` (see F12).
5. After each task: `npm run lint`, `npm test`, `npm run build` must pass with zero errors. At the end, run the verification protocol in section 5 and report using the format in section 6.
6. Do not claim a task is done unless its acceptance check passes. `PROGRESS.md` must reflect reality (see F16).

## 1. Requested change (highest priority)

### R1. The chat tab in the bottom bar must look and behave like the other four tabs

**Current behavior (measured).** In `src/components/shell/BottomBar.tsx` the chat tab (slot 3) is a 52x52 filled circle (`bg-[var(--primary)]`, filled icon, shadow, ring when active) with an orange unread badge. The other four tabs are plain 45x45 outline icons. The owner wants no special treatment for chat.

**Required behavior.**
- All five tabs (الرئيسية، ريلز، المحادثات، السوق، الملف الشخصي) use the same component, same slot size, same icon size (26px), same inactive style (`--text-muted`, stroke 1.8) and same active style (`--primary`, stroke 2.4, 4px dot under the icon). No filled circle, no `fill-current`, no shadow, no ring, no bigger size for chat.
- Order stays the same (from the start side, right in RTL): home, reels, chat, market, profile. Chat stays in the middle position, it just is not highlighted.
- Unread badge on chat stays (it is information, not decoration) but uses tokens that pass contrast in every theme: `bg-[var(--primary)] text-[var(--primary-fg)]`, 11px bold, min 18x18, positioned at the top-end corner of the icon so it does not cover the glyph (`-top-[9px] -end-[13px]`). Digits follow the numeral setting (`formatNumber(count, numeralSystem)`), cap at `99+`.
- Accessibility: every tab has `aria-current="page"` when active; chat's `aria-label` includes the unread count ("المحادثات، ٧ غير مقروءة").
- Keep the invisible long-press shortcut on the chat tab (hold 500 ms opens the recent chats sheet) but implement it with pointer events and suppress the click that follows a long-press. Tapping normally must navigate and never open the sheet. (The old code used both touch and mouse handlers, which can double-fire on touch devices.) If you remove this shortcut, record it in DECISIONS.md.
- Handedness docking must dock to the physical side: right-handed = bar 16px from the RIGHT edge, left-handed = 16px from the LEFT edge, center = centered. **The old code had this swapped** (it used `end-4`/`start-4`, which in RTL puts the "right-handed" bar on the left; measured at 390px: right-handed gave x=15..355, i.e. 15px from the left edge).
- Geometry in px: bar height 64px, `bottom: calc(16px + env(safe-area-inset-bottom))`, max width 340px, width `calc(100% - 32px)`. (Old code used `h-16`, which is 60px because the root font size is 15px.) Five equal slots (`flex-1`), each 56px high.
- `index.html` viewport meta must include `viewport-fit=cover`, otherwise `env(safe-area-inset-bottom)` is always 0 on notched phones and the bar sits on top of the home indicator.

**Reference implementation (already tested; replace the file with this).**

```tsx
import React, { useRef } from 'react';
import { Home, Film, MessageCircle, Store, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { formatNumber } from '../../lib/formatters';
import type { AppRoute } from '../../types';

type TabId = 'home' | 'reels' | 'chat' | 'market' | 'profile';

interface TabDef {
  id: TabId;
  route: AppRoute;
  label: string;
  Icon?: LucideIcon; // the profile tab renders the user's avatar instead of an icon
}

// All five tabs share ONE visual treatment. Order is from the start side (right in RTL).
const TABS: TabDef[] = [
  { id: 'home', route: 'home', label: 'الرئيسية', Icon: Home },
  { id: 'reels', route: 'reels', label: 'ريلز', Icon: Film },
  { id: 'chat', route: 'messages', label: 'المحادثات', Icon: MessageCircle },
  { id: 'market', route: 'market', label: 'السوق', Icon: Store },
  { id: 'profile', route: 'profile', label: 'الملف الشخصي' },
];

const LONG_PRESS_MS = 500;

export function BottomBar() {
  const {
    currentRoute,
    setCurrentRoute,
    handedness,
    currentUser,
    conversations,
    setIsRecentChatsOpen,
    isBottomBarVisible,
    numeralSystem,
  } = useApp();

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Routes where the bar is hidden (focused flows)
  if (!isBottomBarVisible || currentRoute === 'settings') {
    return null;
  }

  const unreadChats = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Handedness is about the PHYSICAL thumb, so it uses physical offsets on purpose
  // (the only place in the app where left/right are allowed instead of start/end).
  const dock =
    handedness === 'right' ? 'right-[16px]' : handedness === 'left' ? 'left-[16px]' : 'inset-x-0 mx-auto';

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // Invisible shortcut kept from the spec: long-press the chat tab = recent chats sheet.
  const startChatPress = () => {
    longPressFired.current = false;
    clearPress();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setIsRecentChatsOpen(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    }, LONG_PRESS_MS);
  };

  const handleTab = (tab: TabDef) => {
    if (tab.id === 'chat' && longPressFired.current) {
      longPressFired.current = false; // the long-press already handled this gesture
      return;
    }
    if (currentRoute === tab.route) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentRoute(tab.route);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  };

  return (
    <nav
      data-testid="tw-bottombar"
      aria-label="شريط التنقل السفلي"
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        height: '64px',
        maxWidth: '340px',
        width: 'calc(100% - 32px)',
      }}
      className={`fixed z-30 rounded-[32px] bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-xl flex items-center px-2 transition-all duration-200 select-none md:hidden ${dock}`}
    >
      {TABS.map((tab) => {
        const active = currentRoute === tab.route;
        const badge = tab.id === 'chat' ? unreadChats : 0;
        const badgeText = badge > 99 ? `${formatNumber(99, numeralSystem)}+` : formatNumber(badge, numeralSystem);
        const chatHandlers =
          tab.id === 'chat'
            ? {
                onPointerDown: startChatPress,
                onPointerUp: clearPress,
                onPointerLeave: clearPress,
                onPointerCancel: clearPress,
                onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
              }
            : {};

        return (
          <button
            key={tab.id}
            type="button"
            data-testid={`tw-bottombar-slot-${tab.id}`}
            aria-label={badge > 0 ? `${tab.label}، ${badgeText} غير مقروءة` : tab.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => handleTab(tab)}
            className="relative flex-1 h-[56px] flex items-center justify-center rounded-full active:scale-90 transition-transform"
            {...chatHandlers}
          >
            {tab.Icon ? (
              <span className="relative inline-flex">
                <tab.Icon
                  aria-hidden="true"
                  className={`w-[26px] h-[26px] transition-colors ${
                    active
                      ? 'text-[var(--primary)] stroke-[2.4]'
                      : 'text-[var(--text-muted)] stroke-[1.8]'
                  }`}
                />
                {badge > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-[9px] -end-[13px] min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-[11px] font-bold leading-none ring-2 ring-[var(--surface)] flex items-center justify-center"
                  >
                    {badgeText}
                  </span>
                )}
              </span>
            ) : (
              <span
                className={`rounded-full p-[2px] transition-all ${
                  active ? 'ring-2 ring-[var(--primary)]' : ''
                }`}
              >
                <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={28} />
              </span>
            )}
            {active && tab.Icon && (
              <span className="absolute bottom-[5px] w-1 h-1 rounded-full bg-[var(--primary)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

**Acceptance (all must be true, measure in a real browser at 390x844):**
1. The five tab buttons have identical width and height (65x56 at this viewport), transparent background, and their icons are 26x26 with `fill: none`.
2. Bar rect: height 64, bottom edge 16px above the viewport bottom, width 340.
3. Handedness: `right` gives a gap of exactly 16px on the right edge and 34px on the left; `left` is the mirror; `center` gives 25px on both sides.
4. A normal tap on chat navigates to messages and does not open the recent-chats sheet; holding 500+ ms opens the sheet and does not navigate away.
5. Unread badge text/background contrast is at least 4.5:1 in light, dark, calm and high-contrast themes.
6. Update `docs/DECISIONS.md` DEC-004: five equal slots, chat not highlighted, handedness uses physical sides. Remove the words "center 54px circle" everywhere (`BottomBar.tsx` comment, DECISIONS.md).
7. Settings currently hides the bottom bar, so the handedness control cannot show its effect. Add a live demo: a small mock of the bar inside the handedness setting that moves when the option changes.

## 2. Inspection results (what is verified and how)

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| F1 | Critical | App is a blank page when offline, although PROGRESS.md claims offline resilience | Ran the built app, waited for the service worker, went offline, reloaded: `#root` had 0 children. Cache `irq-tawasul-v1` holds only `/`, `/index.html`, `/manifest.json`, `/icon.svg`; the hashed JS and CSS bundles are never cached |
| F2 | Critical | No persistence: theme, accent, handedness, font scale, numerals, reduce motion, data saver, canvas design all reset on reload | `grep localStorage` over `src` returns nothing; DEC-002 claims "instant persistence" |
| F3 | Critical | No URLs or history: navigation is a `useState` route; browser Back leaves the app, no deep links, refresh returns to home; `manifest.json` shortcuts use `/?tab=messages` but nothing reads it | `AppContext.tsx` (`currentRoute` state); `grep URLSearchParams\|pushState\|popstate` returns nothing |
| F4 | Critical | `npm install` fails out of the box (ERESOLVE): `esbuild@^0.25` devDependency conflicts with the peer range of `vite@8` (`^0.27 \|\| ^0.28`). README tells users to run `npm install` | Ran it; only `--legacy-peer-deps` works |
| F5 | High | White text on primary/accent backgrounds fails WCAG in dark and high-contrast themes (17 places use `text-white` on `--primary` or `--accent`; one uses `bg-red-500 text-white`). Computed: white on dark accent `#F0A04B` = 2.14:1; on high-contrast accent `#FFB300` = 1.79:1; white on dark primary `#22D3EE` is below 2:1 | Files: `ui/Button.tsx:74`, `ui/Avatar.tsx:117`, `modals/StoryViewerModal.tsx:164,182`, `modals/AuthModal.tsx:57`, `modals/ShareModal.tsx:114`, `views/MarketView.tsx:36`, `views/ProfileView.tsx:241`, `views/CommunitiesView.tsx:109,122,135,160`, `views/ReelsView.tsx:57`, `views/CanvasEditorView.tsx:179`, `shell/Sidebar.tsx:107`, `chat/ChatBubble.tsx:29`, `feed/PostCard.tsx:227` |
| F6 | High | One message thread for every conversation: the UI renders `activeMessages` regardless of the selected conversation, and sending always writes to the same list | `MessagesView.tsx` (`activeMessages.map`), `AppContext.tsx` (`SEED_MESSAGES_THREAD`, `sendChatMessage`) |
| F7 | High | Seven dialogs have `role="dialog"` but no Escape handling, no focus trap, no focus restore, no scroll lock | `grep "Escape\|keydown" src` returns nothing |
| F8 | High | Desktop shell: the mobile `TopBar` also renders on desktop (logo and "new post" duplicated next to the sidebar's), and at 1440x900 the sidebar is clipped at the bottom (account/login entry cut off) | Screenshot at 1440x900 |
| F9 | High | Developer/admin entries visible to every user: "نظام التصميم" chip in the messages header, and "الإدارة والرقابة", "نظام التصميم والمكونات", "محرر كانفاس البروفايل" in the sidebar, with no role check | Screenshots; `Sidebar.tsx`, `MessagesView.tsx`, `AppContext.tsx` (`isAuthenticated` defaults to true, no roles) |
| F10 | High | All 31 image URLs are hot-linked from `images.unsplash.com`; when they fail, posts show a black box and avatars show an empty beige circle (the `Avatar` `onError` hides the image but never shows the initial) | Screenshot with external hosts unreachable; `Avatar.tsx:95-98` |
| F11 | Medium | Fonts load from Google Fonts at runtime (external dependency, slow or blocked networks show fallback fonts) | `index.html` |
| F12 | Medium | Root font size is 15px (and scales with the font-size setting), so every `rem` utility shrinks or grows: `h-16` is 60px not 64px, `w-12` is 45px, and at 150% text size the bottom bar would be about 96px high | Measured nav height 60px |
| F13 | Medium | `scripts/check-contrast.ts` hard-codes its own copy of the colors (can drift from `index.css`) and checks only 4 pairs per theme; it does not check muted text, link text, tints, borders, accent presets, or badges. `DESIGN_AUDIT.md` claims "all pairs" | Read the script. Also `--border-strong` (3:1 control boundary) does not exist, and the decorative `--border` is only 1.25:1 |
| F14 | Medium | Profile Canvas validator is shallow: it never validates `blocks[].visible/settings`, `motion.intensity`, `name`, sizes or counts; a `null` block throws a TypeError; the denylist regex can reject legitimate text | `src/lib/canvasSchema.ts` lines 86-144 |
| F15 | Medium | Manifest and icons: a single SVG marked `any maskable`, iOS needs PNG touch icons, `orientation: "portrait"` locks tablets and desktop, shortcuts are dead (see F3). The logo is a generic Lucide `Layers` icon, not the project's cuneiform mark | `manifest.json`, `TopBar.tsx`, `Sidebar.tsx`, `public/icon.svg` |
| F16 | Medium | `PROGRESS.md` says every phase is 100% done; `DESIGN_AUDIT.md` says "zero hardcoded hexes" (20 found in components); there is no backend, no real authentication, no persistence | Read the files; `grep "#[0-9A-Fa-f]{6}" src/components` |
| F17 | Low | Dead dependencies and config: `@google/genai`, `express`, `dotenv`, `@types/express` are never imported; package name is `react-example`; README is the AI Studio boilerplate; `@` alias points to the repo root, not `src`; `__dirname` warning from Vite; both `bun.lock` and npm are used | `grep` over `src`; `vite build` output |
| F18 | Low | Small items: the bottom-bar and sidebar badges print Western digits while the default numeral system is Arabic-Indic; `ChatBubble` uses physical corner classes (`rounded-bl-sm`/`rounded-br-sm`); the "slate" accent swatch in Settings is `#475569` while the applied token is `#334155`; 20 text elements use 9 or 10px type | Read the files |

What is already good and must not be broken: lint passes with zero TypeScript errors, build passes (JS 123 KB gzip), the 10 unit tests pass, no horizontal overflow at 390 or 1440 px, correct `lang="ar" dir="rtl"`, four themes and eight accents work, the desktop sidebar and tablet rail already show chat as a normal item.

## 3. Fix tasks (do in this order)

### F4. Make installation work (do this first, it unblocks everything)
- Remove the `esbuild` devDependency (Vite brings its own). Remove unused `@google/genai`, `express`, `dotenv`, `@types/express`. Rename the package to `irq-tawasul`. Replace the AI Studio README with a real one (what it is: UI prototype with seed data; how to run; scripts; folder map; honest limitations).
- Choose one package manager. If npm: delete `bun.lock`, commit `package-lock.json`. Fix the `clean` script (`rm -rf dist`). Change the alias to `'@': path.resolve(import.meta.dirname, './src')` and remove `__dirname`.
- **Acceptance:** in a clean checkout, `npm install` (no flags) succeeds, then `npm run lint`, `npm test`, `npm run build` pass.

### F1. Real offline support
- Add `vite-plugin-pwa` (Workbox, `generateSW` or `injectManifest`) or write the service worker so that it **precaches the build output** (index.html, hashed JS and CSS, icons, the two font files from F11). Cache name must change with each build (use the build hash). Navigation requests fall back to the cached `index.html`. Do not cache cross-origin opaque responses without a size cap (use `maxEntries` and `maxAgeSeconds` for runtime image caching). Add an update flow: when a new version is ready, show a toast "يوجد إصدار جديد، تحديث" that calls `skipWaiting` and reloads on confirm (never reload silently while the user is typing).
- Add an offline banner (height 36px under the header, warning tint, text "ما كو إنترنت، تشوف آخر ما انحفظ") driven by `navigator.onLine` plus `online/offline` events.
- **Acceptance (Playwright):** load the built app, wait for the service worker to become active, set the context offline, reload: `#root` has children, the bottom bar is visible, and the banner is shown.

### F2. Persist preferences safely
- Store `theme`, `accent`, `handedness`, `fontScale`, `numeralSystem`, `reduceMotion`, `dataSaver`, and the active canvas config in `localStorage` under versioned keys (`tw.prefs.v1`, `tw.canvas.v1`). Every access in `try/catch` (storage can throw in private mode); the app must work with storage blocked. On load, validate stored values against allowlists (and run the canvas through the validator from F14); on failure fall back to defaults.
- Add a `system` theme option (new default) that follows `prefers-color-scheme`; default `reduceMotion` from `prefers-reduced-motion` when nothing is stored.
- Add a tiny inline script in `index.html` that applies theme, accent and font scale before React mounts, to avoid a flash of the wrong theme.
- Update DEC-002 so it is true.
- **Acceptance:** change theme, accent, handedness, font scale, reload: all remain. With storage disabled the app loads with defaults and no console error.

### F3. Real routing
- Add `react-router-dom` (v7). Map routes to paths: `/` and `/home`, `/explore`, `/reels`, `/messages`, `/messages/:conversationId`, `/market`, `/wallet`, `/u/me`, `/settings`, `/settings/:tab` (account, security, privacy, appearance, notifications, merchant, support), `/canvas`, `/communities`, `/notifications`, `/auth`, `/admin` (see F9), `/gallery` (dev only, see F9). Keep the `useApp()` API (`currentRoute`, `setCurrentRoute`, `activeConversationId`, `setActiveConversationId`) as thin wrappers over the router so views do not need rewrites; `currentRoute` must be derived from the location.
- Browser Back/Forward work; the mobile back button uses history; scroll position restores; settings tab and open conversation live in the URL. `manifest.json` shortcuts point at real paths (`/messages`, `/market`, `/`). SPA fallback is already handled by the service worker and `vite preview`.
- **Acceptance:** open `/messages` directly: messages screen shows with the bottom bar's chat tab marked `aria-current`; Back from `/settings/appearance` returns to the previous screen; refresh on `/market` stays on the market.

### F5. Contrast of text on colored backgrounds
- Add tokens `--accent-fg` and `--danger-fg` to all four themes. Recommended values (verified): `--accent-fg` light `#FFFFFF` (5.02:1 on `#B45309`), dark `#2B1D00` (7.69:1 on `#F0A04B`), calm `#FFFFFF`, high-contrast `#000000` (11.7:1 on `#FFB300`); `--danger-fg` light `#FFFFFF` (6.57:1 on `#B42318`), dark `#2A0805` (6.69:1 on `#F87171`), high-contrast `#000000`. Calm values: compute and pick the passing option.
- Replace every `text-white` that sits on `bg-[var(--primary)]` with `text-[var(--primary-fg)]`, on `bg-[var(--accent)]` with `text-[var(--accent-fg)]`, and replace `bg-red-500 text-white` with `bg-[var(--danger)] text-[var(--danger-fg)]` (file list in the table above). Text smaller than 11px (`text-[9px]`, `text-[10px]`, 20 occurrences) becomes at least 11px.
- **Acceptance:** `grep -rnE "bg-\[var\(--(primary|accent)\)\][^\"']*text-white"` returns nothing, and the extended contrast script (F13) passes for these pairs.

### F6. One thread per conversation
- Replace the single `activeMessages` list with `messagesByConversation: Record<string, ChatMessage[]>`, seeded for every conversation in `seedData.ts`. `activeMessages` becomes derived from `activeConversationId`. `sendChatMessage` appends to the open conversation only (and updates that conversation's last message and time); opening a conversation sets its `unreadCount` to 0. Remove the `?? 'c-1'` fallback.
- **Acceptance:** two conversations show different messages; sending in one does not change the other; the bottom-bar unread badge decreases after opening an unread conversation.

### F7. Dialog behavior
- Create `src/components/ui/Modal.tsx` (or a `useModal` hook) and use it in all seven dialogs (GlobalComposer, StoryViewer, Auth, Call, Share, RecentChatsSheet, Report): Escape closes; initial focus moves inside; Tab/Shift+Tab are trapped; focus returns to the opener on close; body scroll is locked while open; the page behind gets `inert`. Story viewer: Escape closes, arrow keys go to previous/next story (mirrored for RTL: Left arrow = next, Right arrow = previous).
- **Acceptance (Playwright):** for each dialog, open it, press Escape: it closes and focus is back on the trigger; Tab never leaves the dialog.

### F8 and F9. Desktop shell and role gating
- `TopBar` renders only below 768px for primary routes (`md:hidden`); on inner pages at any width it shows only the back button and title. At 1440x900 and 1366x768 the sidebar must show every item without clipping: make the nav list scrollable (`overflow-y-auto`) and keep the account entry pinned at the bottom.
- Add `role: 'user' | 'moderator' | 'admin'` to `User`. Show the admin entry only for `moderator` and `admin`; show the gallery and the "نظام التصميم" chip only when `import.meta.env.DEV` or `?dev=1`. Canvas editor stays visible to all users (it is a user feature) but is renamed in the sidebar to "تصميم ملفي". Route guards: visiting `/admin` without a role renders a "غير مصرّح" page.
- **Acceptance:** at 1440x900 no element of the sidebar is cut off; a normal user sees no admin or design-system entries.

### F10. Images and avatars without external dependencies
- Replace the Unsplash URLs with local assets (generated SVG/gradient placeholders or small optimized WebP files under `public/seed/`, recorded with licenses in `docs/ASSETS.md`). Add `width/height` or `aspect-ratio` to prevent layout shift, `loading="lazy"` and `decoding="async"` below the fold. Create one `SmartImage` component: shows a neutral tinted placeholder while loading and on error, never a black box.
- Fix `Avatar`: keep `failed` in state; when the image fails, render the initial (the existing fallback span), not an empty circle.
- **Acceptance:** with all external hosts blocked, every post and avatar still shows a sensible placeholder or initial.

### F11. Self-host fonts
- Install `@fontsource/cairo` (weights 400, 600, 700; Arabic and Latin subsets) and `@fontsource/reem-kufi` (600, 700) and import them; remove the Google Fonts links. Preload the two most used woff2 files. Include them in the precache (F1).
- **Acceptance:** the Network panel shows no request to `fonts.googleapis.com` or `fonts.gstatic.com`; text renders in Cairo when offline.

### F12. Shell geometry in px
- Keep `html { font-size: calc(15px * var(--font-scale)) }` only if you want everything to scale with text size; but define the shell geometry in px tokens: `--header-h: 56px`, `--bar-h: 64px`, `--tap: 44px`, and use them for the TopBar, BottomBar, page `padding-bottom` (`calc(var(--bar-h) + 32px + env(safe-area-inset-bottom))`). At 150% font scale the bottom bar stays 64px high and the labels still fit.
- **Acceptance:** with `--font-scale: 1.5` the bar height is 64px and no text is clipped in the header or bar.

### F13. A contrast script that cannot drift
- Rewrite `scripts/check-contrast.ts` to **parse the tokens from `src/index.css`** (all four themes plus every `[data-accent]` override in light and dark) instead of keeping its own copy. Add the missing tokens `--border-strong` (3:1 against bg and surface; decorative `--border` stays as is), `--lapis`, `--gold` and their `-fg` tokens as specified below, then check at least these pairs per theme (4.5:1 unless noted): text/bg, text/surface, text/surface-2, text-muted on bg, surface and surface-2, primary-fg/primary, primary-text on bg, surface and surface-2, accent-fg/accent, accent-text on bg and surface, danger-fg/danger, success, warning, danger and info on surface, each tint with its text color, bubble-own and bubble-other with text, ring on bg (3:1), border-strong on bg and surface (3:1), and the eight accent presets (primary-fg/primary and primary-text/bg) in light and dark. High-contrast requires 7:1 for text pairs. The script must exit non-zero on any failure and print a table of every pair.
- New tokens (verified in all four themes): `--lapis` light `#1E4D8C`, dark `#6EA0E8`; `--lapis-fg` light `#FFFFFF`, dark `#04101F`; `--gold` light `#D9A21B`, dark `#E6B53A`; `--gold-fg` `#2B1D00`; `--border-strong` light `#857A6B`, dark `#6B7C96`, calm `#80766A`, high-contrast `#FFFFFF`. Use `--border-strong` for inputs, switches, checkboxes and segmented controls.
- Fix the "slate" accent: Settings swatches must read the real token (`var(--primary)` of that accent), not a separate hard-coded hex.
- **Acceptance:** `npm test` runs the new script and passes; changing a color in `index.css` to a failing value makes it fail.

### F14. Strict Profile Canvas validation
- Rewrite `validateCanvasJson` as a strict allowlist schema (Zod or hand-written, no new unchecked casts): reject unknown keys at every level; `schemaVersion === 1`; `name` string 1 to 40 chars; `theme.*` from allowlists; `layout` from allowlist; `blocks` array of 1 to 20 items, each with `type` from the allowlist, `visible` boolean, optional `settings` with at most 10 entries, keys matching `^[a-z][a-zA-Z0-9]{0,30}$`, values string (max 200 chars), finite number, or boolean; no duplicate block types except where the schema allows it; `motion.preset` allowlist and `motion.intensity` finite number 0 to 1; raw JSON size at most 20 KB; never throw (a `null` or non-object block must return an error). Keep the existing pattern denylist only as an extra layer; do not rely on it.
- Add tests: valid templates (all 12) pass; hostile fixtures fail with Arabic error messages (unknown keys, `__proto__`, `null` block, 100 blocks, 1 MB string, NaN intensity, HTML/script strings in values, wrong types); a legitimate name like "إعدادات الموسم" is not rejected by a false positive.
- **Acceptance:** all new tests pass and `validateCanvasJson` never throws on any input (fuzz 1,000 random JSON values in a test).

### F15. Identity, icons and manifest
- Replace the Lucide `Layers` logo with the project mark: three cuneiform wedges rotated 0, 120 and 240 degrees around (24,25) on a 48x48 box; two wedges `var(--primary)`, one `var(--accent)`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs><path id="w" d="M-5.5 -19 L5.5 -19 L1.6 -9.5 L1.6 -2 L-1.6 -2 L-1.6 -9.5 Z"/></defs>
  <g transform="translate(24 25)">
    <use href="#w" fill="var(--primary)"/>
    <use href="#w" fill="var(--primary)" transform="rotate(120)"/>
    <use href="#w" fill="var(--accent)" transform="rotate(240)"/>
  </g>
</svg>
```
  Create `src/components/ui/LogoMark.tsx` and use it in `TopBar`, `Sidebar`, `AuthView`. Update `public/icon.svg` with fixed colors (`#0E7490` and `#B45309`) on a `#FAF9F7` rounded square.
- Generate PNG icons (180, 192, 512, plus a maskable 512 with 20% safe padding) into `public/icons/`; reference them in `manifest.json` (separate `any` and `maskable` entries) and `<link rel="apple-touch-icon">`. Remove `"orientation": "portrait"`. Make the shortcuts real paths (F3).
- **Acceptance:** Lighthouse PWA installability passes; the logo is the wedge mark everywhere.

### F16. Honest documentation
- Rewrite `PROGRESS.md`: the project is a **front-end prototype with seed data**. Mark as not started or partial: real authentication, backend/database, real-time messaging, media upload/streaming, payments, moderation backend, the code-based profile canvas. Replace "100%" statuses with accurate ones. Fix `DESIGN_AUDIT.md` (the hex claim) after you tokenize the 20 hard-coded colors found in `Avatar.tsx` (story rings: use `--success` for close friends, `--border-strong` for the empty-story dashed ring) and `ProfileView.tsx` (preset backgrounds: define `--profile-*` tokens). Keep `DECISIONS.md` truthful.

### F17 and F18. Cleanup
- Badges and counters in `BottomBar.tsx` and `Sidebar.tsx` use `formatNumber(count, numeralSystem)`.
- `ChatBubble` uses logical corner classes (`rounded-es-sm` / `rounded-ee-sm`) with the same visual result.
- Remove `.env.example` Gemini keys unless a feature uses them.

## 4. Do not do in this pass (later work)

- Do not build a backend, real auth or a database now.
- Do not implement the code-based profile layer (sandboxed HTML/CSS/JS with an AI prompt flow) in this pass. The current JSON engine stays as "safe design mode"; the code layer will be a separate request and needs its own security design (separate origin, iframe sandbox without `allow-same-origin`, CSP, resource limits).
- Do not redesign screens. Visual changes are limited to R1 and the fixes above.

## 5. Verification protocol (run at the end and attach the output)

1. `npm install` (clean, no flags), `npm run lint`, `npm test`, `npm run build`: all pass.
2. Playwright at 390x844 (mobile) and 1440x900 (desktop), against `npm run preview`:
   - R1 checks 1 to 5 from section 1.
   - Offline reload (F1), preference persistence (F2), deep link and Back (F3), two conversations (F6), Escape/focus on all seven dialogs (F7), no sidebar clipping and no duplicate header at 1440x900 (F8), no admin/design entries for a normal user (F9), all images blocked still shows placeholders (F10), no font requests to Google (F11), 150% font scale keeps bar at 64px (F12).
   - No horizontal scroll at 360, 390, 768, 1024, 1440. No console errors or warnings in a normal session.
3. Contrast script passes for all four themes and all accents.
4. Take screenshots: home, messages, market, profile, settings (appearance) in light, dark, calm and high-contrast at 390x844; bottom bar close-ups for center, right and left docking.

## 6. Report format (when finished)

For each task id (R1, F1 to F18): `done` or `not done`, the files changed, the acceptance check result (pass or fail with the number or output), and anything you could not do and why. Then list remaining risks. Do not use percentages and do not call something done if its check was not run.

## Appendix A. Text to keep the master prompt in sync

In the master build prompt, replace the bottom-bar table rows and notes so they match the code:

- Section 25.1, row 3 becomes: `| 3 (center) | المحادثات | 195 | 26, message-circle (same as the other tabs) | 'المحادثات' |`, and delete the sentence beginning "Center circle: 56x56 at y 734".
- Section 4.7 mobile bottom bar: remove "Long-press the center tab" wording and write "Long-press the chat tab (500 ms) opens the recent-chats sheet; this shortcut is invisible and does not change the tab's appearance".
- Section 4.8 motif "Round city": remove the use "center chat button as a circle with four tabs around it"; use it only for ring motifs in story rings.
- Section 25.1 handedness: right-handed = 16px from the right edge, left-handed = 16px from the left edge (physical sides, not start/end).
