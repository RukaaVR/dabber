# REFERENCE.md: study of the reference capture

The reference is a static capture of a Next.js 16 / Turbopack production build (App Router, a single
client-rendered page plus a few marketing routes). It's a **Discord-style community chat app**:
servers with channels, DMs and group DMs, friends, voice channels, screen sharing, bots, moderation.
The backend is Supabase (Postgres tables + RPCs + Realtime) plus a handful of Next API routes and
LiveKit for voice.

This file records what was learned from the capture. It's used only as a reference for layout, flow and feel.
None of its code, name, logo or branding is reused.

## 1. Screens and routes

| Route / screen | What it is |
|---|---|
| `/` (logged out) | Marketing home (`hp-*` classes): top nav (logo, Download, Developers, Log in), hero with H1 + subcopy + CTA, a **fake app mock** (server sidebar with `general / memes / clips` text channels, a `Lounge` voice channel with people in it, one **LIVE** badge, chat with 4 messages and a 🔥 reaction, a composer), a **live "N people online now"** strip with a pulsing dot, a 4-up feature grid (emoji glyph + title + text + optional link), an end CTA ("Come yap.", "Making an account takes a minute…"), and a footer with links. |
| Auth modal/page (`auth-wrap`) | Four modes: **Welcome back** (log in), **Create an account** (sign up), **Forgot your password?**, **Pick a new password**. Each has a title, a playful subtitle, and one primary button. Friendly error mapping: rate limit, password at least 6 chars, network down, captcha, 2FA. A radial-gradient background (accent at top-left, purple at bottom-right). |
| `/` (logged in): app shell | `.app` = flex row: **rail** (72px) · **sidebar** (260px) · **main** (flex) · optional **members** panel. |
| Home (`@me`) | Sidebar: search ("Find or start a conversation"), Friends row, "Direct Messages" header with **+** (create group), DM list (avatar + status + name, close × on hover). Main: **Friends** view with tabs `Online · All · Pending · Blocked · Add Friend`. |
| Server view | Sidebar: server header/banner with a dropdown (Invite People, Server Settings, Create Channel, Create Category, Notification settings, Leave Server). Collapsible **categories**; **text channels** (`#`) and **voice channels** (speaker), with connected people listed under each voice channel. Unread channels are bold with a left pill. |
| Chat | `main-head` (52px): `#` icon, name, topic, then tools: pinned, members toggle, search, mentions inbox. The message list has day dividers, grouped messages (same author within a few minutes collapse, with the time shown on hover in the gutter), a hover action bar (react, reply, edit, more), a context menu, reactions, replies (reply bar above the composer), mentions highlighted, edited marker, image albums plus lightbox, markdown (bold / italic / code / spoiler / quote), link embeds, typing indicator ("X is typing…" with bouncing dots), "You're viewing older messages / Jump to present", and "Show earlier messages". Composer: attach, textarea, emoji picker, GIF, send button, mention autocomplete (`@`), channel autocomplete. The placeholder is `Message #general`. |
| Members panel | Grouped by hoisted role, then Online/Offline counts. Clicking a member opens a **profile card** (`pc2`): banner, avatar with status, display name, username, pronouns, about me, "Member since", roles (add/remove), note, and a quick-message composer. |
| Voice channel view (`voice-view`) | A grid of `voice-tile`s (avatar, name, speaking ring `voice-pulse`, muted/deafened icons), stage for a screen share (`ss-*`, quality picker, volume, fullscreen, pop out), and controls: mute, deafen, share screen ("Go Live"), disconnect. Empty: "No one's here yet. Jump in and wait for people to show up." Join options: Join Voice / Join muted / Join deafened. |
| DM call (`dm-call`) | Call tiles above the DM chat, ring UI (`ring-in`, `call-pulse`), "Hide call" / "Show call". |
| User bar (`user-bar`, 58px) | Avatar with status dot, name / custom status, mic, headphones, settings. Clicking the avatar opens a **status menu**: Online, Idle, Do Not Disturb, Invisible, custom status ("What's up?" / "studying, on vacation, grinding ranked…"), Switch accounts, Log out. |
| Settings (full-screen, `settings-nav` + `settings-main`) | My Account, Profile (picture & banner, display name, pronouns, about me, profile theme, name style), Appearance (dark/light theme, **20 accent tints** with intensity, chat density), Notifications (desktop, notification sounds), Voice & Video, Keybinds, Privacy (who can DM, DM requests), Advanced (developer mode, copy IDs), Log out. A **save bar** slides up when there are unsaved changes. On mobile the nav turns into a horizontal strip. |
| Server Settings | Overview (name, icon, banner, description, discoverable + tags), Roles (role list, editor with tabs: display / permissions / members, permission search), Emojis, Soundboard, Members, Invites, Bans, Mod log, Webhooks, Bots, Delete Server (danger zone). |
| Create server | Blank server, templates, "Use a template link", **Join with invite** ("Invite code or …/invite/… link"). |
| Discover | "Public servers on Yapper. Search by name, topic or tag." Hero, search, sort (Most used / Newest / A to Z), cards (icon, banner, name, description, member counts), Join. |
| `/invite/[code]` | An invite card: server icon/name, online and member counts, Join/"Go to Server". Invalid: "Invite invalid / This invite may have expired or the server is gone." |
| Quick switcher | "Search channels, DMs and servers" (Ctrl+K). |
| Search | "Search… try from:name", results in a side panel, with jump-to-message (`channel_messages_around`). |
| Mentions inbox | "Nobody has mentioned you lately." when empty. |
| Pinned | "Nothing pinned yet. Open a message's menu and choose Pin." |
| Keyboard shortcuts | A `kbs-*` modal. |
| Marketing extras | `/download`, `/developers` (bot API docs), `/roadmap`, `/bugs`, `/guidelines`, `/terms`, `/privacy`. |
| Staff / mod center | `mc-*`: reports, appeals, warnings, bans, votes (staff-only). |

