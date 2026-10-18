# CRITIQUE.md

Harsh review passes, run against the reference. Each pass: `npm run build`, `npm run lint`, the
end-to-end smoke test (`npm run smoke`), screenshots of every screen, then this list. Every item gets
fixed (✅) before the next pass. Items marked ⛔ are blocked outside the code and explained.

## Pass 1

Build: clean (1 warning: `metadataBase` not set). Lint: clean. Smoke: 25/25 flows pass. Console: only
404s for asset files.

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | Assets | Every ForgeGUI image and sound is missing from `public/`, so there are 404s, broken logo / avatars / art and no sounds. The generated files sit on a host this sandbox's network policy blocks. | ⛔ download blocked; mitigated with fallbacks (#1b) |
| 1b | Robustness | A missing image renders as a broken-image icon. | ✅ `Img` with fallbacks: letter avatars, initials, the art hides itself |
| 2 | Bug | Someone who joins through the invite page shows as **Offline** to everyone until they reload (the presence broadcast was skipped during the reconnect grace period). | ✅ always announce the first socket |
| 3 | Visual | The back arrow shows on desktop in the voice view header. | ✅ `.back` is mobile-only everywhere |
| 4 | Feature | No visible mute toggle for UI sounds (only a buried settings switch). | ✅ bell toggle in the user bar |
| 5 | Polish | The Next.js dev indicator overlaps the composer's attach button. | ✅ `devIndicators: false` |
| 6 | UX | The header search box keeps the old query after the results panel closes. | ✅ cleared on close |
| 7 | Mobile | The "Friends" row looks active on the mobile home list even though the friends view isn't open. | ✅ |
| 8 | A11y | `--text-faint` (timestamps, hints) is under 4.5:1 contrast in both themes. | ✅ |
| 9 | Feature gap | Invite links pasted in chat are plain links; the reference renders an invite card with a Join button. | ✅ |
| 10 | Feature gap | No voice messages (the reference has record → send). | ✅ |
| 11 | Feature gap | No polls (the reference has create / vote / results). | ✅ |
| 12 | Feature gap | Channels and categories can't be reordered (the reference: "Drag to rearrange"). | ✅ |
| 13 | Feature gap | Can't mute a noisy server. | ✅ Mute server (mentions still ping) |
| 14 | Feature gap | No password recovery path at all. | ✅ "Forgot your password?" hint + `npm run reset-password` |
| 15 | Empty state | A fresh install has an empty Discover page and nothing to look at. | ✅ `npm run seed` demo data; the empty state explains how to list a server |
| 16 | Build | The `metadataBase` warning. | ✅ |
| 17 | Visual | Toasts stack on top of the settings save bar. | ✅ the stack moves above the save bar in settings |
| 18 | UX | Scrolled up in a busy channel, new messages arrive silently with no way to jump down. | ✅ "New messages" pill |

## Pass 2

Build: clean, no warnings. Lint: clean. Smoke: 30/30 flows pass (the new steps cover polls, invite
embeds, voice messages, drag-reorder and server mute). Console: only the asset 404s.

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | Assets | Same as pass 1 #1: the ForgeGUI files still can't be downloaded into this sandbox. | ⛔ blocked |
| 2 | Composer | Three icons (attach, poll, mic) crowd the left of the composer, which is cramped on mobile. | ✅ one **+** menu (Upload / Create poll); the mic sits on the right and turns into Send once you type |
| 3 | Visual | Voice messages use the browser's native light-gray audio control, which clashes with the theme. | ✅ themed `AudioPlayer` (play / seek / time / download) |
| 4 | Mobile | On narrow screens the member list overlays the chat by default and hides it. | ✅ starts closed under 1000px |
| 5 | Feature gap | A server's banner color isn't shown anywhere in the server UI. | ✅ banner header in the channel sidebar |
| 6 | Feedback | When you're kicked, banned, or the server is deleted, the server silently vanishes. | ✅ a toast says why |
| 7 | Edge case | Replying to a poll shows an empty reply preview; poll notifications read "Sent an attachment". | ✅ "📊 question" |
| 8 | A11y | Accent buttons on light accents (Mint, Sunny…) had white text at 2.2–3.3:1. | ✅ `--on-accent` picks white or near-black per accent for ≥4.5:1 |
| 9 | A11y | The default violet with white text was 4.2:1. | ✅ darkened to `#7158f5` (4.75:1) |

## Pass 3

