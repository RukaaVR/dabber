import { getDb, idTime } from "./db";
import { effectiveStatus } from "./realtime";
import {
  ALL_PERMS,
  Perm,
  hasPerm,
  type Attachment,
  type Category,
  type Channel,
  type Me,
  type Member,
  type Message,
  type PublicUser,
  type ReactionGroup,
  type Relationship,
  type Role,
  type Server,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

// ---------- users ----------

export function userRow(id: string): Row | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
}

export function toPublicUser(r: Row): PublicUser {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatar: r.avatar,
    avatarSeed: r.avatar_seed,
    bannerColor: r.banner_color,
    about: r.about,
    pronouns: r.pronouns,
    customStatus: r.custom_status,
    createdAt: r.created_at,
    status: effectiveStatus(r.id, r.status),
  };
}

export function toMe(r: Row): Me {
  const u = toPublicUser(r);
  return { ...u, status: r.status === "invisible" ? "invisible" : u.status, statusPref: r.status };
}

export function publicUsers(ids: Iterable<string>): PublicUser[] {
  const list = [...new Set(ids)];
  if (!list.length) return [];
  const out: PublicUser[] = [];
  const db = getDb();
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    const rows = db
      .prepare(`SELECT * FROM users WHERE id IN (${chunk.map(() => "?").join(",")})`)
      .all(...chunk) as Row[];
    out.push(...rows.map(toPublicUser));
  }
  return out;
}

// ---------- relationships ----------

export function relationships(userId: string): Relationship[] {
  const db = getDb();
  const out: Relationship[] = [];
  const fr = db
    .prepare("SELECT * FROM friendships WHERE requester_id = ? OR addressee_id = ?")
    .all(userId, userId) as Row[];
  for (const f of fr) {
    const other = f.requester_id === userId ? f.addressee_id : f.requester_id;
    const type = f.status === "accepted" ? "friends" : f.requester_id === userId ? "outgoing" : "incoming";
    out.push({ userId: other, type, since: f.created_at });
  }
  const bl = db.prepare("SELECT * FROM blocks WHERE blocker_id = ?").all(userId) as Row[];
  for (const b of bl) {
    const i = out.findIndex((r) => r.userId === b.blocked_id);
    if (i >= 0) out.splice(i, 1);
    out.push({ userId: b.blocked_id, type: "blocked", since: b.created_at });
  }
  return out;
}

export function isBlockedEitherWay(a: string, b: string): boolean {
  return !!getDb()
    .prepare(
      "SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
    )
    .get(a, b, b, a);
}

export function friendIds(userId: string): string[] {
  return (
    getDb()
      .prepare(
        "SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id FROM friendships WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'",
      )
      .all(userId, userId, userId) as Row[]
  ).map((r) => r.id);
}

/** Everyone who should see this user's presence/profile updates. */
export function audienceOfUser(userId: string): string[] {
  const db = getDb();
  const ids = new Set<string>([userId]);
  for (const r of db
    .prepare(
      "SELECT DISTINCT m2.user_id AS id FROM members m1 JOIN members m2 ON m1.server_id = m2.server_id WHERE m1.user_id = ?",
    )
    .all(userId) as Row[])
    ids.add(r.id);
  for (const r of db
    .prepare(
      "SELECT DISTINCT d2.user_id AS id FROM dm_members d1 JOIN dm_members d2 ON d1.channel_id = d2.channel_id WHERE d1.user_id = ?",
    )
    .all(userId) as Row[])
    ids.add(r.id);
  for (const r of db
    .prepare("SELECT requester_id AS a, addressee_id AS b FROM friendships WHERE requester_id = ? OR addressee_id = ?")
    .all(userId, userId) as Row[]) {
    ids.add(r.a);
    ids.add(r.b);
  }
  return [...ids];
}

// ---------- servers / roles / permissions ----------

export function toRole(r: Row): Role {
  return {
    id: r.id,
    serverId: r.server_id,
    name: r.name,
    color: r.color,
    position: r.position,
    permissions: r.permissions,
    hoist: !!r.hoist,
    isDefault: !!r.is_default,
  };
}

export function serverRow(id: string): Row | undefined {
  return getDb().prepare("SELECT * FROM servers WHERE id = ?").get(id) as Row | undefined;
}

export function isMember(serverId: string, userId: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?").get(serverId, userId);
}

export function memberRoleIds(serverId: string, userId: string): string[] {
  return (
    getDb()
      .prepare("SELECT role_id FROM member_roles WHERE server_id = ? AND user_id = ?")
      .all(serverId, userId) as Row[]
  ).map((r) => r.role_id);
}

