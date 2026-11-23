# IRQ تواصل — Strict UI Behavior Specification

مواصفات الواجهة والسلوك الدقيق لـIRQ تواصل: الصفحات، الأشرطة، الأزرار، الإعدادات والحركات. هذه وثيقة مكملة لخطة البناء، وموجهة إلى Google AI Studio Build mode. الإصدار 1.1. الأرقام هنا قرارات المنتج. قواعد الأمن والبيانات ومراحل الإصدار في Master Prompt لها الأولوية على الشكل عند التعارض.

> **Priority rule:** Master Prompt يحدد المنتج والسلوك والأمان ونطاق كل مرحلة. هذه الوثيقة تحدد الشكل والتفاعل داخل المرحلة المعتمدة فقط. لا تتجاوز مواصفة واجهةٌ قيداً أمنياً، ولا تجعل ميزة مؤجلة ظاهرة كأنها تعمل. إذا تعارض رقمان بين الملفين، سجل التعارض في `DECISIONS.md` واختر الأكثر أماناً مؤقتاً إلى أن يُحسم.

## Part A. Literal-mode rules (read before writing any code)

You are executing a specification, not designing. Follow these rules exactly.

1. **Do not improvise.** If an element, option, number or behavior is not written here, do not add it. If something you need is missing, choose the closest platform-standard behavior, write the choice in `/docs/DECISIONS.md` (page, element, what was missing, what you chose), and continue.
2. **Every element listed must exist** in the page and carry a test id `data-testid` using the pattern `tw-<page>-<element>` (example `tw-home-notifications-button`). Elements are built in the order listed (visual order from the start side to the end side, top to bottom).
3. **Never hard-code colors, sizes, durations or strings.** Use design tokens (colors, radii, spacing, motion) and the translation files. The tokens are in Master Build Prompt section 4. Spacing values are multiples of 4px.
4. **Units.** All sizes are CSS pixels at 1x. 'Safe top' and 'safe bottom' mean `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` (0 on desktop).
5. **Direction.** The interface is right-to-left. 'Start' means the right side in RTL (left in LTR). 'End' means the left side in RTL (right in LTR). Always write CSS with logical properties (`margin-inline-start`, `inset-inline-end`, `padding-inline`). Never write `left` or `right` in component CSS except where this document says 'physical'.
6. **Mirroring.** Mirror directional icons (back, forward, chevrons, send, reply, undo, redo, arrows, list indents, progress that fills toward the end). Do **not** mirror numbers, clocks, circular refresh icons, play triangles in media controls, logos, or the order of digits.
7. **Typography.** Arabic is set 1 to 2px larger than Latin at the same visual weight; therefore the type scale in section C.2 is the scale to use. Line-height for Arabic body text is at least 1.6. Never apply letter-spacing to Arabic text (it breaks letter joining).
8. **Touch targets.** Every tappable element targets at least 44×44 CSS px (including hit padding), with at least 8px between adjacent targets and at least 16px between a screen edge and the nearest target. This is IRQ's higher product goal; WCAG 2.2 AA minimum is 24×24 CSS px with exceptions, while 44×44 is the enhanced AAA criterion. [8] [9]
9. **Four states for everything.** Every screen that loads data has a loading state (skeleton), an empty state, an error state and an offline state. Every button has default, pressed, focus-visible, disabled and loading states.
10. **Pressed feedback.** Every tappable element scales to 0.97 and darkens its background by one step for 100ms on press (opacity 0.85 for elements without a background), then restores in 120ms. On pointer devices add a hover state only inside `@media (hover: hover)`.
11. **No layout jumps.** Reserve space for images and video with `aspect-ratio`; use skeletons with the same dimensions as the final content.
12. **Motion.** Use only the animations in section D.4, with the exact durations and easings given. Under `prefers-reduced-motion` or the in-app 'reduce motion' setting, replace movement and scaling with a 120ms opacity fade.
13. **Haptics and sounds.** Use only those in D.5 and D.6. They are off on desktop. Haptics use `navigator.vibrate` only where supported and are skipped otherwise.
14. **Text overflow.** Single-line text truncates with an ellipsis; multi-line text clamps to the number of lines given. Never let text overflow its container or wrap numbers badly.
15. **Numbers and dates.** Counts above 999 are shortened (`1.2K`, `3.4M`) using Arabic-Indic digits by default (see the numerals setting). Times follow the rule in D.9.
16. **Limits.** All numeric limits (characters, counts, sizes, durations) live in one file `lib/limits.ts` and are read from there; the values are in Appendix 1.
17. **Copy.** Every Arabic label in this document is the exact text to use, written to a key in `messages/ar.json`. Do not paraphrase.
18. **Scrolling.** Pages scroll the document body (not an inner container) on mobile so browser behaviors (address bar collapse, pull to refresh, scroll restoration) work. Exceptions are stated per page.
19. **Scroll position memory.** Each main tab (home, reels, messages, market, profile) remembers its scroll position and loaded data while the user visits other tabs, and restores them when the user returns (keep the data in the client cache; restore with `window.scrollTo` before first paint).
20. **Back behavior.** The system back gesture and the in-app back button do the same thing: close the topmost layer (keyboard, menu, sheet, dialog, viewer), otherwise go to the previous route. From a main tab root, back goes to Home; from Home, back exits the app (browser behavior).
21. **Verify.** After building each page, write a Playwright test that asserts every test id in that page's element list exists, is visible (or hidden when the spec says hidden), has the specified size within 1px, and triggers the specified action. Add a screenshot test at 360, 390, 768, 1280 and 1920px wide. Do not report a page as done until its tests pass.
22. **Honesty.** Never display fake counts, fake users or fake online status. Seed data exists only in the seed script.

### A.1 Glossary of bars (use these exact names)

- **TopBar (TB):** the fixed or collapsing strip at the top of a screen. Variants are defined in C.4.
- **BottomBar (BB):** the floating five-icon navigation bar on mobile. Defined in C.5.
- **SubBar (SB):** a strip directly under the TopBar that holds filter chips, tabs or a segmented control. Defined in C.6.
- **ComposerBar (CB):** the input strip fixed above the keyboard in chats and comments. Defined in C.7.
- **SelectionBar (SEL):** the strip that replaces the TopBar when items are selected.
- **ActionBar (AB):** a fixed strip at the bottom of a screen holding the primary call to action (for example 'Order now'). Defined in C.8.
- **Rail:** the vertical icon column on tablet; **Sidebar:** the full-width navigation column on desktop.
- **Sheet:** a panel that rises from the bottom on mobile and appears as a side panel or dialog on desktop.
- **Overlay controls:** controls drawn over full-screen media (Reels, Stories, Live).

## Part B. What people are used to (research) and what IRQ تواصل copies

Evidence and design decisions (revision 1.1): the patterns below are IRQ product choices informed by platform/accessibility documentation, not proof that one social-app layout is universally superior. Test discoverability with Iraqi users of different ages and digital literacy, then record findings. PWA capability varies by browser; detect support at runtime. [4] [6] [7]

