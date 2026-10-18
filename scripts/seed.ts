// Fills a fresh database with a few demo people, public servers and chatter,
// so Discover and the landing page have something to show.
// Usage: npm run seed   (all demo accounts use the password "dabber123")
import { getDb, newId } from "../lib/server/db";
import { hashPassword } from "../lib/server/auth";
import { createServer, joinServer } from "../lib/server/actions";

const PEOPLE = [
  ["mika", "Mika", "art kid. game night host. 🎨", 0],
  ["jules", "Jules", "ranked grinder, part-time philosopher", 4],
  ["rae", "Rae", "streams badly, laughs loudly", 2],
  ["sam", "Sam", "here for the memes", 3],
] as const;

const SERVERS = [
  {
    name: "Dabber Lounge",
    template: "friends",
    description: "The official hangout for trying Dabber. Say hi, break things, share memes.",
    chat: [
      ["mika", "welcome to the lounge! grab a seat 🛋️"],
      ["jules", "anyone up for a match tonight?"],
      ["rae", "yes!! I'll stream it, come watch me lose 😭"],
      ["sam", "I made us an emoji-only channel in my head. it's called #🔥"],
      ["mika", "**reminder:** game night is friday at 8"],
    ],
  },
  {
    name: "Pixel Art Club",
    template: "creators",
    description: "Tiny pixels, big feelings. Weekly prompts and friendly critique.",
    chat: [
      ["mika", "this week's prompt: *a cozy room at night*"],
      ["rae", "ooh I've been wanting to try a rainy window"],
      ["sam", "does a 16x16 cat count as a room if the cat is the room"],
    ],
  },
  {
    name: "Late Night Study",
    template: "study",
    description: "Quiet focus sessions, homework help and lo-fi in the voice room.",
    chat: [
      ["jules", "pomodoro starting in the Study Room in 5"],
      ["sam", "bringing snacks (virtually)"],
    ],
  },
] as const;

async function main() {
  const db = getDb();
  const hash = await hashPassword("dabber123");
  const ids: Record<string, string> = {};
  for (const [username, name, about, seed] of PEOPLE) {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: string } | undefined;
    if (existing) {
      ids[username] = existing.id;
      continue;
    }
    const id = newId();
    db.prepare(
      "INSERT INTO users (id, username, display_name, password_hash, avatar_seed, about, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, username, name, hash, seed, about, Date.now());
    ids[username] = id;
  }
  for (const s of SERVERS) {
    if (db.prepare("SELECT 1 FROM servers WHERE name = ?").get(s.name)) continue;
    const { id, firstChannelId } = createServer(ids.mika, s.name, s.template, null);
    db.prepare("UPDATE servers SET is_public = 1, description = ? WHERE id = ?").run(s.description, id);
    for (const u of ["jules", "rae", "sam"]) joinServer(id, ids[u]);
    const general =
      (db.prepare("SELECT id FROM channels WHERE server_id = ? AND name = 'general'").get(id) as { id: string } | undefined)?.id ??
      firstChannelId;
    if (!general) continue;
    for (const [who, text] of s.chat) {
      const mid = newId();
      db.prepare("INSERT INTO messages (id, channel_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)").run(mid, general, ids[who], text, Date.now());
      db.prepare("UPDATE channels SET last_message_id = ? WHERE id = ?").run(mid, general);
    }
    const last = db.prepare("SELECT id FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT 1").get(general) as { id: string };
    for (const u of ["jules", "rae", "sam"]) db.prepare("INSERT OR IGNORE INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, '🔥', ?)").run(last.id, ids[u], Date.now());
  }
  console.log("Seeded demo people (mika, jules, rae, sam / password dabber123) and public servers.");
}

void main();