export function serverPermissions(serverId: string, userId: string): number {
  const s = serverRow(serverId);
  if (!s) return 0;
  if (s.owner_id === userId) return ALL_PERMS;
  if (!isMember(serverId, userId)) return 0;
  const rows = getDb()
    .prepare(
      `SELECT permissions FROM roles WHERE server_id = ? AND (is_default = 1 OR id IN
        (SELECT role_id FROM member_roles WHERE server_id = ? AND user_id = ?))`,
    )
    .all(serverId, serverId, userId) as Row[];
  let p = rows.reduce((acc, r) => acc | r.permissions, 0);
  if (p & Perm.ADMIN) p = ALL_PERMS;
  return p;
}

/** Highest role position the user holds (owner = Infinity). */
export function topRolePosition(serverId: string, userId: string): number {
  const s = serverRow(serverId);
  if (s?.owner_id === userId) return Infinity;
  const r = getDb()
    .prepare(
      "SELECT MAX(r.position) AS p FROM roles r JOIN member_roles mr ON mr.role_id = r.id WHERE mr.server_id = ? AND mr.user_id = ?",
    )
    .get(serverId, userId) as Row;
  return r?.p ?? 0;
}

export function requirePerm(serverId: string, userId: string, perm: number): number {
  if (!serverRow(serverId)) fail(404, "Server not found");
  const p = serverPermissions(serverId, userId);
  if (!isMember(serverId, userId)) fail(404, "Server not found");
  if (!hasPerm(p, perm)) fail(403, "You don't have permission to do that.");
  return p;
}

export function memberCount(serverId: string): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM members WHERE server_id = ?").get(serverId) as Row).n;
}

export function toServer(r: Row, userId: string): Server {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    ownerId: r.owner_id,
    description: r.description,
    isPublic: !!r.is_public,
    bannerColor: r.banner_color,
    createdAt: r.created_at,
    memberCount: memberCount(r.id),
    myPermissions: serverPermissions(r.id, userId),
  };
}

export function serverMemberIds(serverId: string): string[] {
  return (getDb().prepare("SELECT user_id FROM members WHERE server_id = ?").all(serverId) as Row[]).map(
    (r) => r.user_id,
  );
}

export function toMember(r: Row): Member {
  return {
    userId: r.user_id,
    serverId: r.server_id,
    nickname: r.nickname,
    joinedAt: r.joined_at,
    roleIds: memberRoleIds(r.server_id, r.user_id),
  };
}

// ---------- channels ----------

export function channelRow(id: string): Row | undefined {
  return getDb().prepare("SELECT * FROM channels WHERE id = ?").get(id) as Row | undefined;
}

export function channelRoleIds(channelId: string): string[] {
  return (getDb().prepare("SELECT role_id FROM channel_roles WHERE channel_id = ?").all(channelId) as Row[]).map(
    (r) => r.role_id,
  );
}

export function dmRecipientIds(channelId: string): string[] {
  return (getDb().prepare("SELECT user_id FROM dm_members WHERE channel_id = ?").all(channelId) as Row[]).map(
    (r) => r.user_id,
  );
}

export function toChannel(r: Row, viewerId?: string): Channel {
  const c: Channel = {
    id: r.id,
    serverId: r.server_id,
    categoryId: r.category_id,
    type: r.type,
    name: r.name,
    topic: r.topic,
    position: r.position,
    isPrivate: !!r.is_private,
    roleIds: r.is_private ? channelRoleIds(r.id) : [],
    ownerId: r.owner_id,
    icon: r.icon,
    lastMessageId: r.last_message_id,
  };
  if (r.type === "dm" || r.type === "group") {
    c.recipients = dmRecipientIds(r.id).filter((id) => id !== viewerId);
  }
  return c;
}

export function toCategory(r: Row): Category {
  return { id: r.id, serverId: r.server_id, name: r.name, position: r.position };
}

/** Can the user see this channel? Returns server permissions (or a DM pseudo-permission set). */
export function channelAccess(channelId: string, userId: string): { row: Row; perms: number } {
  const c = channelRow(channelId);
  if (!c) fail(404, "Channel not found");
  const row = c as Row;
  if (row.type === "dm" || row.type === "group") {
    const inIt = getDb().prepare("SELECT 1 FROM dm_members WHERE channel_id = ? AND user_id = ?").get(channelId, userId);
    if (!inIt) fail(404, "Channel not found");
    const perms =
      Perm.SEND_MESSAGES | Perm.ATTACH_FILES | Perm.ADD_REACTIONS | Perm.CONNECT | Perm.MENTION_EVERYONE;
    return { row, perms: row.type === "group" && row.owner_id === userId ? perms | Perm.MANAGE_CHANNELS : perms };
  }
  const perms = serverPermissions(row.server_id, userId);
  if (!perms) fail(404, "Channel not found");
  if (row.is_private && !hasPerm(perms, Perm.ADMIN) && !hasPerm(perms, Perm.MANAGE_CHANNELS)) {
    const allowed = channelRoleIds(channelId);
    const mine = memberRoleIds(row.server_id, userId);
    if (!allowed.some((r) => mine.includes(r))) fail(404, "Channel not found");
  }
  return { row, perms };
}

