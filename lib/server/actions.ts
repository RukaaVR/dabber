import { getDb, newId, now } from "./db";
import {
  audienceOfUser,
  channelAudience,
  channelRow,
  dmRecipientIds,
  hydrateMessages,
  publicUsers,
  relationships,
  serverRow,
  toCategory,
  toChannel,
  toMe,
  toMember,
  toPublicUser,
  toRole,
  toServer,
  userRow,
  visibleServerChannels,
  memberRoleIds,
} from "./repo";
import { emitToServer, emitToUsers, setServerRoom, voiceStates } from "./realtime";
import { DEFAULT_PERMS, type Bootstrap, type Message, type UnreadInfo } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const TEMPLATES: Record<string, { label: string; text: [string, string[]][]; voice: string[] }> = {
  blank: { label: "Blank server", text: [["Text Channels", ["general"]]], voice: ["General"] },
  friends: {
    label: "Friends",
    text: [["Text Channels", ["general", "memes", "plans"]]],
    voice: ["Hangout", "Late Night"],
  },
  gaming: {
    label: "Gaming",
    text: [
      ["Info", ["welcome", "announcements"]],
      ["Text Channels", ["general", "clips", "looking-for-group"]],
    ],
    voice: ["Lobby", "Squad 1", "Squad 2"],
  },
  study: {
    label: "Study group",
    text: [["Study", ["general", "homework-help", "resources"]]],
    voice: ["Study Room"],
  },
  creators: {
    label: "Artists & Creators",
    text: [["Studio", ["general", "showcase", "feedback", "commissions"]]],
    voice: ["Live Studio"],
  },
};

export function createServer(ownerId: string, name: string, template: string, icon: string | null) {
  const db = getDb();
  const t = TEMPLATES[template] ?? TEMPLATES.blank;
  const id = newId();
  const ts = now();
  let firstText: string | null = null;
  db.transaction(() => {
    db.prepare("INSERT INTO servers (id, name, icon, owner_id, created_at) VALUES (?, ?, ?, ?, ?)").run(id, name, icon, ownerId, ts);
    db.prepare("INSERT INTO members (server_id, user_id, joined_at) VALUES (?, ?, ?)").run(id, ownerId, ts);
    db.prepare(
      "INSERT INTO roles (id, server_id, name, position, permissions, is_default) VALUES (?, ?, '@everyone', 0, ?, 1)",
    ).run(newId(), id, DEFAULT_PERMS);
    let catPos = 0;
    let chPos = 0;
    for (const [catName, chans] of t.text) {
      const catId = newId();
      db.prepare("INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)").run(catId, id, catName, catPos++);
      for (const ch of chans) {
        const cid = newId();
        if (!firstText) firstText = cid;
        db.prepare(
          "INSERT INTO channels (id, server_id, category_id, type, name, position, created_at) VALUES (?, ?, ?, 'text', ?, ?, ?)",
        ).run(cid, id, catId, ch, chPos++, ts);
      }
    }
    const vcat = newId();
    db.prepare("INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, 'Voice Channels', ?)").run(vcat, id, catPos++);
    for (const v of t.voice) {
      db.prepare(
        "INSERT INTO channels (id, server_id, category_id, type, name, position, created_at) VALUES (?, ?, ?, 'voice', ?, ?, ?)",
      ).run(newId(), id, vcat, v, chPos++, ts);
    }
    db.prepare("INSERT INTO invites (code, server_id, creator_id, created_at) VALUES (?, ?, ?, ?)").run(
      inviteCode(),
      id,
      ownerId,
      ts,
    );
  })();
  setServerRoom(ownerId, id, true);
  if (firstText) systemMessage(firstText, ownerId, "join");
  emitToUsers([ownerId], "server:refresh", { serverId: id });
  return { id, firstChannelId: firstText as string | null };
}