## 2. Components (class inventory, most-used first)

`avatar, msg, voice-tile, ctx-menu, status-menu, modal, btn, chat-row, rail-item, composer, user-bar,
settings-nav, profile-card, mention-menu, channel-row, msg-album, dm-call-tile, voice-view, theme-tile,
swatch, status-dot, save-bar, main-head, icon-btn, friends-tabs, toggle-row, tint-tile, send-btn,
roles-list, people-row, msg-body, mention, invite-embed, icon-upload, emoji-picker, drag-list,
discovery-card, dd-opt, banner, auth-wrap, voice-grid, voice-empty, toast, reply-bar, reaction,
msg-head, msg-author, modal-head, modal-foot, lightbox, typing-dots, switch, seg, section-label,
day-divider, welcome, field, overlay, sidebar-head, server-head, server-banner, members…`

## 3. User flows

1. Land on `/` → **Get started / Log in** → sign up (username, display name, email, password) → app.
2. Home → **Add Friend** by username → the other person sees it under **Pending** → Accept / Decline → they
   show up in **Online / All** → **Message** opens a DM.
3. Create a group DM from the **+** next to "Direct Messages": pick friends, name it, rename, leave.
4. **+** on the rail → Create server (blank / template) → lands in `#general` → **Invite People** → a link
   that never expires → a friend opens `/invite/code` → Join.
5. Server dropdown → Create Channel (text / voice, private toggle, category) / Create Category.
6. Chat: send, edit (hover → edit, or ↑ in an empty composer), delete (with confirm, shift-click skips it),
   reply, react (quick reacts + full picker), pin, copy text / ID, mention `@user` / `@everyone`, attach
   images (drag-and-drop overlay "Drop to upload"), typing indicator, unread markers, load older on scroll.
7. Voice: click a voice channel → join → the tile grid, speaking rings, mute / deafen, share screen, disconnect.
   DM call: call button in the DM header → the other side rings.
8. Profile card from avatar / name click → Message / Add friend / Block / Copy ID.
9. Settings: change avatar, display name, about me, banner colour, theme, accent tint, sounds on/off.
10. Server settings: rename, icon, discoverable toggle, roles with colours and permissions, assign roles,
    kick / ban / unban, revoke invites, delete server.
11. Discover → search → Join a public server.
12. Ctrl+K quick switcher; Esc closes modals; Enter sends, Shift+Enter makes a new line.
13. Status menu → set Online / Idle / DND / Invisible + custom status; Log out.

## 4. Visual system (from the CSS)

* **Theme**: dark by default (`data-theme="dark"` on `<html>`), light theme via `[data-theme=light]`. The
  choice is stored in localStorage and applied by an inline script before paint (no flash). `theme-color`
  meta changes with the theme.
