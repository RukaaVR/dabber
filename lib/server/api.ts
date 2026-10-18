import { getDb, newId, now } from "./db";
import { Router, str, type Ctx } from "./router";
import {
  channelAccess,
  channelAudience,
  channelRow,
  dmRecipientIds,
  fail,
  friendIds,
  hydrateMessages,
  isBlockedEitherWay,
  isMember,
  messageRow,
  publicUsers,
  reactionGroups,
  relationships,
  requirePerm,
  serverMemberIds,
  serverPermissions,
  serverRow,
  toCategory,
  toChannel,
  toMember,
  toPublicUser,
  toRole,
  topRolePosition,
  userRow,
  memberCount,
  canSeeChannel,
  audienceOfUser,
} from "./repo";
import {
  announceDm,
  bootstrap,
  broadcastMessage,
  broadcastUser,
  createServer,
  getOrCreateDm,
  inviteCode,
  joinServer,
  removeMember,
  serverState,
  systemMessage,
  TEMPLATES,
} from "./actions";
import { checkPassword, clearSessionCookie, createSession, destroySession, hashPassword, parseCookies, SESSION_COOKIE, sessionCookie } from "./auth";
import { saveUpload, serveUpload } from "./files";
import { emitToServer, emitToUsers, hub, isOnline, onlineUserIds } from "./realtime";
import { LIMITS, Perm, hasPerm, type DiscoverServer, type InviteInfo } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const r = new Router();
const db = () => getDb();

const USERNAME_RE = /^[a-z0-9_.]{2,32}$/;

function secureCookie(ctx: Ctx) {
  return ctx.url.protocol === "https:" || ctx.req.headers.get("x-forwarded-proto") === "https";
}

function withCookie(body: unknown, cookie: string, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
}

// Very small in-memory rate limiter (per key, sliding window).
const buckets = new Map<string, number[]>();
function rateLimit(key: string, max: number, windowMs: number) {
  const t = Date.now();
  const list = (buckets.get(key) ?? []).filter((x) => t - x < windowMs);
  if (list.length >= max) fail(429, "Too many tries. Wait a minute and try again.");
  list.push(t);
  buckets.set(key, list);
}

function clientKey(ctx: Ctx) {
  return ctx.req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

// ---------------- meta ----------------

r.get("health", () => ({ ok: true, time: now() }));

r.get("stats", () => {
  const users = (db().prepare("SELECT COUNT(*) AS n FROM users").get() as Row).n;
  return { online: onlineUserIds().length, users };
});

r.get("templates", () => Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label })));

// ---------------- auth ----------------

r.post("auth/signup", async (ctx) => {
  rateLimit(`signup:${clientKey(ctx)}`, 10, 60_000);
  const b = await ctx.json<Record<string, unknown>>();
  const username = str(b.username, "Username", { min: 2, max: 32 }).toLowerCase();
  if (!USERNAME_RE.test(username)) fail(400, "Usernames can use a–z, 0–9, _ and . (2–32 characters).");
  const displayName = str(b.displayName, "Display name", { optional: true, max: LIMITS.nameLength }) || username;
  if (typeof b.password !== "string" || b.password.length < 6) fail(400, "Passwords need at least 6 characters.");
  if ((b.password as string).length > 200) fail(400, "That password is too long.");
  if (db().prepare("SELECT 1 FROM users WHERE username = ?").get(username)) fail(409, "That username is taken. Try another.");
  const id = newId();
  db()
    .prepare(
      "INSERT INTO users (id, username, display_name, password_hash, avatar_seed, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, username, displayName, await hashPassword(b.password as string), Math.floor(Math.random() * 6), now());
  const token = createSession(id);
  return withCookie({ ok: true, userId: id }, sessionCookie(token, secureCookie(ctx)), 201);
});

r.post("auth/login", async (ctx) => {
  rateLimit(`login:${clientKey(ctx)}`, 20, 60_000);
  const b = await ctx.json<Record<string, unknown>>();
  const username = str(b.username, "Username", { min: 1, max: 64 }).toLowerCase();
  const row = db().prepare("SELECT * FROM users WHERE username = ?").get(username) as Row | undefined;
  if (!row || typeof b.password !== "string" || !(await checkPassword(b.password, row.password_hash)))
    fail(401, "That username and password don’t match.");
  const token = createSession(row!.id);
  return withCookie({ ok: true, userId: row!.id }, sessionCookie(token, secureCookie(ctx)));
});

r.post("auth/logout", (ctx) => {
  const token = parseCookies(ctx.req.headers.get("cookie"))[SESSION_COOKIE];
  if (token) destroySession(token);
  return withCookie({ ok: true }, clearSessionCookie());
});

r.get("auth/username-available", (ctx) => {
  const u = (ctx.url.searchParams.get("u") ?? "").toLowerCase();
  if (!USERNAME_RE.test(u)) return { available: false, valid: false };
  return { available: !db().prepare("SELECT 1 FROM users WHERE username = ?").get(u), valid: true };
});

r.get("bootstrap", (ctx) => {
  const data = bootstrap(ctx.uid());
  if (!data) fail(401, "You need to log in first.");
  return data;
});

// ---------------- me / users ----------------

r.patch("users/me", async (ctx) => {
  const uid = ctx.uid();
  const b = await ctx.json<Record<string, unknown>>();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };
  if ("displayName" in b) set("display_name", str(b.displayName, "Display name", { min: 1, max: LIMITS.nameLength }));
  if ("about" in b) set("about", str(b.about, "About me", { optional: true, max: LIMITS.aboutLength }));
  if ("pronouns" in b) set("pronouns", str(b.pronouns, "Pronouns", { optional: true, max: 40 }));
  if ("customStatus" in b) set("custom_status", str(b.customStatus, "Status", { optional: true, max: LIMITS.customStatus }));
  if ("bannerColor" in b) {
    if (b.bannerColor !== null && !(typeof b.bannerColor === "string" && /^#[0-9a-f]{6}$/i.test(b.bannerColor)))
      fail(400, "Pick a color");
    set("banner_color", b.bannerColor);
  }
  if ("avatar" in b) {
    if (b.avatar !== null && !(typeof b.avatar === "string" && b.avatar.startsWith("/api/files/"))) fail(400, "Bad picture");
    set("avatar", b.avatar);
  }
  if ("avatarSeed" in b) {
    const n = Number(b.avatarSeed);
    if (!Number.isInteger(n) || n < 0 || n > 5) fail(400, "Bad avatar");
    set("avatar_seed", n);
  }
  if ("status" in b) {
    if (!["online", "idle", "dnd", "invisible"].includes(String(b.status))) fail(400, "Bad status");
    set("status", b.status);
  }
  if ("username" in b) {
    const u = str(b.username, "Username", { min: 2, max: 32 }).toLowerCase();
    if (!USERNAME_RE.test(u)) fail(400, "Usernames can use a–z, 0–9, _ and . (2–32 characters).");
    if (db().prepare("SELECT 1 FROM users WHERE username = ? AND id != ?").get(u, uid)) fail(409, "That username is taken.");
    set("username", u);
  }
  if (sets.length) db().prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals, uid);
  broadcastUser(uid);
  return { ok: true };
});

r.post("users/me/password", async (ctx) => {
  const uid = ctx.uid();
  const b = await ctx.json<Record<string, unknown>>();
  const row = userRow(uid)!;
  if (typeof b.current !== "string" || !(await checkPassword(b.current, row.password_hash))) fail(403, "Your current password is wrong.");
  if (typeof b.next !== "string" || b.next.length < 6) fail(400, "Passwords need at least 6 characters.");
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(b.next as string), uid);
  const token = parseCookies(ctx.req.headers.get("cookie"))[SESSION_COOKIE];
  db().prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(uid, token ?? "");
  return { ok: true };
});

