#!/usr/bin/env bash
# Downloads the ForgeGUI-generated assets (see ASSETS.md) into a staging folder.
# Usage: scripts/fetch-assets.sh <out-dir>
set -euo pipefail
OUT="${1:-./.asset-staging}"
mkdir -p "$OUT/img" "$OUT/sfx"
IMG=https://azyjlkhpdgafuobyxoax.supabase.co/storage/v1/object/public/asset-images/d452b901-9522-4d96-86f7-ea38f63047a2/mcp
AUD=https://azyjlkhpdgafuobyxoax.supabase.co/storage/v1/object/public/asset-audio/d452b901-9522-4d96-86f7-ea38f63047a2/chat
img() { for i in $(seq 0 $(( $3 - 1 ))); do curl -sSf -o "$OUT/img/$1-$i.png" "$IMG/$2-$i.png" || echo "missing $1-$i"; done; }
sfx() { curl -sSf -o "$OUT/sfx/$1.mp3" "$AUD/$2" || echo "missing $1"; }

img logo 382bbd0b-ed2a-4409-a443-a030e3e93447 2
img appicon 65eba315-c17d-4968-98cc-2f715cf961ef 2
img avatars 22c93927-f20f-4ca6-9bea-69c3b8d80c0e 6
img empty-friends dade6dad-2673-463a-b45e-ab4aa0ffd588 1
img empty-mentions 7ad26fda-fe87-4a1a-8c4a-4766e47c788e 1
img empty-pins 12b73fb9-9808-46de-9ed4-727d73bbc2fa 1
img empty-chat 5f48dd3d-dc33-456b-bbc1-97482cedba81 1
img empty-voice 0773b960-74a5-4006-90c8-682e0f0de633 1
img empty-search f46ee094-fbc3-43f9-90bc-519010fe4052 1
img empty-lost 173d502e-2b32-4012-91b8-709a2b1e9e1b 1
img empty-error 8a148f33-1dbf-42ae-847b-db8819eb02d3 1
img empty-server 41fca386-02f0-48a9-a8e6-255ec885b561 1
img discover-hero 6501d453-d395-4b11-89df-60b5031d9bb6 1
img og 08f56dfe-057c-4ebc-b1a9-1afa169654fe 1
img feature-icons 787077d3-1c09-4165-a9a7-2ea714813430 6
img feature-selfhost 2895a38d-2e2b-4ee1-8459-e5e7d43318f1 1
img nobg-feature-selfhost 3479c520-112f-4cb0-afa3-d2965bb2feef 1

# background-removed versions (remove_background jobs)
img nobg-logo-a d5af40ed-0b39-4763-b49c-4bd2b39f095b 1
img nobg-logo-b 1f83c2da-9f66-45b0-a480-2e41046c1366 1
img nobg-friends 52bcc495-aa24-49e5-83c4-2593ec4f27b6 1
img nobg-mentions 0ac9c6a0-7487-4531-87cd-3156c95560ec 1
img nobg-pins 8fdb6c95-215f-4547-92e9-5d3e82f3d416 1
img nobg-chat 3596805d-8458-45c6-9c08-01daea7a9e76 1
img nobg-voice dc378175-a9e4-40dc-ae1d-8b6e36415e1e 1
img nobg-search 846dd644-5013-4e01-a996-1a0e7ec91db5 1
img nobg-lost 24ebce9f-bab5-4323-ab10-647bdf84a932 1
img nobg-error cf9b0a8a-0b07-42c8-a664-a5ef49a0ff92 1
img nobg-server ea5e23b5-b739-42f9-8cc6-cf7d8aca2fed 1
img nobg-feature-free 0a9471d5-5062-4038-a705-4c3353285146 1
img nobg-feature-servers 9ef6468a-7562-4937-acb3-665b6ae845e5 1
img nobg-feature-voice 61a6f135-c49e-463a-ac5f-f882381391ca 1
img nobg-feature-robot 7175543f-87f8-4a05-a1cc-9e73d2fa8796 1
img nobg-feature-safety 55767449-063c-4345-abe5-a5fd87cdb4bf 1
img nobg-feature-themes 5c946f5e-db65-42a8-a233-45274c97ad1c 1

sfx send 3fd26de1-68f7-49f6-aca3-2b56aefd8459-sound_effect-0-0652e3e5-981f-4e2e-979d-e78c4c7be8c3.mp3
sfx receive 2bd5fce6-0886-4f67-90cf-cf4f49f18c4c-sound_effect-0-bf59331d-480e-4223-9c33-ee075b2c14a1.mp3
sfx click d76d899d-727f-4b56-ba34-19cce9e9d3d0-sound_effect-0-ba26b4ef-1b2f-423d-b694-44f196e67f3e.mp3
sfx error 49d6966c-998f-4417-a79e-1e234a30a6a7-sound_effect-0-11d87f91-ee2c-4887-bfae-afdedfda590e.mp3
sfx success 98393cda-960c-4b1b-81cc-3ae2603b255c-sound_effect-0-e4b3ef7c-5e97-498f-ba62-83fac338a226.mp3
sfx voice-join 5632da85-5bc9-4c5a-b9f0-54706d41a622-sound_effect-0-93f84738-561a-4988-8f0a-fed3c53eb058.mp3
sfx voice-leave 9cd24268-6d6b-4bd5-81ea-2a7723126c14-sound_effect-0-1d516f6e-1ca2-430e-8b4d-fe2a2ec7c3cd.mp3
sfx mute 48b37cc9-22bf-4fcb-8536-502577f910cb-sound_effect-0-4e25892f-886e-4c6b-ac99-2f298f567cb0.mp3
sfx unmute 430696eb-782d-4fb6-be45-352f382a938e-sound_effect-0-0d072ae1-4312-4677-ac87-3ebb168f6d4e.mp3
sfx ring 34edca11-f246-4f7c-95dd-50355763308f-sound_effect-0-396c6d70-b408-4836-99b4-44a79c1e0178.mp3
sfx mention 32dce3d6-907c-4c3d-84de-554b54a41a77-sound_effect-0-c9a28a69-8a5f-4a7c-ace2-f539d7b81576.mp3
echo "done -> $OUT"