* **Dark tokens**: rail `#141519`, side `#1b1c21`, main `#222329`, elev `#2b2c33`, hover `#2f3038`,
  active `#383944`, input `#2d2e36`, text `#ececf1`, muted `#9c9daa`, faint `#6e6f7b`, border `#ffffff12`.
* **Light tokens**: rail `#e3e5e8`, side `#f2f3f5`, main `#fff`, elev `#ebedef`, hover `#e6e7ea`,
  active `#d7d9de`, text `#1d1f23`, muted `#5b5d66`, faint `#8b8d96`, border `#00000017`.
* **Accent**: a coral `#ff6b4a` (hover `#ff5a35`, soft = 16% alpha). Danger `#f2555a`, success `#3fcf82`,
  warning `#f5b544`. Optional **tints** (`--tint-a/b/c/k`): 20 named two-colour presets.
* **Font**: Inter 400–800 (Google Fonts), system fallbacks. Extra display fonts for name styles (Caveat,
  JetBrains Mono, Playfair Display, Silkscreen, Fredoka, Bungee, Comic Neue).
* **Radii**: `--radius: 10px`; rail items 24px → 16px on hover/active (animated); buttons 8px; modal 14px;
  ctx-menu 10px; reaction 8px; channel row 6px; avatars round.
* **Sizes**: rail 72px with 48px items; sidebar 260px; header 52px; user bar 58px; button height 40px;
  modal max-width 440px; message padding `2px 16px` with a 14px gap and a 40px avatar gutter.
* **Shadows**: `0 10px 40px #00000073` (dark) / `0 10px 34px #00000029` (light).
* **Motion**: `pop` (scale .96→1, 140ms) for modals and menus, `fade` for overlays, `dd-in` for dropdowns,
  `sheet` (slide up 24px) for mobile sheets, `typing-bounce`, `voice-pulse` (speaking ring), `call-pulse`,
  `ring-in`, `badge-in`, `sk-pulse` (skeletons), `flash` (jump-to-message highlight). It respects
  `prefers-reduced-motion`.
* **Breakpoints**: 760px is the main one (rail + sidebar *or* main, with a back button in the header), plus
  640 / 560 / 520px tweaks; `hover:none` disables hover bars on touch.
* **Backgrounds**: radial accent glows on the marketing and auth pages.

## 5. Backend features the frontend expects

From the `.from(...)`, `.rpc(...)` and `/api/*` calls in the bundles:

* **Auth**: sign up, log in, log out, log out everywhere, password reset, email verification, username
  availability (`username_taken`), 2FA, account switching, delete account.
* **Profiles**: display name, username, avatar, banner, about, pronouns, status pref (online / idle / dnd /
  invisible), custom status, user notes, user prefs.
* **Presence**: `heartbeat`, `who_online`, a site-wide online count (`site_user_count`) for the landing page.
* **Friends**: `friendships` (pending / accepted), `blocks`, `dm_requests`, `mutuals`, `search_people`.
* **DMs**: `get_or_create_dm`, groups (`create_group`, `add_group_members`, `update_group`, `leave_group`),
  DM pins, calls (`start_call`, `end_call`).
* **Servers**: `servers`, `server_members`, `roles`, `member_roles`, `channel_categories`, `channels`,
  `channel_roles` / overrides (private channels), `invites` (`get_invite`, `invite_card`), bans, mutes,
  templates, folders, discovery (`discover_servers_page`, ranks, promotions), emojis, sounds.
* **Messages**: paged history (`channel_messages`, `_around`, `_newer`, `_since`), send / edit / delete,
  `reactions`, pins (`pin_message`), `mark_read` + unread state, `my_mentions`, `search_messages`, polls,
  translate, media upload (`/api/media/upload-url`, scan), slowmode.
* **Realtime**: Supabase Realtime channels for new / edited / deleted messages, reactions, typing,
  presence, member and channel changes, call signalling.
* **Voice / video**: `/api/livekit-token` (an SFU), voice moderation, screen share.
* **Bots / dev platform**: bots, slash commands, webhooks, OAuth apps, a bot HTTP API (`/api/bot/v1/*`).
* **Moderation and staff**: reports, warnings, timeouts, site bans, appeals, mod log, staff votes.
* **Billing**: a "Plus" subscription via Stripe, plus gifts.