r.post("users/me/delete", async (ctx) => {
  const uid = ctx.uid();
  const b = await ctx.json<Record<string, unknown>>();
  const row = userRow(uid)!;
  if (typeof b.password !== "string" || !(await checkPassword(b.password, row.password_hash))) fail(403, "That password is wrong.");
  const owned = db().prepare("SELECT id FROM servers WHERE owner_id = ?").all(uid) as Row[];
  const audience = audienceOfUser(uid);
  for (const s of owned) {
    const members = serverMemberIds(s.id);
    db().prepare("DELETE FROM servers WHERE id = ?").run(s.id);
    emitToUsers(members, "server:delete", { id: s.id });
  }
  db().prepare("DELETE FROM users WHERE id = ?").run(uid);
  emitToUsers(audience, "user:remove", { userId: uid });
  return withCookie({ ok: true }, clearSessionCookie());
});

r.get("users/search", (ctx) => {
  ctx.uid();
  const q = (ctx.url.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = db()
    .prepare("SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' OR lower(display_name) LIKE ? ESCAPE '\\' LIMIT 20")
    .all(`${q.replace(/[%_\\]/g, "\\$&")}%`, `%${q.replace(/[%_\\]/g, "\\$&")}%`) as Row[];
  return rows.map(toPublicUser);
});

r.get("users/:id", (ctx) => {
  const uid = ctx.uid();
  const row = userRow(ctx.params.id);
  if (!row) fail(404, "User not found");
  const mutualServers = (
    db()
      .prepare(
        "SELECT m1.server_id AS id FROM members m1 JOIN members m2 ON m1.server_id = m2.server_id WHERE m1.user_id = ? AND m2.user_id = ?",
      )
      .all(uid, ctx.params.id) as Row[]
  ).map((x) => x.id);
  const mine = new Set(friendIds(uid));
  const mutualFriends = friendIds(ctx.params.id).filter((f) => mine.has(f));
  return { user: toPublicUser(row!), mutualServers, mutualFriends };
});

// ---------------- relationships ----------------

r.post("friends", async (ctx) => {
  const uid = ctx.uid();
  const b = await ctx.json<Record<string, unknown>>();
  let target: Row | undefined;
  if (typeof b.userId === "string") target = userRow(b.userId);
  else {
    const name = str(b.username, "Username", { min: 1, max: 40 }).replace(/^@/, "").toLowerCase();
    target = db().prepare("SELECT * FROM users WHERE username = ?").get(name) as Row | undefined;
  }
  if (!target) fail(404, "Hm, didn’t work. Double check the username is right.");
  const tid = target!.id;
  if (tid === uid) fail(400, "You can’t add yourself. Nice try though.");
  if (isBlockedEitherWay(uid, tid)) fail(403, "You can’t add this person.");
  const existing = db()
    .prepare("SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)")
    .get(uid, tid, tid, uid) as Row | undefined;
  if (existing?.status === "accepted") fail(409, "You’re already friends.");
  if (existing && existing.requester_id === uid) fail(409, "You already sent them a request.");
  if (existing) {
    // they asked us: accept
    db().prepare("UPDATE friendships SET status = 'accepted', created_at = ? WHERE requester_id = ? AND addressee_id = ?").run(now(), tid, uid);
  } else {
    db().prepare("INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(uid, tid, now());
  }
  pushRelationships(uid, tid);
  return { ok: true, accepted: !!existing, user: toPublicUser(target!) };
});

function pushRelationships(a: string, b: string) {
  for (const [me, other] of [
    [a, b],
    [b, a],
  ]) {
    const rel = relationships(me).find((x) => x.userId === other);
    const u = userRow(other);
    emitToUsers([me], "relationship:update", { userId: other, relationship: rel ?? null, user: u ? toPublicUser(u) : null });
  }
}

r.post("friends/:id/accept", (ctx) => {
  const uid = ctx.uid();
  const res = db()
    .prepare("UPDATE friendships SET status = 'accepted', created_at = ? WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'")
    .run(now(), ctx.params.id, uid);
  if (!res.changes) fail(404, "That request is gone.");
  pushRelationships(uid, ctx.params.id);
  return { ok: true };
});

r.delete("friends/:id", (ctx) => {
  const uid = ctx.uid();
  db()
    .prepare("DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)")
    .run(uid, ctx.params.id, ctx.params.id, uid);
  pushRelationships(uid, ctx.params.id);
  return { ok: true };
});

r.put("blocks/:id", (ctx) => {
  const uid = ctx.uid();
  if (ctx.params.id === uid) fail(400, "You can’t block yourself.");
  if (!userRow(ctx.params.id)) fail(404, "User not found");
  db().prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").run(uid, ctx.params.id, now());
  db()
    .prepare("DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)")
    .run(uid, ctx.params.id, ctx.params.id, uid);
  pushRelationships(uid, ctx.params.id);
  return { ok: true };
});

r.delete("blocks/:id", (ctx) => {
  const uid = ctx.uid();
  db().prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").run(uid, ctx.params.id);
  pushRelationships(uid, ctx.params.id);
  return { ok: true };
});

// ---------------- DMs ----------------

r.post("dms", async (ctx) => {
  const uid = ctx.uid();
  const b = await ctx.json<Record<string, unknown>>();
  if (typeof b.userId === "string") {
    if (b.userId === uid) fail(400, "That’s you!");
    if (!userRow(b.userId)) fail(404, "User not found");
    const id = getOrCreateDm(uid, b.userId);
    const row = channelRow(id)!;
    return { channel: toChannel(row, uid), users: publicUsers([b.userId]) };
  }
  const ids = Array.isArray(b.userIds) ? [...new Set(b.userIds.filter((x): x is string => typeof x === "string"))] : [];
  if (ids.length < 1) fail(400, "Pick at least one friend.");
  if (ids.length > 9) fail(400, "Groups can have up to 10 people.");
  const friends = new Set(friendIds(uid));
  if (ids.some((id) => !friends.has(id))) fail(403, "You can only add friends to a group.");
  const name = str(b.name, "Group name", { optional: true, max: 64 });
  const id = newId();
  const ts = now();
  db().transaction(() => {
    db().prepare("INSERT INTO channels (id, type, name, owner_id, created_at) VALUES (?, 'group', ?, ?, ?)").run(id, name, uid, ts);
    for (const m of [uid, ...ids]) db().prepare("INSERT INTO dm_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)").run(id, m, ts);
  })();
  systemMessage(id, uid, "system", "created the group.");
  announceDm(id);
  return { channel: toChannel(channelRow(id)!, uid), users: publicUsers(ids) };
});

r.post("dms/:id/hide", (ctx) => {
  const uid = ctx.uid();
  db().prepare("UPDATE dm_members SET hidden = 1 WHERE channel_id = ? AND user_id = ?").run(ctx.params.id, uid);
  emitToUsers([uid], "dm:hide", { channelId: ctx.params.id });
  return { ok: true };
});

r.post("dms/:id/members", async (ctx) => {
  const uid = ctx.uid();
  const { row } = channelAccess(ctx.params.id, uid);
  if (row.type !== "group") fail(400, "You can only add people to groups.");
  const b = await ctx.json<Record<string, unknown>>();
  const ids = Array.isArray(b.userIds) ? b.userIds.filter((x): x is string => typeof x === "string") : [];
  const friends = new Set(friendIds(uid));
  const current = dmRecipientIds(row.id);
  const add = ids.filter((id) => friends.has(id) && !current.includes(id));
  if (current.length + add.length > 10) fail(400, "Groups can have up to 10 people.");
  for (const id of add) {
    db().prepare("INSERT OR IGNORE INTO dm_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)").run(row.id, id, now());
    systemMessage(row.id, uid, "system", `added <@${id}> to the group.`);
  }
  announceDm(row.id);
  return { ok: true };
});

r.post("dms/:id/leave", (ctx) => {
  const uid = ctx.uid();
  const { row } = channelAccess(ctx.params.id, uid);
  if (row.type !== "group") fail(400, "You can only leave groups.");
  systemMessage(row.id, uid, "system", "left the group.");
  db().prepare("DELETE FROM dm_members WHERE channel_id = ? AND user_id = ?").run(row.id, uid);
  const rest = dmRecipientIds(row.id);
  if (!rest.length) db().prepare("DELETE FROM channels WHERE id = ?").run(row.id);
  else {
    if (row.owner_id === uid) db().prepare("UPDATE channels SET owner_id = ? WHERE id = ?").run(rest[0], row.id);
    announceDm(row.id);
  }
  emitToUsers([uid], "dm:hide", { channelId: row.id, left: true });
  return { ok: true };
});

// ---------------- servers ----------------

r.post("servers", async (ctx) => {
  const uid = ctx.uid();
  const b = await ctx.json<Record<string, unknown>>();
  const name = str(b.name, "Server name", { min: 1, max: LIMITS.serverName });
  const icon = typeof b.icon === "string" && b.icon.startsWith("/api/files/") ? b.icon : null;
  const owned = (db().prepare("SELECT COUNT(*) AS n FROM servers WHERE owner_id = ?").get(uid) as Row).n;
  if (owned >= 100) fail(400, "You own 100 servers already. That’s the limit.");
  const res = createServer(uid, name, typeof b.template === "string" ? b.template : "blank", icon);
  return { ...serverState(res.id, uid), firstChannelId: res.firstChannelId };
});

r.get("servers/:id", (ctx) => {
  const uid = ctx.uid();
  if (!isMember(ctx.params.id, uid)) fail(404, "Server not found");
  return serverState(ctx.params.id, uid);
});

r.patch("servers/:id", async (ctx) => {
  const uid = ctx.uid();
  requirePerm(ctx.params.id, uid, Perm.MANAGE_SERVER);
  const b = await ctx.json<Record<string, unknown>>();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if ("name" in b) {
    sets.push("name = ?");
    vals.push(str(b.name, "Server name", { min: 1, max: LIMITS.serverName }));
  }
  if ("description" in b) {
    sets.push("description = ?");
    vals.push(str(b.description, "Description", { optional: true, max: 300 }));
  }
  if ("isPublic" in b) {
    sets.push("is_public = ?");
    vals.push(b.isPublic ? 1 : 0);
  }
  if ("icon" in b) {
    if (b.icon !== null && !(typeof b.icon === "string" && b.icon.startsWith("/api/files/"))) fail(400, "Bad icon");
    sets.push("icon = ?");
    vals.push(b.icon);
  }
  if ("bannerColor" in b) {
    if (b.bannerColor !== null && !(typeof b.bannerColor === "string" && /^#[0-9a-f]{6}$/i.test(b.bannerColor))) fail(400, "Bad color");
    sets.push("banner_color = ?");
    vals.push(b.bannerColor);
  }
  if (sets.length) db().prepare(`UPDATE servers SET ${sets.join(", ")} WHERE id = ?`).run(...vals, ctx.params.id);
  const s = serverRow(ctx.params.id)!;
  emitToServer(ctx.params.id, "server:update", {
    server: { id: s.id, name: s.name, icon: s.icon, description: s.description, isPublic: !!s.is_public, bannerColor: s.banner_color },
  });
  return { ok: true };
});

r.delete("servers/:id", (ctx) => {
  const uid = ctx.uid();
  const s = serverRow(ctx.params.id);
  if (!s || !isMember(s.id, uid)) fail(404, "Server not found");
  if (s!.owner_id !== uid) fail(403, "Only the owner can delete the server.");
  const members = serverMemberIds(s!.id);
  db().prepare("DELETE FROM servers WHERE id = ?").run(s!.id);
  emitToUsers(members.filter((m) => m !== uid), "server:delete", { id: s!.id, name: s!.name, reason: "deleted" });
  emitToUsers([uid], "server:delete", { id: s!.id });
  return { ok: true };
});

r.post("servers/:id/leave", (ctx) => {
  const uid = ctx.uid();
  const s = serverRow(ctx.params.id);
  if (!s || !isMember(s.id, uid)) fail(404, "Server not found");
  if (s!.owner_id === uid) fail(400, "You own this server. Delete it or hand it over first.");
  removeMember(s!.id, uid);
  return { ok: true };
});

r.get("servers/:id/members", (ctx) => {
  const uid = ctx.uid();
  if (!isMember(ctx.params.id, uid)) fail(404, "Server not found");
  const rows = db().prepare("SELECT * FROM members WHERE server_id = ? ORDER BY joined_at").all(ctx.params.id) as Row[];
  return { members: rows.map(toMember), users: publicUsers(rows.map((x) => x.user_id)) };
});

r.patch("servers/:id/members/:userId", async (ctx) => {
  const uid = ctx.uid();
  const sid = ctx.params.id;
  const target = ctx.params.userId;
  if (!isMember(sid, uid) || !isMember(sid, target)) fail(404, "Member not found");
  const b = await ctx.json<Record<string, unknown>>();
  const perms = serverPermissions(sid, uid);
  if ("nickname" in b) {
    if (target !== uid && !hasPerm(perms, Perm.MANAGE_NICKNAMES)) fail(403, "You can’t change their nickname.");
    const nick = b.nickname === null ? null : str(b.nickname, "Nickname", { optional: true, max: LIMITS.nameLength }) || null;
    db().prepare("UPDATE members SET nickname = ? WHERE server_id = ? AND user_id = ?").run(nick, sid, target);
  }
  if (Array.isArray(b.roleIds)) {
    if (!hasPerm(perms, Perm.MANAGE_ROLES)) fail(403, "You can’t manage roles.");
    const myTop = topRolePosition(sid, uid);
    const roles = db().prepare("SELECT * FROM roles WHERE server_id = ? AND is_default = 0").all(sid) as Row[];
    const current = new Set(
      (db().prepare("SELECT role_id FROM member_roles WHERE server_id = ? AND user_id = ?").all(sid, target) as Row[]).map((x) => x.role_id),
    );
    const want = new Set(b.roleIds.filter((x): x is string => typeof x === "string"));
    for (const role of roles) {
      const has = current.has(role.id);
      const should = want.has(role.id);
      if (has === should) continue;
      if (role.position >= myTop) fail(403, `You can’t give or take “${role.name}”, it’s at or above your highest role.`);
      if (should) db().prepare("INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)").run(sid, target, role.id);
      else db().prepare("DELETE FROM member_roles WHERE user_id = ? AND role_id = ?").run(target, role.id);
    }
    emitToUsers([target], "server:refresh", { serverId: sid });
  }
  const m = db().prepare("SELECT * FROM members WHERE server_id = ? AND user_id = ?").get(sid, target) as Row;
  emitToServer(sid, "member:update", { member: toMember(m) });
  return { member: toMember(m) };
});

function assertCanModerate(sid: string, uid: string, target: string, perm: number) {
  requirePerm(sid, uid, perm);
  const s = serverRow(sid)!;
  if (target === uid) fail(400, "You can’t do that to yourself.");
  if (target === s.owner_id) fail(403, "You can’t do that to the owner.");
  if (topRolePosition(sid, target) >= topRolePosition(sid, uid)) fail(403, "Their highest role is at or above yours.");
}

r.delete("servers/:id/members/:userId", (ctx) => {
  const uid = ctx.uid();
  const { id: sid, userId: target } = ctx.params;
  if (!isMember(sid, target)) fail(404, "Member not found");
  assertCanModerate(sid, uid, target, Perm.KICK);
  removeMember(sid, target, "kicked");
  return { ok: true };
});

r.get("servers/:id/bans", (ctx) => {
  const uid = ctx.uid();
  requirePerm(ctx.params.id, uid, Perm.BAN);
  const rows = db().prepare("SELECT * FROM bans WHERE server_id = ? ORDER BY created_at DESC").all(ctx.params.id) as Row[];
  return { bans: rows.map((b) => ({ userId: b.user_id, reason: b.reason, createdAt: b.created_at })), users: publicUsers(rows.map((b) => b.user_id)) };
});

r.put("servers/:id/bans/:userId", async (ctx) => {
  const uid = ctx.uid();
  const { id: sid, userId: target } = ctx.params;
  if (!userRow(target)) fail(404, "User not found");
  assertCanModerate(sid, uid, target, Perm.BAN);
  const b = await ctx.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const reason = str(b.reason, "Reason", { optional: true, max: 200 });
  db().prepare("INSERT OR REPLACE INTO bans (server_id, user_id, reason, banned_by, created_at) VALUES (?, ?, ?, ?, ?)").run(sid, target, reason, uid, now());
  if (b.deleteMessages) {
    const chans = (db().prepare("SELECT id FROM channels WHERE server_id = ?").all(sid) as Row[]).map((c) => c.id);
    for (const cid of chans) {
      const ids = (db().prepare("SELECT id FROM messages WHERE channel_id = ? AND author_id = ?").all(cid, target) as Row[]).map((m) => m.id);
      db().prepare("DELETE FROM messages WHERE channel_id = ? AND author_id = ?").run(cid, target);
      for (const mid of ids) emitToServer(sid, "message:delete", { id: mid, channelId: cid });
    }
  }
  if (isMember(sid, target)) removeMember(sid, target, "banned");
  return { ok: true };
});

r.delete("servers/:id/bans/:userId", (ctx) => {
  const uid = ctx.uid();
  requirePerm(ctx.params.id, uid, Perm.BAN);
  db().prepare("DELETE FROM bans WHERE server_id = ? AND user_id = ?").run(ctx.params.id, ctx.params.userId);
  return { ok: true };
});

// roles
r.post("servers/:id/roles", async (ctx) => {
  const uid = ctx.uid();
  const sid = ctx.params.id;
  requirePerm(sid, uid, Perm.MANAGE_ROLES);
  const b = await ctx.json<Record<string, unknown>>();
  const name = str(b.name, "Role name", { optional: true, max: 32 }) || "new role";
  const maxPos = (db().prepare("SELECT MAX(position) AS p FROM roles WHERE server_id = ?").get(sid) as Row).p ?? 0;
  const myTop = topRolePosition(sid, uid);
  const pos = Math.min(maxPos + 1, myTop === Infinity ? maxPos + 1 : myTop);
  // shift roles at/above pos up to make room
  db().prepare("UPDATE roles SET position = position + 1 WHERE server_id = ? AND position >= ? AND is_default = 0").run(sid, pos);
  const id = newId();
  db().prepare("INSERT INTO roles (id, server_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?, 0)").run(id, sid, name, "#99aab5", pos);
  emitToServer(sid, "server:refresh", { serverId: sid });
  return { role: toRole(db().prepare("SELECT * FROM roles WHERE id = ?").get(id) as Row) };
});

r.patch("servers/:id/roles/:roleId", async (ctx) => {
  const uid = ctx.uid();
  const sid = ctx.params.id;
  const myPerms = requirePerm(sid, uid, Perm.MANAGE_ROLES);
  const role = db().prepare("SELECT * FROM roles WHERE id = ? AND server_id = ?").get(ctx.params.roleId, sid) as Row | undefined;
  if (!role) fail(404, "Role not found");
  if (!role!.is_default && role!.position >= topRolePosition(sid, uid)) fail(403, "That role is at or above your highest role.");
  const b = await ctx.json<Record<string, unknown>>();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if ("name" in b && !role!.is_default) {
    sets.push("name = ?");
    vals.push(str(b.name, "Role name", { min: 1, max: 32 }));
  }
  if ("color" in b && !role!.is_default) {
    if (b.color !== null && !(typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color))) fail(400, "Bad color");
    sets.push("color = ?");
    vals.push(b.color);
  }
  if ("hoist" in b && !role!.is_default) {
    sets.push("hoist = ?");
    vals.push(b.hoist ? 1 : 0);
  }
  if ("permissions" in b) {
    const p = Number(b.permissions);
    if (!Number.isInteger(p) || p < 0) fail(400, "Bad permissions");
    // you can't grant permissions you don't have
    if ((p & ~myPerms) & ~role!.permissions) fail(403, "You can’t grant permissions you don’t have.");
    sets.push("permissions = ?");
    vals.push(p);
  }
  if (sets.length) db().prepare(`UPDATE roles SET ${sets.join(", ")} WHERE id = ?`).run(...vals, role!.id);
  emitToServer(sid, "server:refresh", { serverId: sid });
  return { role: toRole(db().prepare("SELECT * FROM roles WHERE id = ?").get(role!.id) as Row) };
});

r.delete("servers/:id/roles/:roleId", (ctx) => {
  const uid = ctx.uid();
  const sid = ctx.params.id;
  requirePerm(sid, uid, Perm.MANAGE_ROLES);
  const role = db().prepare("SELECT * FROM roles WHERE id = ? AND server_id = ?").get(ctx.params.roleId, sid) as Row | undefined;
  if (!role) fail(404, "Role not found");
  if (role!.is_default) fail(400, "You can’t delete @everyone.");
  if (role!.position >= topRolePosition(sid, uid)) fail(403, "That role is at or above your highest role.");
  db().prepare("DELETE FROM roles WHERE id = ?").run(role!.id);
  emitToServer(sid, "server:refresh", { serverId: sid });
  return { ok: true };
});

// categories & channels
r.post("servers/:id/categories", async (ctx) => {
  const uid = ctx.uid();
  const sid = ctx.params.id;
  requirePerm(sid, uid, Perm.MANAGE_CHANNELS);
  const b = await ctx.json<Record<string, unknown>>();
  const name = str(b.name, "Category name", { min: 1, max: 40 });
  const pos = ((db().prepare("SELECT MAX(position) AS p FROM categories WHERE server_id = ?").get(sid) as Row).p ?? -1) + 1;
  const id = newId();
  db().prepare("INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)").run(id, sid, name, pos);
  const cat = toCategory(db().prepare("SELECT * FROM categories WHERE id = ?").get(id) as Row);
  emitToServer(sid, "category:upsert", { category: cat });
  return { category: cat };
});

r.patch("categories/:id", async (ctx) => {
  const uid = ctx.uid();
  const cat = db().prepare("SELECT * FROM categories WHERE id = ?").get(ctx.params.id) as Row | undefined;
  if (!cat) fail(404, "Category not found");
  requirePerm(cat!.server_id, uid, Perm.MANAGE_CHANNELS);
  const b = await ctx.json<Record<string, unknown>>();
  if ("name" in b) db().prepare("UPDATE categories SET name = ? WHERE id = ?").run(str(b.name, "Category name", { min: 1, max: 40 }), cat!.id);
  if (typeof b.position === "number") reorder("categories", cat!.server_id, cat!.id, b.position);
  emitToServer(cat!.server_id, "server:refresh", { serverId: cat!.server_id });
  return { ok: true };
});

r.delete("categories/:id", (ctx) => {
  const uid = ctx.uid();
  const cat = db().prepare("SELECT * FROM categories WHERE id = ?").get(ctx.params.id) as Row | undefined;
  if (!cat) fail(404, "Category not found");
  requirePerm(cat!.server_id, uid, Perm.MANAGE_CHANNELS);
  db().prepare("DELETE FROM categories WHERE id = ?").run(cat!.id);
  emitToServer(cat!.server_id, "server:refresh", { serverId: cat!.server_id });
  return { ok: true };
});

function reorder(table: "categories" | "channels", serverId: string, id: string, position: number) {
  const rows = db().prepare(`SELECT id FROM ${table} WHERE server_id = ? ORDER BY position, id`).all(serverId) as Row[];
  const ids = rows.map((x) => x.id).filter((x) => x !== id);
  ids.splice(Math.max(0, Math.min(ids.length, Math.floor(position))), 0, id);
  const upd = db().prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
  db().transaction(() => ids.forEach((x, i) => upd.run(i, x)))();
}

function channelName(v: unknown, type: string) {
  const raw = str(v, "Channel name", { min: 1, max: LIMITS.channelName });
  if (type === "voice") return raw;
  const n = raw.toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").replace(/-+/g, "-");
  if (!n) fail(400, "Channel names need at least one letter or number.");
  return n;
}

r.post("servers/:id/channels", async (ctx) => {
  const uid = ctx.uid();
  const sid = ctx.params.id;
  requirePerm(sid, uid, Perm.MANAGE_CHANNELS);
  const b = await ctx.json<Record<string, unknown>>();
  const type = b.type === "voice" ? "voice" : "text";
  const name = channelName(b.name, type);
  let categoryId: string | null = typeof b.categoryId === "string" ? b.categoryId : null;
  if (categoryId && !db().prepare("SELECT 1 FROM categories WHERE id = ? AND server_id = ?").get(categoryId, sid)) categoryId = null;
  const pos = ((db().prepare("SELECT MAX(position) AS p FROM channels WHERE server_id = ?").get(sid) as Row).p ?? -1) + 1;
  const id = newId();
  const isPrivate = b.isPrivate ? 1 : 0;
  db().prepare(
    "INSERT INTO channels (id, server_id, category_id, type, name, topic, position, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, sid, categoryId, type, name, str(b.topic, "Topic", { optional: true, max: LIMITS.topic }), pos, isPrivate, now());
  if (isPrivate && Array.isArray(b.roleIds)) {
    for (const rid of b.roleIds)
      if (typeof rid === "string" && db().prepare("SELECT 1 FROM roles WHERE id = ? AND server_id = ?").get(rid, sid))
        db().prepare("INSERT OR IGNORE INTO channel_roles (channel_id, role_id) VALUES (?, ?)").run(id, rid);
  }
  const row = channelRow(id)!;
  if (isPrivate) emitToServer(sid, "server:refresh", { serverId: sid });
  else emitToServer(sid, "channel:upsert", { channel: toChannel(row) });
  return { channel: toChannel(row) };
});

r.patch("channels/:id", async (ctx) => {
  const uid = ctx.uid();
  const { row } = channelAccess(ctx.params.id, uid);
  const b = await ctx.json<Record<string, unknown>>();
  if (row.type === "group") {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if ("name" in b) {
      sets.push("name = ?");
      vals.push(str(b.name, "Group name", { optional: true, max: 64 }));
    }
    if ("icon" in b) {
      if (b.icon !== null && !(typeof b.icon === "string" && b.icon.startsWith("/api/files/"))) fail(400, "Bad icon");
      sets.push("icon = ?");
      vals.push(b.icon);
    }
    if (sets.length) db().prepare(`UPDATE channels SET ${sets.join(", ")} WHERE id = ?`).run(...vals, row.id);
    announceDm(row.id);
    return { ok: true };
  }
  if (row.type === "dm") fail(400, "You can’t edit a DM.");
  requirePerm(row.server_id, uid, Perm.MANAGE_CHANNELS);
  const sets: string[] = [];
  const vals: unknown[] = [];
  if ("name" in b) {
    sets.push("name = ?");
    vals.push(channelName(b.name, row.type));
  }
  if ("topic" in b) {
    sets.push("topic = ?");
    vals.push(str(b.topic, "Topic", { optional: true, max: LIMITS.topic }));
  }
  if ("categoryId" in b) {
    const cid = typeof b.categoryId === "string" && db().prepare("SELECT 1 FROM categories WHERE id = ? AND server_id = ?").get(b.categoryId, row.server_id) ? b.categoryId : null;
    sets.push("category_id = ?");
    vals.push(cid);
  }
  if ("isPrivate" in b) {
    sets.push("is_private = ?");
    vals.push(b.isPrivate ? 1 : 0);
  }
  if (sets.length) db().prepare(`UPDATE channels SET ${sets.join(", ")} WHERE id = ?`).run(...vals, row.id);
  if (Array.isArray(b.roleIds)) {
    db().prepare("DELETE FROM channel_roles WHERE channel_id = ?").run(row.id);
    for (const rid of b.roleIds)
      if (typeof rid === "string" && db().prepare("SELECT 1 FROM roles WHERE id = ? AND server_id = ?").get(rid, row.server_id))
        db().prepare("INSERT OR IGNORE INTO channel_roles (channel_id, role_id) VALUES (?, ?)").run(row.id, rid);
  }
  if (typeof b.position === "number") reorder("channels", row.server_id, row.id, b.position);
  emitToServer(row.server_id, "server:refresh", { serverId: row.server_id });
  return { channel: toChannel(channelRow(row.id)!) };
});

r.delete("channels/:id", (ctx) => {
  const uid = ctx.uid();
  const { row } = channelAccess(ctx.params.id, uid);
  if (!row.server_id) fail(400, "Use leave for groups.");
  requirePerm(row.server_id, uid, Perm.MANAGE_CHANNELS);
  db().prepare("DELETE FROM channels WHERE id = ?").run(row.id);
  emitToServer(row.server_id, "channel:delete", { id: row.id, serverId: row.server_id });
  return { ok: true };
});

// invites
r.get("servers/:id/invites", (ctx) => {
  const uid = ctx.uid();
  requirePerm(ctx.params.id, uid, Perm.CREATE_INVITE);
  const rows = db().prepare("SELECT * FROM invites WHERE server_id = ? ORDER BY created_at DESC").all(ctx.params.id) as Row[];
  return {
    invites: rows.map((i) => ({ code: i.code, creatorId: i.creator_id, uses: i.uses, createdAt: i.created_at })),
    users: publicUsers(rows.map((i) => i.creator_id).filter(Boolean)),
  };
});

r.post("servers/:id/invites", (ctx) => {
  const uid = ctx.uid();
  requirePerm(ctx.params.id, uid, Perm.CREATE_INVITE);
  // reuse my existing invite if there is one
  const mine = db().prepare("SELECT code FROM invites WHERE server_id = ? AND creator_id = ? ORDER BY created_at LIMIT 1").get(ctx.params.id, uid) as Row | undefined;
  if (mine) return { code: mine.code };
  const code = inviteCode();
  db().prepare("INSERT INTO invites (code, server_id, creator_id, created_at) VALUES (?, ?, ?, ?)").run(code, ctx.params.id, uid, now());
  return { code };
});

r.delete("invites/:code", (ctx) => {
  const uid = ctx.uid();
  const inv = db().prepare("SELECT * FROM invites WHERE code = ?").get(ctx.params.code) as Row | undefined;
  if (!inv) fail(404, "Invite not found");
  if (inv!.creator_id !== uid) requirePerm(inv!.server_id, uid, Perm.MANAGE_SERVER);
  db().prepare("DELETE FROM invites WHERE code = ?").run(inv!.code);
  return { ok: true };
});

function onlineCount(serverId: string) {
  return serverMemberIds(serverId).filter((id) => isOnline(id)).length;
}

r.get("invites/:code", (ctx) => {
  const inv = db().prepare("SELECT * FROM invites WHERE code = ?").get(ctx.params.code) as Row | undefined;
  if (!inv) fail(404, "This invite may have expired or the server is gone.");
  const s = serverRow(inv!.server_id)!;
  const inviter = inv!.creator_id ? userRow(inv!.creator_id) : undefined;
  const info: InviteInfo = {
    code: inv!.code,
    server: { id: s.id, name: s.name, icon: s.icon, description: s.description, bannerColor: s.banner_color },
    memberCount: memberCount(s.id),
    onlineCount: onlineCount(s.id),
    inviter: inviter ? { displayName: inviter.display_name } : null,
    joined: !!ctx.userId && isMember(s.id, ctx.userId),
  };
  return info;
});

r.post("invites/:code", (ctx) => {
  const uid = ctx.uid();
  const inv = db().prepare("SELECT * FROM invites WHERE code = ?").get(ctx.params.code) as Row | undefined;
  if (!inv) fail(404, "This invite may have expired or the server is gone.");
  return joinChecked(inv!.server_id, uid, inv!.code);
});

function joinChecked(serverId: string, uid: string, code?: string) {
  if (db().prepare("SELECT 1 FROM bans WHERE server_id = ? AND user_id = ?").get(serverId, uid)) fail(403, "You’re banned from this server.");
  const count = (db().prepare("SELECT COUNT(*) AS n FROM members WHERE user_id = ?").get(uid) as Row).n;
  if (!isMember(serverId, uid) && count >= 200) fail(400, "You’re in 200 servers already. Leave one first.");
  const joined = joinServer(serverId, uid);
  if (joined && code) db().prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?").run(code);
  const st = serverState(serverId, uid)!;
  return { ...st, firstChannelId: st.channels.find((c) => c.type === "text")?.id ?? null };
}

// discovery
r.get("discover", (ctx) => {
  const uid = ctx.uid();
  const q = (ctx.url.searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = ctx.url.searchParams.get("sort") ?? "popular";
  const rows = db()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM members m WHERE m.server_id = s.id) AS mc FROM servers s
       WHERE s.is_public = 1 AND (? = '' OR lower(s.name) LIKE ? OR lower(s.description) LIKE ?) LIMIT 200`,
    )
    .all(q, `%${q}%`, `%${q}%`) as Row[];
  const list: DiscoverServer[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    description: s.description,
    bannerColor: s.banner_color,
    memberCount: s.mc,
    onlineCount: onlineCount(s.id),
    createdAt: s.created_at,
    joined: isMember(s.id, uid),
  }));
  if (sort === "new") list.sort((a, b) => b.createdAt - a.createdAt);
  else if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.onlineCount - a.onlineCount || b.memberCount - a.memberCount);
  return list;
});

r.post("discover/:id/join", (ctx) => {
  const uid = ctx.uid();
  const s = serverRow(ctx.params.id);
  if (!s || !s.is_public) fail(404, "This server is invite only. Ask a member for an invite link.");
  return joinChecked(s!.id, uid);
});

// ---------------- messages ----------------

const PAGE = 50;

r.get("channels/:id/messages", (ctx) => {
  const uid = ctx.uid();
  const { row } = channelAccess(ctx.params.id, uid);
  const before = ctx.url.searchParams.get("before");
  const after = ctx.url.searchParams.get("after");
  const around = ctx.url.searchParams.get("around");
  let rows: Row[];
  if (around) {
    const older = db().prepare("SELECT * FROM messages WHERE channel_id = ? AND id <= ? ORDER BY id DESC LIMIT ?").all(row.id, around, PAGE / 2) as Row[];
    const newer = db().prepare("SELECT * FROM messages WHERE channel_id = ? AND id > ? ORDER BY id ASC LIMIT ?").all(row.id, around, PAGE / 2) as Row[];
    rows = [...older.reverse(), ...newer];
    const hasMoreBefore = older.length === PAGE / 2;
    const hasMoreAfter = newer.length === PAGE / 2;
    return { messages: hydrateMessages(rows, uid), users: authorsOf(rows), hasMoreBefore, hasMoreAfter };
  }
  if (after) {
    rows = db().prepare("SELECT * FROM messages WHERE channel_id = ? AND id > ? ORDER BY id ASC LIMIT ?").all(row.id, after, PAGE) as Row[];
    return { messages: hydrateMessages(rows, uid), users: authorsOf(rows), hasMoreBefore: true, hasMoreAfter: rows.length === PAGE };
  }
  rows = (
    before
      ? db().prepare("SELECT * FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?").all(row.id, before, PAGE)
      : db().prepare("SELECT * FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT ?").all(row.id, PAGE)
  ) as Row[];
  rows.reverse();
  return { messages: hydrateMessages(rows, uid), users: authorsOf(rows), hasMoreBefore: rows.length === PAGE, hasMoreAfter: false };
});

function authorsOf(rows: Row[]) {
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.author_id) ids.add(r.author_id);
    for (const m of String(r.content).matchAll(/<@([a-z0-9]{16})>/g)) ids.add(m[1]);
  }
  return publicUsers(ids);
}

r.post("channels/:id/messages", async (ctx) => {
  const uid = ctx.uid();
  rateLimit(`msg:${uid}`, 10, 5_000);
  const { row, perms } = channelAccess(ctx.params.id, uid);
  if (row.type === "voice") fail(400, "This is a voice channel.");
  if (!hasPerm(perms, Perm.SEND_MESSAGES)) fail(403, "You can’t send messages here.");
  if (row.type === "dm") {
    const other = dmRecipientIds(row.id).find((x) => x !== uid);
    if (other && isBlockedEitherWay(uid, other)) fail(403, "You can’t message this person.");
  }
  let content = "";
  let replyTo: string | null = null;
  let nonce: string | undefined;
  const files: File[] = [];
  const ctype = ctx.req.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const fd = await ctx.req.formData();
    content = String(fd.get("content") ?? "");
    replyTo = (fd.get("replyTo") as string) || null;
    nonce = (fd.get("nonce") as string) || undefined;
    for (const f of fd.getAll("files")) if (f instanceof File) files.push(f);
  } else {
    const b = await ctx.json<Record<string, unknown>>();
    content = typeof b.content === "string" ? b.content : "";
    replyTo = typeof b.replyTo === "string" ? b.replyTo : null;
    nonce = typeof b.nonce === "string" ? b.nonce : undefined;
  }
  content = content.replace(/\r\n/g, "\n").trim();
  if (content.length > LIMITS.messageLength) fail(400, `Messages can be at most ${LIMITS.messageLength} characters.`);
  if (!content && !files.length) fail(400, "Type something first.");
  if (files.length > LIMITS.attachmentsPerMessage) fail(400, `Up to ${LIMITS.attachmentsPerMessage} files per message.`);
  if (files.length && !hasPerm(perms, Perm.ATTACH_FILES)) fail(403, "You can’t upload files here.");
  if (replyTo) {
    const rep = messageRow(replyTo);
    if (!rep || rep.channel_id !== row.id) replyTo = null;
  }
  const saved: Awaited<ReturnType<typeof saveUpload>>[] = [];
  for (const f of files) saved.push(await saveUpload(f, { maxBytes: LIMITS.attachmentBytes }));

  // mentions
  const audience = channelAudience(row);
  const mentioned = new Set<string>();
  for (const m of content.matchAll(/<@([a-z0-9]{16})>/g)) if (audience.includes(m[1]) && m[1] !== uid) mentioned.add(m[1]);
  if (replyTo) {
    const rep = messageRow(replyTo);
    if (rep?.author_id && rep.author_id !== uid && audience.includes(rep.author_id)) mentioned.add(rep.author_id);
  }
  const everyone = /(^|\s)@(everyone|here)\b/.test(content) && hasPerm(perms, Perm.MENTION_EVERYONE);

  const id = newId();
  const ts = now();
  db().transaction(() => {
    db().prepare(
      "INSERT INTO messages (id, channel_id, author_id, content, reply_to, mention_everyone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, row.id, uid, content, replyTo, everyone ? 1 : 0, ts);
    for (const s of saved)
      db().prepare("INSERT INTO attachments (id, message_id, filename, url, mime, size) VALUES (?, ?, ?, ?, ?, ?)").run(newId(), id, s.filename, s.url, s.mime, s.size);
    for (const m of mentioned) db().prepare("INSERT INTO mentions (message_id, user_id) VALUES (?, ?)").run(id, m);
    db().prepare("UPDATE channels SET last_message_id = ? WHERE id = ?").run(id, row.id);
    db().prepare("INSERT OR REPLACE INTO read_states (user_id, channel_id, last_read_id) VALUES (?, ?, ?)").run(uid, row.id, id);
  })();

  if (row.type === "dm" || row.type === "group") {
    const hidden = (db().prepare("SELECT user_id FROM dm_members WHERE channel_id = ? AND hidden = 1").all(row.id) as Row[]).map((x) => x.user_id);
    if (hidden.length) {
      db().prepare("UPDATE dm_members SET hidden = 0 WHERE channel_id = ?").run(row.id);
      announceDm(row.id, hidden);
    }
  }
  const [msg] = hydrateMessages([messageRow(id)!], uid);
  msg.nonce = nonce;
  emitToUsers(audience, "message:create", { message: msg });
  return { message: msg };
});

r.post("channels/:id/polls", async (ctx) => {
  const uid = ctx.uid();
  rateLimit(`msg:${uid}`, 10, 5_000);
  const { row, perms } = channelAccess(ctx.params.id, uid);
  if (row.type === "voice") fail(400, "This is a voice channel.");
  if (!hasPerm(perms, Perm.SEND_MESSAGES)) fail(403, "You can’t send messages here.");
  const b = await ctx.json<Record<string, unknown>>();
  const question = str(b.question, "Question", { min: 1, max: 300 });
  const options = Array.isArray(b.options) ? b.options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean) : [];
  if (options.length < 2) fail(400, "Add at least two answers.");
  if (options.length > 10) fail(400, "Polls can have up to 10 answers.");
  if (options.some((o) => o.length > 80)) fail(400, "Answers can be at most 80 characters.");
  const id = newId();
  db().transaction(() => {
    db().prepare("INSERT INTO messages (id, channel_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)").run(id, row.id, uid, "", now());
    db().prepare("INSERT INTO polls (message_id, question, options, multi) VALUES (?, ?, ?, ?)").run(id, question, JSON.stringify(options), b.multi ? 1 : 0);
    db().prepare("UPDATE channels SET last_message_id = ? WHERE id = ?").run(id, row.id);
    db().prepare("INSERT OR REPLACE INTO read_states (user_id, channel_id, last_read_id) VALUES (?, ?, ?)").run(uid, row.id, id);
  })();
  const [msg] = hydrateMessages([messageRow(id)!], uid);
  emitToUsers(channelAudience(row), "message:create", { message: msg });
  return { message: msg };
});

r.put("messages/:id/poll", async (ctx) => {
  const uid = ctx.uid();
  const m = messageRow(ctx.params.id);
  if (!m) fail(404, "Poll not found");
  channelAccess(m!.channel_id, uid);
  const poll = db().prepare("SELECT * FROM polls WHERE message_id = ?").get(m!.id) as Row | undefined;
  if (!poll) fail(404, "Poll not found");
  const b = await ctx.json<Record<string, unknown>>();
  const count = (JSON.parse(poll!.options) as string[]).length;
  let picks = Array.isArray(b.options) ? [...new Set(b.options.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < count))] : [];
  if (!poll!.multi) picks = picks.slice(0, 1);
  db().transaction(() => {
    db().prepare("DELETE FROM poll_votes WHERE message_id = ? AND user_id = ?").run(m!.id, uid);
    for (const i of picks) db().prepare("INSERT INTO poll_votes (message_id, user_id, option_index) VALUES (?, ?, ?)").run(m!.id, uid, i);
  })();
  broadcastMessage(m!.id, "message:update");
  return { ok: true };
});

r.patch("messages/:id", async (ctx) => {
  const uid = ctx.uid();
  const m = messageRow(ctx.params.id);
  if (!m) fail(404, "Message not found");
  channelAccess(m!.channel_id, uid);
  if (m!.author_id !== uid || m!.type !== "default") fail(403, "You can only edit your own messages.");
  if (db().prepare("SELECT 1 FROM polls WHERE message_id = ?").get(m!.id)) fail(400, "Polls can’t be edited.");
  const b = await ctx.json<Record<string, unknown>>();
  const content = str(b.content, "Message", { min: 0, max: LIMITS.messageLength });
  const hasAtt = db().prepare("SELECT 1 FROM attachments WHERE message_id = ?").get(m!.id);
  if (!content && !hasAtt) fail(400, "Messages can’t be empty. Delete it instead.");
  const row = channelRow(m!.channel_id)!;
  const audience = channelAudience(row);
  db().transaction(() => {
    db().prepare("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?").run(content, now(), m!.id);
    db().prepare("DELETE FROM mentions WHERE message_id = ?").run(m!.id);
    for (const x of new Set([...content.matchAll(/<@([a-z0-9]{16})>/g)].map((y) => y[1])))
      if (audience.includes(x) && x !== uid) db().prepare("INSERT INTO mentions (message_id, user_id) VALUES (?, ?)").run(m!.id, x);
  })();
  broadcastMessage(m!.id, "message:update");
  return { ok: true };
});

r.delete("messages/:id", (ctx) => {
  const uid = ctx.uid();
  const m = messageRow(ctx.params.id);
  if (!m) fail(404, "Message not found");
  const { row, perms } = channelAccess(m!.channel_id, uid);
  if (m!.author_id !== uid && !hasPerm(perms, Perm.MANAGE_MESSAGES)) fail(403, "You can’t delete that message.");
  const audience = channelAudience(row);
  db().prepare("DELETE FROM messages WHERE id = ?").run(m!.id);
  if (row.last_message_id === m!.id) {
    const prev = db().prepare("SELECT id FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT 1").get(row.id) as Row | undefined;
    db().prepare("UPDATE channels SET last_message_id = ? WHERE id = ?").run(prev?.id ?? null, row.id);
  }
  emitToUsers(audience, "message:delete", { id: m!.id, channelId: row.id });
  return { ok: true };
});

const EMOJI_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️⃣]{1,16}$/u;

function setReaction(ctx: Ctx, add: boolean) {
  const uid = ctx.uid();
  const m = messageRow(ctx.params.id);
  if (!m) fail(404, "Message not found");
  const { row, perms } = channelAccess(m!.channel_id, uid);
  const emoji = ctx.params.emoji;
  if (!EMOJI_RE.test(emoji)) fail(400, "That’s not an emoji.");
  if (add) {
    if (!hasPerm(perms, Perm.ADD_REACTIONS)) fail(403, "You can’t react here.");
    const distinct = (db().prepare("SELECT COUNT(DISTINCT emoji) AS n FROM reactions WHERE message_id = ?").get(m!.id) as Row).n;
    const exists = db().prepare("SELECT 1 FROM reactions WHERE message_id = ? AND emoji = ?").get(m!.id, emoji);
    if (!exists && distinct >= 20) fail(400, "That message has enough reactions.");
    db().prepare("INSERT OR IGNORE INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)").run(m!.id, uid, emoji, now());
  } else {
    db().prepare("DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?").run(m!.id, uid, emoji);
  }
  const groups = reactionGroups([m!.id], "").get(m!.id) ?? [];
  emitToUsers(channelAudience(row), "reaction:update", { messageId: m!.id, channelId: row.id, reactions: groups });
  return { ok: true };
}

r.put("messages/:id/reactions/:emoji", (ctx) => setReaction(ctx, true));
r.delete("messages/:id/reactions/:emoji", (ctx) => setReaction(ctx, false));

r.post("messages/:id/pin", async (ctx) => {
  const uid = ctx.uid();
  const m = messageRow(ctx.params.id);
  if (!m) fail(404, "Message not found");
  const { row, perms } = channelAccess(m!.channel_id, uid);
  if (row.server_id && !hasPerm(perms, Perm.MANAGE_MESSAGES)) fail(403, "You can’t pin messages here.");
  const b = await ctx.json<Record<string, unknown>>();
  const pinned = b.pinned ? 1 : 0;
  if (pinned && (db().prepare("SELECT COUNT(*) AS n FROM messages WHERE channel_id = ? AND pinned = 1").get(row.id) as Row).n >= 50)
    fail(400, "This channel has 50 pins already. Unpin one first.");
  db().prepare("UPDATE messages SET pinned = ? WHERE id = ?").run(pinned, m!.id);
  broadcastMessage(m!.id, "message:update");
  if (pinned) systemMessage(row.id, uid, "pin", m!.id);
  return { ok: true };
});

r.get("channels/:id/pins", (ctx) => {
  const uid = ctx.uid();
  const { row } = channelAccess(ctx.params.id, uid);
  const rows = db().prepare("SELECT * FROM messages WHERE channel_id = ? AND pinned = 1 ORDER BY id DESC").all(row.id) as Row[];
  return { messages: hydrateMessages(rows, uid), users: authorsOf(rows) };
});

r.post("channels/:id/read", async (ctx) => {
  const uid = ctx.uid();
  const { row } = channelAccess(ctx.params.id, uid);
  const b = await ctx.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const id = typeof b.messageId === "string" ? b.messageId : row.last_message_id;
  if (!id) return { ok: true };
  db()
    .prepare(
      `INSERT INTO read_states (user_id, channel_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT(user_id, channel_id) DO UPDATE SET last_read_id = excluded.last_read_id WHERE excluded.last_read_id > read_states.last_read_id`,
    )
    .run(uid, row.id, id);
  emitToUsers([uid], "read:update", { channelId: row.id, lastReadId: id });
  return { ok: true };
});

r.post("servers/:id/read", (ctx) => {
  const uid = ctx.uid();
  if (!isMember(ctx.params.id, uid)) fail(404, "Server not found");
  const chans = db().prepare("SELECT * FROM channels WHERE server_id = ? AND last_message_id IS NOT NULL").all(ctx.params.id) as Row[];
  for (const c of chans) {
    if (!canSeeChannel(c, uid)) continue;
    db().prepare("INSERT OR REPLACE INTO read_states (user_id, channel_id, last_read_id) VALUES (?, ?, ?)").run(uid, c.id, c.last_message_id);
    emitToUsers([uid], "read:update", { channelId: c.id, lastReadId: c.last_message_id });
  }
  return { ok: true };
});

r.get("mentions", (ctx) => {
  const uid = ctx.uid();
  const rows = db()
    .prepare(
      `SELECT m.* FROM messages m JOIN mentions x ON x.message_id = m.id WHERE x.user_id = ?
       UNION SELECT m.* FROM messages m JOIN channels c ON c.id = m.channel_id JOIN members mb ON mb.server_id = c.server_id AND mb.user_id = ?
       WHERE m.mention_everyone = 1 AND m.author_id != ?
       ORDER BY id DESC LIMIT 50`,
    )
    .all(uid, uid, uid) as Row[];
  const visible = rows.filter((m) => canSeeChannel(channelRow(m.channel_id)!, uid));
  return { messages: hydrateMessages(visible, uid), users: authorsOf(visible) };
});

r.get("search", (ctx) => {
  const uid = ctx.uid();
  const q = (ctx.url.searchParams.get("q") ?? "").trim();
  const serverId = ctx.url.searchParams.get("serverId");
  const channelId = ctx.url.searchParams.get("channelId");
  let from: string | null = null;
  let text = q;
  const fm = q.match(/(?:^|\s)from:(\S+)/i);
  if (fm) {
    text = q.replace(fm[0], "").trim();
    const name = fm[1].replace(/^@/, "").toLowerCase();
    const u = db().prepare("SELECT id FROM users WHERE username = ? OR lower(display_name) = ?").get(name, name) as Row | undefined;
    from = u?.id ?? "__none__";
  }
  if (!text && !from) return { messages: [], users: [], total: 0 };
  let chans: Row[];
  if (channelId) chans = [channelAccess(channelId, uid).row];
  else if (serverId) {
    if (!isMember(serverId, uid)) fail(404, "Server not found");
    chans = (db().prepare("SELECT * FROM channels WHERE server_id = ? AND type = 'text'").all(serverId) as Row[]).filter((c) => canSeeChannel(c, uid));
  } else fail(400, "Pick where to search");
  if (!chans!.length) return { messages: [], users: [], total: 0 };
  const ph = chans!.map(() => "?").join(",");
  const like = `%${text.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = db()
    .prepare(
      `SELECT * FROM messages WHERE channel_id IN (${ph}) AND type = 'default' AND content LIKE ? ESCAPE '\\' ${from ? "AND author_id = ?" : ""} ORDER BY id DESC LIMIT 50`,
    )
    .all(...chans!.map((c) => c.id), like, ...(from ? [from] : [])) as Row[];
  return { messages: hydrateMessages(rows, uid), users: authorsOf(rows), total: rows.length };
});

// ---------------- uploads ----------------

r.post("upload", async (ctx) => {
  const uid = ctx.uid();
  rateLimit(`up:${uid}`, 20, 60_000);
  const fd = await ctx.req.formData().catch(() => fail(400, "Bad upload"));
  const f = (fd as FormData).get("file");
  if (!(f instanceof File)) fail(400, "Pick a file");
  const saved = await saveUpload(f as File, { maxBytes: LIMITS.avatarBytes, imageOnly: true });
  return { url: saved.url };
});

r.get("files/:name", (ctx) => serveUpload(ctx.params.name));

// ---------------- voice (http helpers) ----------------

r.get("voice", (ctx) => {
  ctx.uid();
  return { states: [...hub().voice.values()] };
});

export const api = r;