| Topic | Verified guidance | How IRQ applies it |
| --- | --- | --- |
| PWA | Install, offline, background and push behavior depends on platform/browser support. [4] [6] | Feature-detect; provide graceful states and do not promise unsupported background behavior. |
| iOS/iPadOS Web Push | Home Screen web apps can use Web Push; permission must follow a direct user gesture. [7] | Explain installation and permission steps; show unsupported/denied states. |
| Target size | WCAG 2.2 AA minimum is 24×24 CSS px with exceptions; 44×44 is the enhanced AAA criterion. [8] [9] | IRQ deliberately keeps 44×44 CSS px as its touch-target design goal, not as a claim about AA. |
| Untrusted profile content | iframe sandbox and CSP are defense-in-depth; user code execution is discouraged and data must never be evaluated as code. [10] [11] [12] | Profile Canvas uses a validated JSON design schema and trusted renderer; no arbitrary user JavaScript. |
| Google AI Studio | Build mode supports full-stack web apps and a separate native Android workflow, source export/GitHub sync and Cloud Run deployment. [1] [2] [3] | This UI spec describes the PWA first; native screens are specified in a later phase. |

Competitor layouts (Instagram, TikTok, WhatsApp and others) are inspiration only. Do not claim their exact current layout is a research finding unless the spec records a direct source and observation date.

**IRQ تواصل navigation baseline (product decisions to test):**

1. Bottom bar order, start to end: **الرئيسية, ريلز, المحادثات (center, emphasized), السوق, الملف الشخصي**. The emphasized center position reflects IRQ's intention to foreground communication; usability-test this choice. The market is a first-level tab because merchants are first-class.
2. **Create (+) lives in the TopBar on the start side** of Home and Profile (an IRQ navigation choice, to be usability-tested), not in the bottom bar.
3. **Search** is a magnifier icon in the TopBar (end side, beside notifications) on Home; the Explore page opens from it.
4. **No global horizontal swipe between tabs** (a product hypothesis intended to reduce accidental tab changes; usability-test it). Horizontal swipes are used only inside components that clearly show a carousel (stories row, image carousel, chips, reels segmented control).
5. Tapping the active tab: if not at the top, scroll to top (smooth, 300ms); if already at the top, refresh. Same on desktop for the logo and the Home item.
6. Notifications are a separate page opened by the bell (not merged with chat), because chat has its own tab.
7. The bottom bar hides on downward scroll and returns on upward scroll **only on list pages** (Home, Explore, Video home, Messages list, Market home); it never hides on Reels and Profile; it is hidden inside focused flows (chat thread, composer, camera, story viewer, checkout, settings sub-pages).
8. Settings open from the profile TopBar menu icon (three lines), as an IRQ choice to be checked in usability sessions.

## Part C. Global layout and the bar system

### C.1 Breakpoints and layouts

| Name | Width | Layout |
| --- | --- | --- |
| Phone compact | 320 to 359 | Mobile layout; bottom bar width `calc(100% - 24px)`; type scale unchanged. |
| Phone | 360 to 429 | Mobile layout (reference width 390). |
| Phone large | 430 to 767 | Mobile layout; content max width 560px centered. |
| Tablet | 768 to 1199 | Rail (72px) + one content column up to 680px; side panels become sheets. |
| Desktop | 1200 to 1599 | Sidebar (264px) + center column 600 to 680px + end panel 340px. |
| Wide | 1600 to 2199 | Same as desktop; gutters grow; columns do not stretch. |
| Ultra-wide | 2200 and above | Same as wide; add `max-width: 1760px` to the whole app and center it. |

Screen edge margin (phone): 16px; tablet and desktop content: 24px. Vertical rhythm: sections separated by 24px; list rows separated by a 1px hairline `--border` unless stated.

### C.2 Type scale (final)

| Token | Size / line-height | Weight | Use |
| --- | --- | --- | --- |
| `text-xs` | 12 / 18 | 500 | timestamps, badges, tab labels |
| `text-sm` | 13 / 20 | 500 | secondary text, captions in cards, chips |
| `text-base` | 15 / 25 | 400 | body, comments, chat messages |
| `text-md` | 16 / 26 | 500 | list titles, buttons |
| `text-lg` | 18 / 28 | 600 | section titles |
| `text-xl` | 22 / 32 | 700 | page titles |
| `text-2xl` | 28 / 38 | 700 | large numbers, empty-state titles |
| `display` | Reem Kufi 26 / 32 | 700 | logo and top-bar titles on root pages only |

### C.3 Z-index and overlay order (lowest to highest)

content 0, sticky SubBar 10, TopBar 20, BottomBar 30, FAB 35, ActionBar 40, dropdown and popover 50, Sheet 60, Dialog 70, MediaViewer and StoryViewer 80, Toast and Snackbar 90, system banners (offline, update) 100.

### C.4 TopBar variants (TB)

Common: height **56px + safe top**; background `--bg`; a 1px bottom border `--border` that fades in (opacity 0 to 1 over 120ms) when the page has scrolled more than 4px; no shadow; side padding 8px; icon buttons 44 by 44 with a 24px icon at stroke 1.8; title text uses `display` or `text-xl` as stated.

| ID | Name | Slots, start side to end side (RTL: right to left) | Used on |
| --- | --- | --- | --- |
| TB-ROOT | Root with logo | **\[Create +\]** button; centered **logo** (wedge mark 26px + wordmark 'تواصل' in `display`); end group **\[Search\]\[Notifications bell\]** | `/home` |
| TB-TITLE | Root with title | Title text in `display` at the start side (not centered); end group of up to 2 icon buttons defined per page | `/messages`, `/market`, `/video`, `/notifications` when opened as a tab |
| TB-INNER | Inner page | **\[Back\]** button (mirrored chevron); title in `text-lg` centered (single line, ellipsis); end group of up to 2 actions | all pushed pages without special needs |
| TB-PROFILE | Own profile | Start: **\[Create +\]**; center: `@username` in `text-lg` with a small lock icon if private and a chevron-down that opens the account switcher; end: **\[Menu ☰\]** | `/u/[me]` |
| TB-USER | Other profile | Start: **\[Back\]**; center: `@username`; end: **\[More ⋯\]** | `/u/[other]` |
| TB-SEARCH | Search entry | Full-width rounded search field (height 40, radius 999) with a magnifier icon inside the start side; tapping navigates to `/search` | `/explore` |
| TB-SEARCH-ACTIVE | Active search | **\[Back\]**, text field (autofocus, clear button), **\[Cancel\]** text button hidden on desktop | `/search` |
| TB-CHAT | Chat thread | **\[Back\]**; avatar 36; two-line block (name in `text-md`, status in `text-xs` muted); end group **\[Voice call\]\[Video call\]\[Menu ⋯\]** | `/messages/[id]` |
| TB-MODAL | Full-screen flow | **\[Close ✕\]** at the start side; title centered; one text action button at the end (for example 'Next', 'Share', 'Save') | composer, editors, creators |
| TB-OVERLAY | Over media | Transparent; no border; icons white with a 1px dark text-shadow equivalent (`drop-shadow(0 1px 2px rgba(0,0,0,.6))`) | Reels, Live, Stories, Media viewer |
| TB-NONE | No bar | Nothing is rendered | player pages that draw their own controls |
| SEL | Selection mode | Replaces the current TB: **\[Close ✕\]**, text 'تم تحديد N', end group of contextual actions (per page) | message list, saved, files |

