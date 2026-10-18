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