export function inviteCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function serverState(serverId: string, userId: string) {
  const db = getDb();
  const s = serverRow(serverId);
  if (!s) return null;
  return {
    server: toServer(s, userId),
    channels: visibleServerChannels(serverId, userId),
    categories: (db.prepare("SELECT * FROM categories WHERE server_id = ? ORDER BY position").all(serverId) as Row[]).map(toCategory),
    roles: (db.prepare("SELECT * FROM roles WHERE server_id = ? ORDER BY position DESC").all(serverId) as Row[]).map(toRole),
    myRoles: memberRoleIds(serverId, userId),
  };
}

export function joinServer(serverId: string, userId: string) {
  const db = getDb();
  const ins = db.prepare("INSERT OR IGNORE INTO members (server_id, user_id, joined_at) VALUES (?, ?, ?)").run(serverId, userId, now());
  setServerRoom(userId, serverId, true);
  if (ins.changes) {
    const mrow = db.prepare("SELECT * FROM members WHERE server_id = ? AND user_id = ?").get(serverId, userId) as Row;
    emitToServer(serverId, "member:add", { member: toMember(mrow), user: toPublicUser(userRow(userId)!) });
    const first = (visibleServerChannels(serverId, userId).find((c) => c.type === "text") ?? null)?.id;
    if (first) systemMessage(first, userId, "join");
  }
  emitToUsers([userId], "server:refresh", { serverId });
  return !!ins.changes;
}

export function removeMember(serverId: string, userId: string, reason: "left" | "kicked" | "banned" = "left") {
  const db = getDb();
  const name = (db.prepare("SELECT name FROM servers WHERE id = ?").get(serverId) as Row | undefined)?.name ?? "";
  db.prepare("DELETE FROM members WHERE server_id = ? AND user_id = ?").run(serverId, userId);
  emitToServer(serverId, "member:remove", { serverId, userId });
  setServerRoom(userId, serverId, false);
  emitToUsers([userId], "server:delete", { id: serverId, name, reason });
}

export function systemMessage(channelId: string, authorId: string, type: Message["type"], content = "") {
  const db = getDb();
  const id = newId();
  db.prepare("INSERT INTO messages (id, channel_id, author_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    channelId,
    authorId,
    content,
    type,
    now(),
  );
  db.prepare("UPDATE channels SET last_message_id = ? WHERE id = ?").run(id, channelId);
  broadcastMessage(id, "message:create");
}

export function broadcastMessage(messageId: string, event: "message:create" | "message:update") {
  const row = getDb().prepare("SELECT * FROM messages WHERE id = ?").get(messageId) as Row | undefined;
  if (!row) return;
  const ch = channelRow(row.channel_id)!;
  const [msg] = hydrateMessages([row], "");
  // reaction "me" flags are computed client-side from userIds
  const audience = channelAudience(ch);
  emitToUsers(audience, event, { message: msg });
}