Build, lint and smoke: clean (30/30). This pass added a screenshot tour of the less-travelled screens
(`scripts/tour.mjs`: 404, invalid invite, login error, menus, pickers, modals, every settings page, and
mobile for each) and a line-by-line review of the server code.

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | Assets | Still blocked (see pass 1). | ⛔ |
| 2 | Mobile | The settings nav wraps into a messy two-row grid instead of one scrollable strip. | ✅ |
| 3 | Mobile | The member list overlay can't be dismissed by tapping outside it. | ✅ scrim, tap to close |
| 4 | Mobile | Long modal titles run under the close ✕ (Invite sheet). | ✅ the header reserves space |
| 5 | Visual | A server-rendered image that fails before hydration shows the browser's broken-image icon (landing logo). | ✅ `Img` checks `complete && naturalWidth === 0` on mount |
| 6 | UX | The status menu doesn't show which status is current. | ✅ "✓ Current" |
| 7 | Console | The invite page probes `/api/bootstrap` when logged out and logs a 401. | ✅ new `/api/auth/session` returns 200 |
| 8 | Data | Seeded servers open with a wall of four "joined the server" lines. | ✅ |
| 9 | Bug | After a reconnect resync, the open chat and member list stay stuck on skeletons (the caches were cleared but nothing reloaded). | ✅ reload when the cache is empty |
| 10 | Bug | A kicked or banned member, or everyone in a deleted voice channel or server, stays connected to voice. | ✅ the server forces them out and tells them why |
| 11 | Security | No Origin check on writes (SameSite=Lax was the only CSRF guard), and multipart bodies are read fully before any size check. | ✅ cross-site writes refused; bodies over 105 MB rejected up front |
| 12 | Code | Dead code: unused endpoints (`users/search`, `templates`, `voice`) and helpers. | ✅ removed |
| 13 | Mobile | The settings close ✕ floats over the scrolling section strip, covering "Notifications". | ✅ the strip stops short of the ✕ |
| — | Note | A wrong password logs `401` in the network console. That's the correct HTTP status for a failed login, not an app error, so it stays. | by design |

## Pass 4

The smoke test grew to 36 flows: DM call ringing and accept, screen sharing (the viewer checks that real
video frames arrive), creating a DM from the group picker, and kicking a member live.

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | Assets | Still blocked (see pass 1). | ⛔ |
| 2 | Bug | Coming back to a server lands in the **voice** channel you last opened instead of your last text channel, so the member list and composer are missing (found by the kick flow). | ✅ only text channels are remembered |
| 3 | Bug | Kick / ban / nickname launched from a profile card's ⋯ menu open their confirm dialog *underneath* the card (z-index 70 vs 60), so the dialog can't be clicked. | ✅ the card closes when a modal opens and sits below modals |
| 4 | Layout | The incoming-call card sits bottom-right on top of the composer's emoji / mic buttons. | ✅ moved under the header, top-right |

## Pass 5

Build, lint and smoke (34 flows) are clean, and the tour (now with light theme, a 900px tablet width
and keyboard focus) logs no console errors.

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | Assets | Still blocked (see pass 1). | ⛔ |
| 2 | UX | Nothing warns you before you hit the 4,000-character message limit; the error only shows after you press Enter. | ✅ live counter for the last 200 characters, red when over |

## Pass 6

Fresh database (first-run path), `npm run build` with no warnings, `npm run lint` clean, smoke 34/34,
tour clean, and the server log has no errors. `npm run dev` on an empty data dir boots and serves `/`,
`/login`, `/signup`, `/app` (→ login redirect), `/guidelines`, `/invite/x`, `/api/health` and the
manifest.

**New issues: none** (other than the external asset block).

## Pass 7

Independent rerun on another fresh database: build clean, lint clean, smoke 34/34, tour clean, 0
console errors besides the asset 404s, and 0 server errors.

**New issues: none** (other than the external asset block).

## Exit status

Two consecutive passes (6 and 7) found nothing left to fix in the code. One item stays open, and it
is outside the code:

- **ForgeGUI asset files aren't in `public/` yet.** All 41 assets (35 images including
  background-removed versions, and 11 sounds) were generated with ForgeGUI under one style, but the
  files live on `azyjlkhpdgafuobyxoax.supabase.co`, which this sandbox's network policy refuses
  (HTTP 403 on CONNECT). Until they're fetched, each image falls back gracefully (no broken icons)
  and sounds are silent, but the browser logs a 404 per missing file. The fix is two commands where that
  host is reachable: `scripts/fetch-assets.sh .asset-staging && scripts/process-assets.sh .asset-staging`.