**Collapse behavior of TopBars:** TB-ROOT and TB-TITLE collapse (translateY(-100%), 200ms, `ease-standard`) when the user has scrolled down 48px cumulatively in one direction, and return (200ms) when the user scrolls up 24px cumulatively or reaches the top. TB-INNER, TB-PROFILE, TB-USER, TB-CHAT, TB-MODAL, TB-SEARCH never collapse. A collapsed TB leaves its SubBar stuck at `top: safe top`.

### C.5 BottomBar (BB), exact specification (mobile below 768px only)

**Anatomy:** a floating glass pill.

- Position: `position: fixed; bottom: calc(16px + safe bottom)`; width `min(340px, calc(100% - 32px))`; height **64px**; border-radius 32px.
- Alignment follows the handedness setting `ui.handedness`: `center` (default): centered; `right`: aligned to the right edge with a 16px margin (physical right); `left`: aligned to the left edge with a 16px margin (physical left). In the left and right modes the width is `min(340px, calc(100% - 32px))` as well.
- Surface: background `--glass-bg`, `backdrop-filter: blur(16px) saturate(140%)`, 1px border `--glass-border`, shadow `0 10px 30px rgba(40,30,20,.14)` (light) or `0 10px 30px rgba(0,0,0,.5)` (dark). With 'reduce transparency' on or no `backdrop-filter` support, use solid `--surface`.
- Five slots, equal width, icons only (**no text labels**, but each has an `aria-label`). Slot order from the start side: **1 الرئيسية (house), 2 ريلز (play in rounded square), 3 المحادثات (speech bubble, center), 4 السوق (storefront), 5 الملف الشخصي (the user's avatar 28px circle, or a person icon when logged out)**.
- Icons: 25px, stroke 1.8, color `--text-muted` when inactive. **Active** slot: icon color `--primary`, stroke 2.2 (filled variant when available), plus a 4px circle dot in `--primary` 6px below the icon. Slot 5 shows a 2px `--primary` ring around the avatar when active.
- **Center slot (chat):** a 54px circle filled with `--primary`, icon white 26px, centered vertically; the circle overflows the bar by 0px (it sits inside); when the chat tab is active the circle gets a 3px `--primary-tint` outer ring. Unread messages show a badge (below).
- **Badges:** pill, min width 18, height 18, font 11 weight 700, background `--accent`, text white, 2px ring in the surface color; position: top 8px, `inset-inline-end` 10px of the slot. Text is the count up to `99`, then `99+`. For notifications on the bell and for new posts on Home, use a 9px dot without a number.
- **Press:** the pressed slot scales 0.92 for 100ms. **Haptic:** light on tab change.
- **Long press (500ms) on the center slot:** opens the 'recent chats' sheet (D.8 quick sheet) with a medium haptic.
- **Tap rules:** tapping an inactive slot navigates to that tab's root (restoring its remembered scroll). Tapping the active slot: if the page is scrolled, scroll to top smoothly over 300ms; if already at the top on Home, Messages or Market, trigger refresh (pull-to-refresh spinner at the top, minimum visible 600ms).
- **Show and hide rules (final):**
  1. **Visible** on these roots: `/home`, `/explore`, `/reels` (dark variant), `/live` (dark variant), `/video`, `/messages` (list only), `/market`, `/u/[me]`, `/notifications`.
  2. **Hide-on-scroll** (hide after 48px down, show after 24px up, translateY(calc(100% + 32px)) in 200ms `ease-standard`): `/home`, `/explore`, `/video`, `/messages`, `/market`, `/notifications`.
  3. **Never hides while scrolling:** `/reels`, `/live`, `/u/[me]`.
  4. **Hidden** (not rendered; slides down 200ms when entering, up 200ms when leaving) on every other route, including chat threads, search, post detail, any composer, creator or camera, story viewer, media viewer, checkout, order pages, settings and its sub-pages, canvas editor, onboarding and auth, and any full-screen player.
  5. **Hidden while the on-screen keyboard is open** (visual viewport height smaller than layout viewport height by more than 150px) and shown again 150ms after it closes.
  6. **Dark variant on `/reels` and `/live`:** background `rgba(20,16,14,.55)`, border `rgba(255,255,255,.14)`, inactive icons `rgba(255,255,255,.75)`, active icon white with a white dot.
  7. While a call or live room is active, a **CallBar** (44px high pill, above the BottomBar, 8px gap) appears with a timer, mute and end buttons; tapping it returns to the call.
- **Tablet and desktop:** the bottom bar is not rendered; use the Rail and Sidebar (C.9).

### C.6 SubBar (SB) types

| ID | Name | Spec |
| --- | --- | --- |
| SB-CHIPS | Filter chips | Height 48; chips 36px high, radius 999, padding 0 14px, gap 8px, horizontal scroll with snap, no scrollbar, 16px start padding; selected chip: filled `--primary` with `--primary-fg` text; unselected: `--surface` with 1px `--border`. Sticky below the TB; when the TB collapses it sticks to `top: safe top`. A 1px bottom border appears when stuck. |
| SB-TABS | Underline tabs | Height 48; equal-width tabs; label `text-md`; active label `--text` with a 3px `--primary` underline (width equal to the label, radius 3px) that slides in 200ms; inactive `--text-muted`. Sticky. Swiping horizontally on the content switches tabs only where the page says so. |
| SB-ICONTABS | Icon tabs (profile) | Height 48; three to five icon-only tabs (24px icons); active icon `--text` with a 2px underline spanning the tab width. Sticky. |
| SB-SEGMENT | Segmented control | Height 40, radius 999, track `--surface-2`, selected thumb `--surface` with a small shadow that slides in 200ms; 2 to 4 segments. Not sticky unless the page says. |

### C.7 ComposerBar (CB)

Fixed above the keyboard (use `visualViewport` to position it; `bottom: 0` plus safe bottom when the keyboard is closed). Min height 56, max height 56 + 4 lines of text (the text area grows up to 6 lines, 144px, then scrolls). Surface `--bg` with a top hairline. Layout from the start side: **\[Emoji/Sticker\]** icon button, text area (flex 1, radius 24, `--surface-2`, padding 12px 16px), **\[Attach\]** icon button (hidden while text is entered on comment bars), then the **Send/Mic** button 44px circle (`--primary`, white icon): shows the microphone when the field is empty (chat only) and the send arrow when text exists, with a 120ms cross-fade and scale 0.8 to 1.

### C.8 ActionBar (AB)

Fixed at the bottom of a page, height 72 + safe bottom, surface `--surface`, top hairline, padding 12px 16px, buttons 48px high. Contents per page. It is a sibling of the BottomBar rules: pages with an ActionBar never show the BottomBar.

### C.9 Tablet Rail and desktop Sidebar (exact)

**Rail (768 to 1199):** width 72, full height, background `--glass-bg` with blur, end border hairline. Top: logo mark 32px (links to `/home`). Items (44px icon buttons, 8px gap, vertically centered group): Home, Explore, Reels, Video, Messages (badge), Communities, Market, Notifications (badge), Wallet, Profile avatar; bottom: **\[+ New post\]** 48px round primary button, then Settings. Tooltip on hover or focus (label). Active item: `--primary-tint` rounded square 48px behind the icon, icon `--primary`.

**Sidebar (1200 and above):** width 264, same surface. Top: logo (wedge mark + wordmark). Items (height 48, radius 12, padding 0 12px, icon 24 + 16px gap + label `text-md`), in this order: الرئيسية, استكشاف, ريلز, فيديو, مباشر, المحادثات (badge), المجتمعات, السوق, الإشعارات (badge), المحفظة, الملف الشخصي. Then the full-width **'منشور جديد'** button (48px, `--primary`). Bottom: account card (avatar 40, name, `@username`, chevron) that opens a menu with: switch account, add account, settings, help, sign out. Active item: background `--primary-tint`, text `--primary-text`, a 3px `--primary` bar at the start edge (inside, full item height). Clicking the active item scrolls to top; the logo does the same on `/home`.

### C.10 Bar visibility matrix (mobile; this table is the law)

Columns: **TB** = TopBar variant; **BB** = BottomBar (V = visible and hides on scroll, P = visible and never hides, D = dark variant never hides, H = hidden); **SB** = SubBar; **Fixed bars** = how many bars are on screen at rest (TB + SB + BB/CB/AB, not counting the stories row or media controls).

| Route | TB | BB | SB | Fixed bars | Notes |
| --- | --- | --- | --- | --- | --- |
| `/home` | TB-ROOT | V | SB-CHIPS (stories row scrolls away above it) | 3 | TB and BB collapse together on scroll down; chips stay stuck. |
| `/explore` | TB-SEARCH | V | SB-CHIPS (topics) | 3 | Grid below. |
| `/search` | TB-SEARCH-ACTIVE | H | SB-TABS (الكل, الأشخاص, المنشورات, الوسوم, الفيديو, المجتمعات, السوق, المتاجر; horizontally scrollable) | 2 | Keyboard open at start. |
| `/reels` | TB-OVERLAY (segmented control 'ريلز مباشر فيديو' centered, search icon at the end) | D | none | 1 (BB only) | Full-screen vertical pager. |
| `/live` | TB-OVERLAY (same segmented control) | D | SB-CHIPS (categories) drawn over the content | 2 |  |
| `/live/[id]` | TB-OVERLAY | H | none | 0 | Chat input is a CB over the lower half. |
| `/live/start` | TB-MODAL | H | none | 1 + AB | AB: 'ابدأ البث'. |
| `/video` | TB-TITLE ('فيديو', end: search, upload) | V | SB-CHIPS (categories) | 3 |  |
| `/video/[id]` | TB-NONE (player pinned at the top, 16:9) | H | SB-TABS ('التفاصيل', 'التعليقات', 'التالي') under the player | 1 | Full-screen landscape on rotate. |
| `/messages` | TB-TITLE ('المحادثات', end: new chat, notifications) | V | SB-CHIPS (الكل, شخصية, مجموعات, قنوات, مجتمعات, تجار, غير مقروء) below a search field | 3 | Search field scrolls away; chips stay. |
| `/messages/[id]` | TB-CHAT | H | none | 2 (TB + CB) | Keyboard pushes CB up. |
| `/messages/new` | TB-MODAL ('محادثة جديدة') | H | none | 1 |  |
| `/messages/[id]/info` | TB-INNER | H | SB-TABS (وسائط, ملفات, روابط) | 2 |  |
| `/messages/calls`, `/messages/starred` | TB-INNER | H | none | 1 |  |
| `/communities` | TB-TITLE ('المجتمعات', end: search, create) | H on mobile (reachable from Explore and the profile More menu; Sidebar on tablet/desktop) | SB-CHIPS | 2 |  |
| `/communities/[slug]` | TB-INNER | H | SB-TABS (الرئيسية, القنوات, الأعضاء, الفعاليات, عن المجتمع) | 2 |  |
| `/communities/[slug]/[channelId]` | TB-CHAT (channel name, member count) | H | none | 2 (TB + CB) | Voice channel opens the voice room full screen. |
| `/market` | TB-TITLE ('السوق', end: cart with badge, notifications) + province chip row | V | SB-CHIPS (categories) | 3 | The search field sits under the TB and scrolls away. |
| `/market/p/[id]` | TB-OVERLAY over the gallery (back, share, wishlist) turning into TB-INNER after 200px of scroll | H | none | 0 + AB ('اطلب الآن') |  |
| `/market/cart` | TB-INNER ('السلة') | H | none | 1 + AB ('متابعة للطلب') |  |
| `/market/checkout` | TB-MODAL ('تأكيد الطلب') | H | none | 1 + AB ('تأكيد الطلب') | Focused flow. |
| `/market/orders`, `/market/orders/[id]` | TB-INNER | H | SB-TABS on the list | 2 |  |
| `/market/seller/*` | TB-INNER | H | SB-TABS on the dashboard | 2 |  |
| `/shop/[slug]` | TB-OVERLAY over the banner then TB-INNER | H | SB-TABS (المنتجات, المنشورات, التقييمات, عن المتجر) | 2 |  |
| `/notifications` | TB-TITLE ('الإشعارات', end: settings) | V | SB-TABS (الكل, التفاعلات, المشاركات, الطلبات, النظام) | 3 |  |
| `/u/[me]` | TB-PROFILE | P | SB-ICONTABS (grid, reels, video, text, tagged, shop for merchants) | 3 |  |
| `/u/[other]` | TB-USER | H | SB-ICONTABS | 2 |  |
| `/u/[x]/followers`, `/following` | TB-INNER | H | SB-TABS (متابعون / يتابع) | 2 |  |
| `/p/[id]` | TB-INNER ('منشور') | H | none | 2 (TB + CB for comment) | Comment CB is fixed at the bottom. |
| `/saved`, `/saved/[id]` | TB-INNER (end: add collection / select) | H | SB-TABS (inside a collection) | 1 to 2 |  |
| `/tag/[tag]`, `/province/[slug]` | TB-INNER | H | SB-TABS | 2 |  |
| `/compose` and every `/create/*` | TB-MODAL | H | none | 1 (+ tool bars inside creators) |  |
| `/create/story`, `/create/reel` (camera and editor) | TB-OVERLAY | H | none | 0 (+ tool rails over media) |  |
| Story viewer, media viewer | TB-OVERLAY | H | none | 0 | Own controls only. |
| `/wallet` | TB-INNER | H | SB-TABS (الرصيد, المعاملات, الهدايا) | 2 |  |
| `/canvas`, `/canvas/[id]` | TB-INNER | H | SB-CHIPS | 2 |  |
| `/canvas/editor/*` | TB-MODAL | H | bottom tab bar of the editor (معاينة، تخطيط، مظهر، ذكاء اصطناعي) | 2 |  |
| `/settings` and sub-pages | TB-INNER | H | none (search field scrolls away) | 1 |  |
| `/login`, `/register`, `/onboarding` | TB-NONE (step indicator at the top) | H | none | 0 |  |
| Error pages | TB-INNER with back, or TB-NONE | H | none | 0 to 1 |  |

**Desktop and tablet:** the Sidebar or Rail is always visible on every route except onboarding, auth, story viewer, media viewer, camera, live watch (collapses to Rail), call screens and the Canvas editor (collapses to Rail). TopBars on desktop are 56px sticky bars inside the center column and never collapse. SubBars are sticky under them. There is no BottomBar.

### C.11 Other fixed or floating elements

- **FAB (floating action button):** only on `/market/seller/products` ('منتج جديد'), `/communities` ('إنشاء مجتمع') and `/messages` on tablet (new chat). 56px circle, `--primary`, white icon 24, bottom 24px + safe bottom, `inset-inline-end` 16px, shadow `0 8px 20px rgba(0,0,0,.2)`; hides on scroll down like the BB; never together with the BottomBar on the same corner (when the BB is visible, bottom offset is 96px + safe bottom).
- **New posts pill:** on `/home` when new posts exist and the user is scrolled down: pill 'منشورات جديدة' (height 36, `--primary`, white text, up arrow icon) fixed below the TB (top: 64px + safe top), centered; tap scrolls to top and loads; auto-hides after 8 seconds or when the user scrolls to the top.
- **Scroll-to-bottom button (chat):** 40px circle, `--surface`, shadow, down arrow, with an unread count badge; appears when the user is more than 300px above the bottom; `inset-inline-end` 16px, 16px above the CB.
- **Offline banner:** a 32px strip below the TB: 'لا يوجد اتصال بالإنترنت' on `--warning` tint; slides down 200ms; when the connection returns it turns green with 'عاد الاتصال' for 2 seconds then slides up.
- **Update banner:** 'تحديث جديد متاح' with a 'تحديث' button, shown above the BB for 10 seconds or until dismissed.

## Part D. Interaction system

### D.1 Gesture matrix

| Gesture | Where | Result |
| --- | --- | --- |
| Tap | any control | Primary action. |
| Double tap | post media, reel, story | Like (heart burst at the touch point, D.4). If already liked, only the burst plays (no unlike). |
| Long press 400ms | post media | Opens the quick preview (media enlarged in an overlay, release to close). |
| Long press 400ms | chat message | Reaction bar above (6 reactions) and action menu below; medium haptic. |
| Long press 500ms | bottom bar center slot | Recent chats sheet. |
| Long press 400ms | row in a list (chat, notification, saved item) | Enters selection mode (SEL) with the row selected; light haptic. |
| Long press 400ms | like button | Reaction picker (6 reactions). |
| Long press (hold) | reel video | Pause while holding; release resumes. |
| Swipe toward the end on a chat row | messages list | Reveals Pin and Mute (each 72px wide). |
| Swipe toward the start on a chat row | messages list | Reveals Archive and Delete (each 72px wide); full swipe past 60% of the width triggers the first action after a medium haptic. |
| Swipe toward the end on a chat message | thread | Reply (threshold 56px, an arrow icon fades in, light haptic at threshold, bubble springs back in 200ms). |
| Swipe up | reel pager | Next reel (snap). Swipe down: previous. |
| Swipe down | story viewer, media viewer, sheet header, video player (minimize) | Dismiss (threshold 120px or velocity above 0.6 px/ms). |
| Swipe up | story viewer | Opens the reply field and keyboard. |
| Horizontal swipe | carousel, chips row, stories row, tabs where allowed | Scroll with snap. |
| Pinch | media viewer, map, image crop | Zoom 1x to 4x; double tap toggles 1x and 2.5x. |
| Pull down at the top | feed lists | Pull to refresh (D.7). |
| Edge swipe from the start edge | any pushed page | Back (browser behavior; do not intercept). |

**No other gestures exist.** In particular: no horizontal swipe between bottom tabs, no shake, no multi-finger gestures.

### D.2 Press, hover, focus

Press: see rule 10 in Part A. Focus-visible: 2px `--ring` outline with 2px offset on every interactive element, never removed. Hover (pointer devices only): background moves one step toward `--surface-2`; icons get `--text`; cursor pointer. Disabled: opacity 0.4, no pointer events, `aria-disabled`.

### D.3 Keyboard (physical keyboard users)

Tab order follows visual order. Enter and Space activate buttons. Escape closes the topmost layer. Arrow keys move inside menus, tabs, segmented controls, carousels, reels (up and down), stories (start and end sides), and the media viewer. Shortcuts are listed in Master Build Prompt section 7 and are active only on desktop.

### D.4 Animation catalog (the only animations that exist)

Durations use the motion tokens: `fast` 120ms, `base` 200ms, `slow` 320ms, `xslow` 480ms. Easing tokens: `standard` = cubic-bezier(.2,.8,.2,1); `exit` = cubic-bezier(.4,0,1,1); `spring` = a spring with stiffness 380, damping 28, mass 1 (use `motion`). All are disabled or replaced under reduced motion (rule 12).

| ID | Trigger | Property change | Duration and easing | Reduced-motion alternative |
| --- | --- | --- | --- | --- |
| A01 press | pointer down on any control | scale 1 to 0.97 (BB slot 0.92), background one step darker | 100ms linear down, 120ms standard up | none (no movement) |
| A02 page push | navigating to a pushed page | new page `translateX` from 24px toward the end to 0 plus opacity 0 to 1; old page opacity 1 to 0.9 | 200ms standard | 120ms fade |
| A03 page pop | back | reverse of A02 | 200ms exit | 120ms fade |
| A04 tab switch | bottom tab change | cross-fade only (opacity) | 120ms linear | same |
| A05 bar hide/show | scroll threshold | BB `translateY(calc(100% + 32px))`; TB `translateY(-100%)` | 200ms standard | instant opacity 0/1 over 120ms |
| A06 sheet open | opening a sheet | `translateY(100%)` to 0, backdrop opacity 0 to 0.5 | 320ms spring (desktop: scale .98 to 1 + fade 200ms) | 120ms fade |
| A07 sheet close | close, swipe down | reverse | 200ms exit | 120ms fade |
| A08 dialog | open dialog | scale 0.95 to 1, opacity 0 to 1 | 200ms standard | 120ms fade |
| A09 like burst | like by tap or double tap | heart icon scale 1 to 1.35 to 1 (spring); 8 small particles radiate 28px and fade; color to `--danger` | 480ms | color change only |
| A10 follow morph | tap Follow | button width animates to the new label width; fill changes from `--primary` to `--surface-2`; check icon fades in | 200ms standard | instant |
| A11 skeleton shimmer | loading | linear-gradient highlight sweeps toward the end | 1400ms linear infinite | static placeholders without sweep |
| A12 toast in/out | show a toast | `translateY(16px)` to 0 + opacity | in 200ms standard, out 160ms exit | fade only |
| A13 tab indicator | change SB-TABS | underline `translateX` and width | 200ms standard | instant |
| A14 story progress | story plays | the active segment fill `scaleX` 0 to 1 (transform-origin at the start side) linear over the story duration | linear | still allowed (not decorative) |
| A15 story advance | next story | content cross-fade; on moving to another user a cube-less slide: `translateX` 100% toward the start | 240ms standard | 120ms fade |
| A16 reel advance | pager snap | vertical snap to next reel | 280ms standard | same (no decoration) |
| A17 heart on reel double tap | double tap | large white heart 96px scale 0.6 to 1.1 to 1 and fades out | 700ms total | fade only |
| A18 reaction picker | long press like | 6 reactions pop in with 40ms stagger, scale 0.5 to 1 | 200ms spring | fade |
| A19 message send | tap send | bubble appears from the CB position: translateY 12px to 0 + opacity | 200ms standard | fade |
| A20 typing dots | remote typing | three 6px dots bounce `translateY(0, -4px, 0)` with 160ms offsets | 900ms infinite | three static dots |
| A21 pull to refresh | pull and release | spinner scales in and rotates | rotate 800ms linear infinite | static spinner |
| A22 count change | like or comment count changes | number slides up 8px and fades (old out, new in) | 160ms standard | instant |
| A23 badge pop | a badge appears | scale 0 to 1.2 to 1 | 240ms spring | fade |
| A24 FAB | appear | scale 0.6 to 1 + fade | 200ms spring | fade |
| A25 image fade-in | media loads | blurhash cross-fades to the image | 200ms linear | same |
| A26 offline banner | connectivity change | `translateY(-100%)` to 0 | 200ms standard | fade |
| A27 success check | upload or action succeeds | circle stroke draws then check draws | 480ms standard | static check |

### D.5 Haptics (mobile only)

Light (10ms): tab change, toggle switch, selection change, swipe threshold, like. Medium (20ms): long-press menu open, delete confirm, pull-to-refresh trigger. Success pattern (10, 40, 10 ms): order placed, post published. Error pattern (30, 40, 30 ms): failed action with a toast. Never vibrate on scroll or on every keystroke.

### D.6 Sounds (off by default; master toggle in settings)

Message sent (soft pop, 120ms), message received while the thread is open (soft tick, 120ms), notification (two-note chime, 400ms), call ringtone (looped, 2 seconds period), like (none), story advance (none). All are short, normalized to -16 LUFS, in Opus or MP3 files that the agent finds with a permissive license and records in ASSETS.md.

### D.7 Loading, refresh and infinite scroll

- **Skeletons:** one per content type, same dimensions as the final content (post card: header row with a 38px circle and two lines, a media block of the post's ratio, an action row of four 26px circles; chat row: 50px circle and two lines; product card: square block and two lines; comment: 32px circle and two lines). Shimmer A11.
- **Pull to refresh:** pull distance 72px reveals a 28px spinner; release above 64px triggers; the spinner stays at least 600ms; the list content shifts down by the spinner height; haptic medium at the threshold.
- **Infinite scroll:** load the next page of 12 items when the last 4 items enter the viewport (use an IntersectionObserver with a 600px root margin); show 2 skeleton items while loading; on error show a row with 'تعذّر التحميل' and a 'إعادة المحاولة' button; at the end show a quiet row 'وصلت لنهاية القائمة'.
- **Virtualization:** lists above 100 rendered items use virtualization; chat threads keep at most 200 messages in the DOM.
- **Buttons loading:** the label is replaced by a 18px spinner, the width is locked to the previous width, and the button is disabled.

### D.8 Feedback components

- **Toast:** bottom, above the BB (bottom 96px + safe bottom when the BB is visible, otherwise 24px + safe bottom), width `min(420px, calc(100% - 32px))`, radius 12, `--ink` background (dark in light mode, light in dark mode), text 14px, icon 20px, optional action text button; visible 3000ms (5000ms with an action or an error); swipe to dismiss; one toast at a time (new ones replace).
- **Undo snackbar:** same placement, 5000ms, with an 'تراجع' button; used for delete post, delete comment, archive chat, remove from saved, unfollow from lists.
- **Confirm dialog:** required for: delete account, delete post (permanent), block, clear chat, leave group, remove follower, discard unsaved changes, disconnect all sessions. Not required for: like, follow, unfollow (use undo), save, archive (use undo). Dialog: width `min(320px, calc(100% - 48px))`, title `text-lg`, body `text-base`, two buttons stacked or side by side; destructive button uses `--danger`; Cancel is the default focus.
- **Quick sheet (recent chats):** bottom sheet 50% height listing up to 6 recent chats (avatar, name, unread dot); tapping opens the thread.
- **Sheets:** detents 50% and 90% of the viewport height; drag handle 36 by 4px radius 2 centered 8px from the top; header 56px with a title and an optional end action; swiping down from the handle or header closes; tapping the backdrop closes; Escape closes; focus is trapped and restored.

### D.9 Times and numbers

- **Relative time:** under 1 minute 'الآن'; 1 to 59 minutes 'قبل N دقيقة' (correct Arabic plural forms); 1 to 23 hours 'قبل N ساعة'; 1 to 6 days 'قبل N يوم'; 7 days and more: date as 'D شهر' this year, 'D شهر YYYY' other years, with Iraqi month names.
- **Chat list time:** today: clock `h:mm` with ص/م; yesterday: 'أمس'; within 6 days: weekday name; else short date.
- **Counts:** below 1,000 exact; 1,000 to 9,999 `1.2K` form ('١٫٢ ألف'); above, `K` and `M` (ألف, مليون). Use the numerals setting. Use `Intl.NumberFormat('ar-IQ', { notation: 'compact' })` and keep the unit words Arabic.
- **Duration (video):** `m:ss` or `h:mm:ss`, always left-to-right digit order inside a `<bdi>`.

## Part E. Components (exact specifications)

Colors are tokens from Master Build Prompt 4.1. Extra tokens used here: `--bubble-own` (light `#D7E8EC`, dark `#12404C`), `--bubble-other` (= `--surface`), `--ink` (light `#2A2622`, dark `#F1F5F9`), `--scrim` (`rgba(0,0,0,.5)`), `--live` (`#E5484D`, red, only for live badges), `--verified` (= `--primary`), `--merchant` (= `--accent`).

### E.1 Buttons

| Variant | Height | Radius | Padding | Fill, text, border | Use |
| --- | --- | --- | --- | --- | --- |
| Primary (lg) | 56 | 16 | 0 24 | `--primary`, `--primary-fg` | one per screen: main call to action |
| Primary (md, default) | 48 | 14 | 0 20 | same | forms, ActionBar |
| Primary (sm) | 36 | 12 | 0 16 | same, `text-sm` weight 600 | inline (Follow) |
| Secondary | 48 / 36 | 14 / 12 | same | `--surface-2`, `--text` | secondary actions |
| Outline | 48 / 36 | same | same | transparent, 1px `--border`, `--text` | tertiary |
| Ghost | 48 / 36 | same | 0 12 | transparent, `--primary-text` | text actions |
| Danger | 48 / 36 | same | same | `--danger`, white | destructive confirms |
| Copper (commerce) | 48 / 36 | same | same | `--accent`, white | 'اطلب', 'اطلب الآن', 'افتح متجرك' |
| Icon button | 44 hit, 24 icon | 14 | none | transparent | toolbars |
| Round icon button (overlay) | 44 | 999 | none | `rgba(30,26,22,.55)` with white icon | over media |

Label: `text-md` weight 600, single line, centered; icon (optional) 20px with 8px gap, placed at the start side. Minimum width 88 for md and 72 for sm. Full-width buttons use `width: 100%`. Disabled: opacity 0.4.

**Follow button (the exact state machine):** states `follow` ('متابعة', Primary sm), `requested` ('تم الطلب', Secondary sm), `following` ('يتابعه', Secondary sm with a check icon; tapping opens an action sheet with 'إلغاء المتابعة', 'أصدقاء مقربون', 'كتم', 'إشعارات المنشورات'), `follow_back` ('تابعه أيضاً', Primary sm), `blocked` ('إلغاء الحظر', Outline sm). Transition animation A10. Optimistic update; on failure revert and show an error toast.

### E.2 Avatars, rings and badges

Avatar sizes: 24, 32, 38, 40, 48, 56, 72, 96 (profile), 120 (edit profile). Always a circle; `object-fit: cover`; blurhash placeholder; fallback: first letter of the display name (Arabic first letter, or Latin uppercase) on a tinted circle (one of 8 tints chosen by `hash(userId) % 8`, text color the matching dark tone; all pairs at least 4.5:1), font weight 700 at 40% of the avatar size.

**Story ring:** drawn as a 2.5px ring plus a 3px gap (inner padding) around the avatar; unseen: `--primary` ring (merchants: `--accent`; close friends: `#2F6B3F` green); seen: `--border` ring; the user's own story with no content: dashed 2px ring `#9BB9C0` and a 20px plus badge at the bottom end corner (`--primary` circle, white plus, 2px ring in `--bg`). Ring outer size = avatar + 11px.

**Online dot:** 12px circle `--success`, 2px ring in the surface color, at the bottom end corner of the avatar; shown only when both users allow activity status.

**Verified mark:** 16px circle in `--verified` with a white check (identity) or `--merchant` (merchant), placed 4px after the name; has `aria-label` 'حساب موثّق' or 'متجر موثّق'.

**Count badge:** see C.5. **Tag pill (category, status):** height 22, radius 6, padding 0 8, `text-xs` weight 600, tinted background with the matching dark text.

### E.3 Form controls

| Control | Spec |
| --- | --- |
| Text field | Label above (`text-sm`, weight 600, 8px gap); field height 48, radius 12, 1px `--border`, padding 0 16, `text-base`; focus: 2px `--primary` border; error: 2px `--danger` border and an error line below (`text-sm`, `--danger`, with an alert icon); helper text `text-sm` muted; character counter at the end of the label row when a limit exists (turns `--warning` at 90%, `--danger` at 100%). |
| Password field | As text field plus an eye toggle button at the end ('إظهار' or 'إخفاء'), strength meter (4 segments) under it, paste allowed. |
| Search field | Height 40 (46 on lists), radius 999, `--surface-2`, magnifier 18px at the start, clear button appears when text exists, placeholder muted. |
| Textarea | Min height 96, auto-grows to 240, then scrolls. |
| Select | Opens a bottom sheet list (mobile) or a dropdown (desktop); the field shows the value and a chevron. |
| Switch | 52 by 32 track, 24px thumb; on: `--primary` track; off: `--border` track; thumb slides 20px in 200ms; hit area is the whole row. |
| Checkbox and radio | 24px visual, 44px hit; checked: `--primary` fill with a white check or a 10px dot. |
| Slider | Track 4px, thumb 24px, value label above the thumb while dragging; steps shown as ticks for discrete sliders. |
| Segmented | SB-SEGMENT (C.6). |
| OTP | 6 boxes 48 by 56, gap 8, auto-advance, paste fills all, numeric keyboard, direction LTR for the digits. |
| Date and time | Opens a sheet with a scroll wheel (mobile) or a calendar popover (desktop); Gregorian with Iraqi month names. |

### E.4 Post card (mobile, exact)

Posts on mobile are **edge to edge**: no card border, no side padding for media. Posts are separated by an 8px band of `--surface-2`.

| Region | Height / size | Content and behavior |
| --- | --- | --- |
| Header | 56 | Avatar 38 with story ring (tap opens stories or the profile); two lines: name (`text-md`, weight 600, verified mark) and subline (`text-xs` muted: music note icon 13px + track name, or location, or 'إعلان' for sponsored); end: **\[More ☰\]** icon button (three horizontal lines icon). Tap on the name or avatar opens the profile. |
| Media | width 100%, ratio rule below | Image, carousel or video. |
| Overlay: counter | pill at the top end, 12px inset, `rgba(30,26,22,.72)`, white `text-xs` weight 600: '١/٥' | only for carousels. |
| Overlay: product bag | 44 circle, bottom end 12px, `rgba(30,26,22,.72)`, bag icon 22 white | only when the post has tagged products; opens the product sheet. |
| Overlay: mute | 32 circle bottom start 12px | only on videos. |
| Dots | 6px dots, gap 5px, centered, margin-top 10px; active `--primary`, inactive `#CFC6B8` (dark mode `#4A433C`); more than 5 slides show at most 5 dots with the outer ones smaller (4px) | carousels. |
| Action row | 48, padding 0 6px | Icon buttons (44 hit, 26 icon) in this order from the start: **إعجاب** (heart), **تعليق** (bubble), **إعادة نشر** (two arrows), **مشاركة** (paper plane, mirrored); spacer; **حفظ** (bookmark) at the end. No numbers inside the row. |
| Likes line | 24, padding 0 16 | 'أعجب به {name} و{n} آخرين' (or '{n} إعجاب' when no friend liked) in `text-sm` weight 600; tap opens the likes list sheet. Hidden when the owner hid counts. |
| Caption | auto, padding 0 16 | Author name (weight 600) then text (`text-base`), clamp 3 lines; 'المزيد' inline link at the end of line 3; hashtags and mentions in `--primary-text`. |
| Comments link | 28 | 'عرض كل {n} تعليق' (`text-sm`, muted); opens the comments sheet. Hidden when 0 comments. |
| Time | 24 | relative time (D.9) in `text-xs` muted; bottom padding 12. |

**Media ratio rule:** allowed display ratios are between 4:5 (0.8) and 1.91:1. Native ratio inside that range is kept. Taller media is shown in a 4:5 frame (`object-fit: cover`, focal point at the center or the user's chosen focal point). Wider media is shown in a 1.91:1 frame the same way. Tapping once on an image opens the MediaViewer with the uncropped image. For carousels all slides use the first slide's frame.

**Double tap on media** likes (A09 at the touch point). **Single tap on a video** toggles play and pause (a 56px play or pause glyph fades in the center for 600ms). Videos autoplay muted when at least 60% visible, pause at 40%, only one plays at a time; autoplay obeys the autoplay setting.

**Variants:** (1) *Text post:* no media; text in `text-post` style (17px, line-height 30px), padding 12 16, clamp 8 lines with 'المزيد'; optional link-preview card (radius 16, 1px border, image 16:9 on top, title 2 lines, domain 1 line); optional thread chip 'سلسلة · {n} منشورات'; action row order: رد, إعادة نشر, إعجاب, مشاركة, spacer, حفظ, with small counts (`text-sm`) beside each icon. (2) *Long video:* 16:9 player at full width, play button 60px circle `rgba(255,255,255,.9)`, duration badge bottom end 10px, title `text-md` clamp 2, meta line `text-xs` (views, time). (3) *Poll:* question text, 2 to 4 option rows (48px, radius 12, 1px border; after voting a fill bar of `--primary-tint` shows the percentage and the winning option is bold), footer '{n} صوت · باقي {time}'. (4) *Repost:* a 28px header line with a repost icon and 'أعاد نشره {name}', then the original post. (5) *Quote:* the user's text then the original as a nested card (radius 16, 1px border). (6) *Sponsored:* subline 'إعلان', copper ring on the avatar, and a product strip under the media (56px: thumbnail 40, name, price in `--accent-text`, Copper sm button 'اطلب'). (7) *Sensitive:* media blurred (`blur(40px)`) with a centered card: eye-off icon, 'محتوى حساس', 'عرض' button. (8) *Pinned (profile only):* a 24px line with a pin icon and 'مثبت' above the header.

**Desktop post card:** same content, in a card of width 600 to 680, radius 20, 1px `--border`; the More menu is a dropdown.

### E.5 Comment row

Avatar 32; name (`text-sm`, weight 600) + relative time (`text-xs`, muted) on one line; text `text-base`; actions row (height 32): heart icon 18 + count (`text-xs`), 'رد' text button (`text-xs`, weight 600), More (⋯ 18). The post owner's pinned comment shows a 'مثبت من الناشر' tag. Replies are indented by 40px (one level), collapsed behind 'عرض {n} ردود' (tap expands with a 200ms height animation). Long press opens: نسخ, إبلاغ, حظر, حذف (own), تثبيت (post owner).

### E.6 Chat components

**Chat row (list):** height 72, padding 0 16; avatar 50 (online dot optional); middle: name `text-md` weight 600 (one line) with verified mark and a mute icon 14 when muted; below it the preview `text-sm` muted (one line; own messages start with 'أنت:' and delivery ticks 14px; typing indicator in `--primary-text` 'يكتب الآن...'; draft 'مسودة:' in `--danger` text); end column: time `text-xs` (`--primary-text` when unread) and the unread badge (muted chats: `--text-muted` fill). Pinned rows show a 14px pin icon beside the time. Merchant rows add a tag pill 'طلب #1042 — قيد التجهيز' under the preview. Unread rows have a `--primary-tint` background at 40% opacity.

**Bubble:** radius 18 with the corner nearest the sender's side reduced to 4 on the last bubble of a group; padding 8 12; max width 78% of the screen (mobile) or 560px; own bubbles on the end side with `--bubble-own`, others on the start side with `--bubble-other` and a 1px `--border`; text `text-base` (dir auto per message); time and ticks in the bubble's bottom end corner (`text-xs`, muted) on the last line or, if the text fills the line, on a new line; consecutive bubbles from the same sender are 2px apart; a new sender group is 12px apart. Reply preview inside the bubble: 3px start border in `--primary`, sender name `text-xs` weight 600, one-line text, radius 8, `rgba(0,0,0,.05)`. Reactions: pills (height 24, `--surface`, 1px border) overlapping the bubble's bottom edge by 10px. Media bubbles: radius 14, max 280 by 360, with a gradient time chip over the image. Voice note bubble: 44px play button, waveform 28 bars (3px wide, 2px gap, 28px tall), duration `text-xs`, speed chip '1x' at the end. File bubble: 40px file-type tile, name (1 line), size. Deleted: italic muted 'تم حذف هذه الرسالة'. System message: centered pill `text-xs` on `--surface-2`.

**Date chip:** centered pill, height 28, `--surface-2`, `text-xs` weight 600, sticky for 1 second while scrolling; Iraqi month names ('١٥ تشرين الثاني'). **Unread divider:** a hairline with the centered label 'رسائل غير مقروءة' in `--primary-text`.

### E.7 Product card (market grid)

Width = (container - 16 padding - 10 gap) / 2 on phones (3 columns at 768 and above, 4 at 1200, 5 at 1600). Card: radius 18, 1px `--border`, padding 8, `--surface`. Image: square, radius 12, blurhash, with the wishlist heart button (36 circle, `rgba(255,255,255,.9)`, top end 8px) and an optional badge pill (top start 8px: 'جديد', 'مستعمل', 'نفدت الكمية', 'خصم {n}٪'). Below: title `text-md` weight 600 clamp 2; price `text-md` weight 700 in `--accent-text` formatted '١٢٥٬٠٠٠ د.ع' (struck-through compare price `text-xs` muted beside it); shop line `text-xs` muted: shop name (1 line), verified mark 12px, city. The whole card is one link target.

### E.8 Notification row

Height auto (min 72), padding 12 16; avatar 44 (grouped items stack up to 3 avatars at 28) with a 20px type badge at the bottom end (heart for likes, bubble for comments, person for follows, bag for orders, megaphone for system); text `text-base` with the actor names in weight 600, then the action, then the time in `text-xs` muted; end: a 48px media thumbnail (square, radius 8) when about a post, or an inline Follow button for follow notifications, or two buttons ('قبول' Primary sm and 'حذف' Secondary sm) for follow requests. Unread rows have a `--primary-tint` background at 40% and an 8px `--primary` dot at the start edge. Section headers: 'اليوم', 'هذا الأسبوع', 'هذا الشهر', 'أقدم' (`text-lg`, padding 16).

### E.9 Media viewer

Full screen black (`#000`), z 80. TB-OVERLAY with close (start), counter '١/٥' (center), more (end). Image: fit to screen, pinch zoom to 4x, double tap 2.5x, pan when zoomed, swipe horizontally for the next item when not zoomed, swipe down to close (the image follows the finger and the backdrop fades). Bottom overlay (video only): scrub bar and controls. A single tap toggles all overlays (fade 200ms). Desktop adds arrow buttons (48 circles) and keyboard arrows.

### E.10 Video player controls

**Long video player (`/video/[id]`):** 16:9; controls overlay appears on tap or pointer move and hides after 3 seconds of no interaction while playing. Center row: previous (disabled when none), **play/pause** 64px, next. Double tapping the left or right third seeks 10 seconds (shows '١٠ ث' with a ripple). Bottom row: current time, scrub bar (4px, 16px thumb while dragging, buffered segment lighter, chapter ticks), total time; below it a row of icon buttons from the start: volume (desktop only), speed ('1x' pill), captions (CC), quality (gear), picture-in-picture, fullscreen. Settings sheet items: الجودة (تلقائي, 1080, 720, 480, 360, 240), السرعة (0.5, 0.75, 1, 1.25, 1.5, 2), الترجمة (off + languages), التشغيل التلقائي. Rotating to landscape enters fullscreen. Swiping down on the player minimizes it into a mini-player (height 56, bottom above the BB, with title, play and close) that keeps playing while browsing. **Inline post video:** no controls except a mute button (32 circle) and a thin progress line (2px at the very bottom of the media, `--primary`); tap toggles play. **Reel:** see the page spec for `/reels`.

**PWA reliability note:** an offline queue is best-effort. Send queued, idempotent actions when the app is open and connectivity returns; use Background Sync only as optional, feature-detected enhancement. On iOS/iPadOS, Web Push guidance must explain Home Screen installation and a user-initiated permission request. A closed PWA does not guarantee incoming call handling. [5] [6] [7]


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