export function canSeeChannel(row: Row, userId: string): boolean {
  try {
    channelAccess(row.id, userId);
    return true;
  } catch {
    return false;
  }
}

/** User ids that can see the channel: event audience. */
export function channelAudience(row: Row): string[] {
  if (row.type === "dm" || row.type === "group") return dmRecipientIds(row.id);
  const ids = serverMemberIds(row.server_id);
  if (!row.is_private) return ids;
  return ids.filter((id) => canSeeChannel(row, id));
}

export function visibleServerChannels(serverId: string, userId: string): Channel[] {
  const rows = getDb()
    .prepare("SELECT * FROM channels WHERE server_id = ? ORDER BY position, created_at")
    .all(serverId) as Row[];
  return rows.filter((r) => !r.is_private || canSeeChannel(r, userId)).map((r) => toChannel(r, userId));
}

// ---------- messages ----------

export function reactionGroups(messageIds: string[], viewerId: string): Map<string, ReactionGroup[]> {
  const out = new Map<string, ReactionGroup[]>();
  if (!messageIds.length) return out;
  const rows = getDb()
    .prepare(
      `SELECT message_id, emoji, user_id FROM reactions WHERE message_id IN (${messageIds.map(() => "?").join(",")}) ORDER BY created_at`,
    )
    .all(...messageIds) as Row[];
  for (const r of rows) {
    const list = out.get(r.message_id) ?? [];
    let g = list.find((x) => x.emoji === r.emoji);
    if (!g) {
      g = { emoji: r.emoji, count: 0, me: false, userIds: [] };
      list.push(g);
    }
    g.count++;
    g.userIds.push(r.user_id);
    if (r.user_id === viewerId) g.me = true;
    out.set(r.message_id, list);
  }
  return out;
}

export function hydrateMessages(rows: Row[], viewerId: string): Message[] {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");
  const atts = db.prepare(`SELECT * FROM attachments WHERE message_id IN (${ph})`).all(...ids) as Row[];
  const ments = db.prepare(`SELECT * FROM mentions WHERE message_id IN (${ph})`).all(...ids) as Row[];
  const reacts = reactionGroups(ids, viewerId);
  const replyIds = [...new Set(rows.map((r) => r.reply_to).filter(Boolean))] as string[];
  const replies = new Map<string, Row>();
  if (replyIds.length) {
    for (const r of db
      .prepare(`SELECT * FROM messages WHERE id IN (${replyIds.map(() => "?").join(",")})`)
      .all(...replyIds) as Row[])
      replies.set(r.id, r);
  }
  const replyAtt = new Set<string>();
  if (replyIds.length) {
    for (const r of db
      .prepare(`SELECT DISTINCT message_id FROM attachments WHERE message_id IN (${replyIds.map(() => "?").join(",")})`)
      .all(...replyIds) as Row[])
      replyAtt.add(r.message_id);
  }
  return rows.map((r) => {
    const rep = r.reply_to ? replies.get(r.reply_to) : undefined;
    return {
      id: r.id,
      channelId: r.channel_id,
      authorId: r.author_id,
      content: r.content,
      type: r.type,
      replyTo: r.reply_to
        ? rep
          ? { id: rep.id, authorId: rep.author_id, content: rep.content.slice(0, 200), hasAttachments: replyAtt.has(rep.id) }
          : { id: r.reply_to, authorId: null, content: "", hasAttachments: false, deleted: true }
        : null,
      mentions: ments.filter((m) => m.message_id === r.id).map((m) => m.user_id),
      mentionEveryone: !!r.mention_everyone,
      pinned: !!r.pinned,
      editedAt: r.edited_at,
      createdAt: r.created_at ?? idTime(r.id),
      attachments: atts
        .filter((a) => a.message_id === r.id)
        .map((a): Attachment => ({ id: a.id, filename: a.filename, url: a.url, mime: a.mime, size: a.size })),
      reactions: reacts.get(r.id) ?? [],
    };
  });
}

export function messageRow(id: string): Row | undefined {
  return getDb().prepare("SELECT * FROM messages WHERE id = ?").get(id) as Row | undefined;
}
