# ASSETS.md

Every image and sound in Dabber was generated with **ForgeGUI**. Nothing is stock or a placeholder.

**Style identity:** `Dabber UI` (style id `4c05c420-e178-461a-8dfa-4ae2b24080f3`, v1). This is a flat
2D vector look: bold and friendly, rounded geometric shapes, a violet `#7B61FF` / hot pink
`#FF5FA2` / mint `#3FD8A6` / warm yellow `#FFC857` palette on deep charcoal `#17181D`. The mascot is
"Dab", a squishy ink-dab blob with tall oval eyes. Every image generation pinned this style.

Transparency: everything placed over UI surfaces went through ForgeGUI `remove_background`.

## Getting the files into `public/`

The generated files live in ForgeGUI's storage. Two scripts turn them into what the app serves:

```bash
scripts/fetch-assets.sh .asset-staging     # download every generation below
scripts/process-assets.sh .asset-staging   # trim, resize, favicon, PWA icons, loudness-normalize sounds
```

`process-assets.sh` needs ImageMagick and ffmpeg. Its output is committed, so people who only want
to run Dabber never need either script.

## Images

| File in `public/` | Used for | ForgeGUI tool · job |
|---|---|---|
| `brand/logo-mark.png` | logo in the rail, auth, landing, loading screen | `generation_image` (icon_gfx) `382bbd0b…:0` → `remove_background` `d5af40ed…` |
| `brand/mascot.png` | landing hero and closing section | `generation_image` `382bbd0b…:1` → `remove_background` `1f83c2da…` |
| `icons/icon-192.png`, `icons/icon-512.png` | PWA icons | `generation_image` (icon_gfx, full-bleed app icon) `65eba315…:0` |
| `icons/icon-maskable-512.png` | PWA maskable icon (safe-zone padded) | same source |
| `icons/apple-touch-icon.png` | iOS home screen | same source |
| `favicon.ico` (48/32/16) | browser tab | same source |
| `avatars/default-0…5.png` | default avatars (six Dab colors) | `generation_image` (profile_icon ×6) `22c93927…:0-5` |
| `illustrations/friends.png` | Friends empty states, Add Friend | `generation_image` `dade6dad…` → bg removed `52bcc495…` |
| `illustrations/mentions.png` | Mentions inbox empty | `7ad26fda…` → `0ac9c6a0…` |
| `illustrations/pins.png` | Pinned messages empty | `12b73fb9…` → `8fdb6c95…` |
| `illustrations/chat.png` | (spare) new-conversation art | `5f48dd3d…` → `3596805d…` |
| `illustrations/voice.png` | empty voice channel | `0773b960…` → `dc378175…` |
| `illustrations/search.png` | no search results / nothing matches | `f46ee094…` → `846dd644…` |
| `illustrations/lost.png` | 404, invalid invite, missing channel or server | `173d502e…` → `24ebce9f…` |
| `illustrations/error.png` | error boundary, load failures | `8a148f33…` → `cf9b0a8a…` |
| `illustrations/server.png` | (spare) new-server celebration | `41fca386…` → `ea5e23b5…` |
| `illustrations/discover-hero.png` | Discover banner | `generation_image` (thumbnail) `6501d453…` |
| `og.png` (1200×630) | social share image | `generation_image` (thumbnail) `08f56dfe…` |
| `illustrations/feature-free.png` | landing feature "The good stuff, free" | `generation_gui` (gui_icon ×6) `787077d3…:0` → `0a9471d5…` |
| `illustrations/feature-servers.png` | landing feature "Servers for every crew" | `787077d3…:1` → `9ef6468a…` |
| `illustrations/feature-voice.png` | landing feature "Hop in voice" | `787077d3…:2` → `61a6f135…` |
| `illustrations/feature-safety.png` | landing feature "You're in control" | `787077d3…:4` → `55767449…` |
| `illustrations/feature-themes.png` | landing feature "Make it yours" | `787077d3…:5` → `5c946f5e…` |
| `illustrations/feature-selfhost.png` | landing feature "Runs anywhere" | `generation_gui` `2895a38d…` → `3479c520…` |

## Sounds

All are `generation_sound_effect` outputs, kept short and subtle. `process-assets.sh` trims leading
silence and normalizes them to −20 LUFS so none is jarring. Users can mute everything from the 🔔
button in the user bar or under Settings → Notifications (where each sound can be previewed).

| File in `public/sounds/` | When it plays | Job |
|---|---|---|
| `send.mp3` | you send a message | `3fd26de1…` |
| `receive.mp3` | new message in the channel you're in while the tab is unfocused, or a new friend request | `2bd5fce6…` |
| `mention.mp3` | someone @mentions you or DMs you | `32dce3d6…` |
| `click.mp3` | starting a voice message, unmuting sounds | `d76d899d…` |
| `error.mp3` | a send / join / create fails | `49d6966c…` |
| `success.mp3` | server created or joined, friend request sent, profile saved, screen share started | `98393cda…` |
| `voice-join.mp3` | you or someone else joins your voice channel | `5632da85…` |
| `voice-leave.mp3` | someone leaves, or you disconnect | `9cd24268…` |
| `mute.mp3` / `unmute.mp3` | mic or deafen toggled | `48b37cc9…` / `430696eb…` |
| `ring.mp3` (loop) | incoming DM or group call | `34edca11…` |

## Not image assets

Small UI line icons (hash, mic, headphones, gear…) are `lucide-react` SVG components, not images.
See DECISIONS.md.
