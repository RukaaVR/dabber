# DECISIONS.md

Calls made without stopping to ask, and why.

## Identity

- **Name: Dabber.** The brief allowed it, and it gave the app a mascot: **Dab**, a squishy ink-dab
  blob (like a bingo dauber splat) with oval eyes. That's deliberately unlike the reference's bear.
- **Palette: electric violet `#7158f5` + hot pink `#ff5fa2`** instead of the reference's coral. The
  neutral dark and light surfaces keep the same *structure* as the reference (rail darkest → sidebar
  → main → raised surfaces) but use our own values. The default violet was darkened from `#7b61ff`
  so white button text passes 4.5:1.
- **12 accent tints** (the reference ships 20 two-color presets). Each tint picks white or near-black
  button text automatically, so every preset stays readable.
- **Copy and tone:** casual and friendly like the reference, rewritten from scratch ("Come dab with
  us.", "Good to see you dabbing again.").

## Stack

- **Next.js 15 App Router + TypeScript + Tailwind v4.** Most styling is in hand-written semantic
  classes in `app/globals.css` (`.rail`, `.msg`, `.composer`…), because a dense chat UI with
  hover / active / unread states reads far better as named components than as long utility
  strings. Tailwind handles layout utilities and the CSS reset.
- **One process, one port:** `server.ts` runs Next and Socket.IO on the same HTTP server, so
  `npm install && npm run dev` is the whole setup. There's no Docker, cloud service or env file.
- **SQLite via better-sqlite3** (WAL mode) in `data/dabber.db`, created on first start. It's
  synchronous, fast and dependency-free on the user's side; Prisma would need an engine download.
- **One catch-all API route** (`app/api/[...path]/route.ts`) dispatching to a small typed router
  (`lib/server/router.ts`). That keeps auth, error mapping, rate limiting and the CSRF guard in one place
  instead of 40 route files.
- **Realtime: Socket.IO.** Events go to per-user rooms (`user:<id>`), computed from who can see a
  channel, so private channels and DMs never leak. Server-wide events (members, channel list) go to
  `server:<id>` rooms. In-process state (presence, voice) lives on `globalThis` so the custom server
  and Next's bundled route handlers share it.
- **Client state: one zustand store.** Routing uses real URLs (`/app/s/:server/:channel`,
  `/app/dm/:id`, `/app/discover`, `/app/friends`), but the shell lives in `app/app/layout.tsx`, so it
  never unmounts between channels.
- **Fonts: Inter from `@fontsource-variable/inter`,** bundled locally, so nothing loads from Google at
  runtime or build time.

## Auth

- **Username + password** (bcrypt) with an HttpOnly session cookie (SameSite=Lax, 90 days). Writes
  also check the Origin header.
- **No email:** the app runs locally with no mail server, so there's no email verification or reset
  mail. "Forgot your password?" explains that the host can run `npm run reset-password -- <user> <pw>`.
- No 2FA or account switching. Both are out of scope for a local app.

## Voice and screen share

- **Peer-to-peer WebRTC mesh** with Socket.IO signaling, instead of an SFU like LiveKit (the
  reference uses one). That keeps it self-contained with zero extra services. Every connection
  carries one audio and one video transceiver from the start, so mute / unmute and starting a screen
  share only swap tracks and never renegotiate. Calls are capped at 12 people, a sensible limit for a mesh.
- **ICE:** none by default, which works on localhost and LAN. Set `NEXT_PUBLIC_ICE_SERVERS` (JSON) at
  build time for STUN / TURN across the internet. There's no hard-coded third-party STUN, per "no
  external dependency".
- DM and group calls reuse the same voice rooms keyed by the DM channel id, with a ring card and ringtone.
- The voice view stays dark in light theme on purpose (video and avatars read better on dark).

## Scope: what's in, what's deliberately out

**In:** landing page with live online count; sign up / log in; friends (requests, accept / ignore /
cancel, remove, block); DMs and group DMs (create, add people, rename, icon, leave, hide); servers
(templates, icon, banner color, description, Discover listing, invites with join page and in-chat
invite cards, leave, delete); categories and text / voice channels (create, edit, private-by-role,
drag-to-reorder, delete); roles (color, hoist, permissions, hierarchy) and member management
(nicknames, kick, ban with optional message wipe, unban); messages (markdown, mentions with
autocomplete, replies, edit, delete, reactions, pins, image / video / audio / file attachments with
drag-drop and paste, voice messages, polls, typing indicator, unread markers and "New" divider,
jump-to-message, history paging, search with `from:`); mentions inbox; presence and custom status;
voice channels and DM calls with mute / deafen / screen share and speaking rings; quick switcher;
keyboard shortcuts; settings (account, profile, appearance, notifications, voice, keybinds);
desktop notifications; UI sounds with a mute toggle; server mute; PWA manifest; light and dark themes.

**Out, on purpose:**
- **GIF picker and link previews:** both need a third-party API or fetching arbitrary URLs from
  the server, which conflicts with "runs fully locally, no external dependency".
- **Bots / developer platform / webhooks / OAuth apps, Stripe "Plus", staff moderation center,
  reports and appeals, translation, soundboard, server folders and custom emoji.** These are large
  sub-products of the reference; each would need its own design pass. The core chat, voice and community loop
  came first.
- **The marketing subpages** (download, developers, roadmap, bugs) collapse into Guidelines / Terms /
  Privacy pages that fit a self-hosted app.

## Assets

- Every image and sound was generated with **ForgeGUI** using one style identity ("Dabber UI").
  See `ASSETS.md`.
- **Small line icons** (hash, mic, gear…) come from `lucide-react`, an icon *font* in code, not image
  assets. Rasterized AI icons at 16–20px would be blurry and inconsistent next to text; ForgeGUI
  handles every image asset (logo, app icons, avatars, illustrations, landing feature icons).
- Every image goes through an `Img` component with a graceful fallback: letter avatars, server
  initials, or the art just hides itself. The UI never shows a broken-image icon, even before
  the asset files exist.

## Data and limits

- Messages ≤ 4,000 chars; attachments ≤ 10 MB, 10 per message; avatars and icons ≤ 4 MB raster only.
- Uploads live in `data/uploads/`. Anything that isn't image, video or audio is served as a download with
  `nosniff` and a sandbox CSP, so an uploaded HTML or SVG file can't run script.
- IDs are time-sortable strings (base36 ms timestamp + counter + random), so `ORDER BY id` is
  chronological and paging uses `before` / `after` / `around` cursors.
- `npm run seed` adds four demo people (`mika`, `jules`, `rae`, `sam`, password `dabber123`) and three
  public servers so Discover isn't empty on a fresh install.