export function getOrCreateDm(a: string, b: string): string {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT c.id FROM channels c
       JOIN dm_members x ON x.channel_id = c.id AND x.user_id = ?
       JOIN dm_members y ON y.channel_id = c.id AND y.user_id = ?
       WHERE c.type = 'dm' LIMIT 1`,
    )
    .get(a, b) as Row | undefined;
  if (existing) {
    db.prepare("UPDATE dm_members SET hidden = 0 WHERE channel_id = ? AND user_id = ?").run(existing.id, a);
    return existing.id;
  }
  const id = newId();
  const ts = now();
  db.transaction(() => {
    db.prepare("INSERT INTO channels (id, type, created_at) VALUES (?, 'dm', ?)").run(id, ts);
    db.prepare("INSERT INTO dm_members (channel_id, user_id, joined_at, hidden) VALUES (?, ?, ?, 0)").run(id, a, ts);
    db.prepare("INSERT INTO dm_members (channel_id, user_id, joined_at, hidden) VALUES (?, ?, ?, 1)").run(id, b, ts);
  })();
  return id;
}

/** Push a DM/group channel to members (un-hiding it for them). */
export function announceDm(channelId: string, toUserIds?: string[]) {
  const ids = toUserIds ?? dmRecipientIds(channelId);
  const row = channelRow(channelId);
  if (!row) return;
  const users = publicUsers(dmRecipientIds(channelId));
  for (const uid of ids) emitToUsers([uid], "dm:create", { channel: toChannel(row, uid), users });
}

export function unreadsFor(userId: string, channelIds: string[]): UnreadInfo[] {
  const db = getDb();
  const out: UnreadInfo[] = [];
  const reads = new Map<string, string>();
  for (const r of db.prepare("SELECT channel_id, last_read_id FROM read_states WHERE user_id = ?").all(userId) as Row[])
    reads.set(r.channel_id, r.last_read_id);
  for (const cid of channelIds) {
    const ch = channelRow(cid);
    if (!ch) continue;
    const last = reads.get(cid) ?? null;
    let mentionCount = 0;
    if (ch.last_message_id && (!last || ch.last_message_id > last)) {
      const since = last ?? "";
      if (ch.type === "dm" || ch.type === "group") {
        mentionCount = (
          db
            .prepare("SELECT COUNT(*) AS n FROM messages WHERE channel_id = ? AND id > ? AND (author_id IS NULL OR author_id != ?) AND type = 'default'")
            .get(cid, since, userId) as Row
        ).n;
      } else {
        mentionCount = (
          db
            .prepare(
              `SELECT COUNT(*) AS n FROM messages m WHERE m.channel_id = ? AND m.id > ? AND m.author_id != ?
               AND (m.mention_everyone = 1 OR EXISTS (SELECT 1 FROM mentions x WHERE x.message_id = m.id AND x.user_id = ?))`,
            )
            .get(cid, since, userId, userId) as Row
        ).n;
      }
    }
    out.push({ channelId: cid, lastReadId: last, mentionCount });
  }
  return out;
}

export function bootstrap(userId: string): Bootstrap | null {
  const db = getDb();
  const me = userRow(userId);
  if (!me) return null;
  const serverIds = (db.prepare("SELECT server_id FROM members WHERE user_id = ? ORDER BY joined_at").all(userId) as Row[]).map(
    (r) => r.server_id,
  );
  const servers: Bootstrap["servers"] = [];
  const channels: Bootstrap["channels"] = [];
  const categories: Bootstrap["categories"] = [];
  const roles: Bootstrap["roles"] = [];
  const myRoles: Record<string, string[]> = {};
  const userIds = new Set<string>();
  for (const sid of serverIds) {
    const st = serverState(sid, userId);
    if (!st) continue;
    servers.push(st.server);
    channels.push(...st.channels);
    categories.push(...st.categories);
    roles.push(...st.roles);
    myRoles[sid] = st.myRoles;
  }
  const dmRows = db
    .prepare(
      `SELECT c.* FROM channels c JOIN dm_members d ON d.channel_id = c.id
       WHERE d.user_id = ? AND d.hidden = 0 ORDER BY COALESCE(c.last_message_id, c.id) DESC`,
    )
    .all(userId) as Row[];
  for (const r of dmRows) {
    const c = toChannel(r, userId);
    c.recipients?.forEach((id) => userIds.add(id));
    channels.push(c);
  }
  const rels = relationships(userId);
  rels.forEach((r) => userIds.add(r.userId));
  const voice = voiceStates();
  const visibleVoice = voice.filter((v) => channels.some((c) => c.id === v.channelId));
  visibleVoice.forEach((v) => userIds.add(v.userId));
  userIds.delete(userId);
  return {
    me: toMe(me),
    users: publicUsers(userIds),
    servers,
    channels,
    categories,
    roles,
    myRoles,
    relationships: rels,
    unreads: unreadsFor(
      userId,
      channels.filter((c) => c.type !== "voice").map((c) => c.id),
    ),
    voice: visibleVoice,
  };
}

export function broadcastUser(userId: string) {
  const r = userRow(userId);
  if (!r) return;
  const pub = toPublicUser(r);
  const audience = audienceOfUser(userId).filter((id) => id !== userId);
  emitToUsers(audience, "user:update", { user: pub });
  emitToUsers([userId], "me:update", { me: toMe(r) });
}
