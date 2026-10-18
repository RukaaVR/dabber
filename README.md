# Dabber

Your group chat, with room to hang out. Dabber is a self-hosted community chat app with servers,
channels, DMs, group chats, voice channels, calls and screen sharing. It's built with Next.js,
TypeScript, Tailwind, SQLite and Socket.IO.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

That's it. No accounts, keys or other services needed. The database (`data/dabber.db`) and uploads
(`data/uploads/`) are created on first start.

Optional:

```bash
npm run seed         # demo people (mika / jules / rae / sam, password dabber123) + public servers
npm run build && npm start   # production build on the same port
```

Requires Node 20.9+ (tested on 20.19 and 22). Ignore `npm audit fix --force`: it tries to jump Next and its lint config across major versions. See DECISIONS.md → Dependencies.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server and Socket.IO on one port (`PORT`, default 3000) |
| `npm run build` | Production build |
| `npm start` | Serves the production build (run `build` first) |
| `npm run lint` | ESLint (zero warnings allowed) and a TypeScript check |
| `npm run seed` | Adds demo data |
| `npm run reset-password -- <user> <new>` | Sets a password (there's no email reset) |
| `npm run smoke` | End-to-end test of every main flow against a running server (needs Playwright's Chromium) |

## Features

- **Servers:** templates, icons, banner colors, categories, text and voice channels, private
  channels by role, drag-to-reorder, invites with a join page and in-chat invite cards, and a
  Discover page for public servers.
- **Roles and moderation:** colors, hoisting, 14 permissions with hierarchy, nicknames, kick, ban
  (optionally wiping messages), unban.
- **Messaging:** markdown (bold, italic, underline, strike, code blocks, spoilers, quotes), @mentions
  with autocomplete, replies, edits, deletes, reactions, pins, polls, voice messages, image / video /
  audio / file uploads (drag-drop and paste), typing indicators, unread and mention badges, "New"
  divider, history paging, jump-to-message, search with `from:name`, and a mentions inbox.
- **People:** friends and requests, blocking, DMs, group DMs, presence (online / idle / do not
  disturb / invisible) and custom status, and profile cards with banner, bio and roles.
- **Voice:** voice channels and DM calls (with ringing), mute and deafen, speaking indicators, screen
  sharing with a focus view and fullscreen. Peer-to-peer WebRTC.
- **Polish:** light and dark themes, 12 accent colors, text size, UI sounds with a mute toggle,
  desktop notifications, quick switcher (Ctrl+K), keyboard shortcuts (Ctrl+/), mobile layout, and a
  PWA manifest.

## Voice across the internet

On localhost or a LAN, calls just work. To connect people on different networks, give the browser
STUN / TURN servers at build time:

```bash
NEXT_PUBLIC_ICE_SERVERS='[{"urls":"stun:stun.example.org:3478"}]' npm run build
```

## Project layout

```
server.ts                   Next + Socket.IO on one HTTP server
app/                        routes: landing, login / signup, /app shell, /invite/[code], legal pages
app/api/[...path]/route.ts  all REST endpoints → lib/server/api.ts
lib/server/                 db (SQLite schema), auth, permissions and queries, realtime hub, sockets
lib/client/                 zustand store, socket client, WebRTC voice, markdown, sounds, theme
components/                 app shell, chat, overlays (modals, menus, pickers), settings
public/                     ForgeGUI-generated art, icons and sounds (see ASSETS.md)
```

See `REFERENCE.md` (what was studied), `DECISIONS.md` (judgment calls), `ASSETS.md` (every
generated asset) and `CRITIQUE.md` (the review passes).
