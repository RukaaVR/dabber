import type { Server as IOServer, Socket } from "socket.io";
import { getDb } from "./db";
import { userIdFromCookieHeader } from "./auth";
import { hub, room, emitToUsers } from "./realtime";
import { broadcastUser, systemMessage } from "./actions";
import { channelAccess, channelAudience, channelRow } from "./repo";
import { Perm, hasPerm, type VoiceState } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const offlineTimers = new Map<string, NodeJS.Timeout>();

function voiceAudience(channelId: string): string[] {
  const row = channelRow(channelId);
  return row ? channelAudience(row) : [];
}

function leaveVoice(userId: string, io: IOServer, reason: "left" | "moved" | "disconnect" = "left") {
  const h = hub();
  const st = h.voice.get(userId);
  if (!st) return;
  h.voice.delete(userId);
  const sid = h.voiceSocket.get(userId);
  h.voiceSocket.delete(userId);
  if (sid) io.sockets.sockets.get(sid)?.leave(`voice:${st.channelId}`);
  emitToUsers(voiceAudience(st.channelId), "voice:leave", { userId, channelId: st.channelId, reason });
  const row = channelRow(st.channelId);
  if (row && (row.type === "dm" || row.type === "group")) {
    const left = [...h.voice.values()].filter((v) => v.channelId === st.channelId);
    if (!left.length) emitToUsers(voiceAudience(st.channelId), "call:end", { channelId: st.channelId });
  }
}

export function attachSocket(io: IOServer) {
  const h = hub();
  h.io = io;

  io.use((socket, next) => {
    const uid = userIdFromCookieHeader(socket.handshake.headers.cookie);
    if (!uid) return next(new Error("unauthorized"));
    socket.data.userId = uid;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const uid: string = socket.data.userId;
    socket.join(room.user(uid));
    for (const r of getDb().prepare("SELECT server_id FROM members WHERE user_id = ?").all(uid) as Row[])
      socket.join(room.server(r.server_id));

    const set = h.sockets.get(uid) ?? new Set<string>();
    const wasOffline = set.size === 0;
    set.add(socket.id);
    h.sockets.set(uid, set);
    const pending = offlineTimers.get(uid);
    if (pending) {
      clearTimeout(pending);
      offlineTimers.delete(uid);
    }
    // Always announce the first socket: people who joined a shared server while we
    // were briefly offline (page change) would otherwise keep seeing us offline.
    if (wasOffline) broadcastUser(uid);

    socket.on("typing", (p: { channelId?: string }) => {
      if (typeof p?.channelId !== "string") return;
      try {
        const { row, perms } = channelAccess(p.channelId, uid);
        if (!hasPerm(perms, Perm.SEND_MESSAGES)) return;
        emitToUsers(
          channelAudience(row).filter((x) => x !== uid),
          "typing",
          { channelId: row.id, userId: uid },
        );
      } catch {
        /* no access */
      }
    });

    socket.on(
      "voice:join",
      (p: { channelId?: string; muted?: boolean; deafened?: boolean }, ack?: (r: unknown) => void) => {
        const reply = typeof ack === "function" ? ack : () => {};
        if (typeof p?.channelId !== "string") return reply({ error: "Bad channel" });
        let row: Row;
        try {
          const a = channelAccess(p.channelId, uid);
          row = a.row;
          if (!["voice", "dm", "group"].includes(row.type)) return reply({ error: "Not a voice channel" });
          if (!hasPerm(a.perms, Perm.CONNECT)) return reply({ error: "You can’t join this voice channel." });
        } catch {
          return reply({ error: "Channel not found" });
        }
        const prev = h.voice.get(uid);
        if (prev) {
          const oldSid = h.voiceSocket.get(uid);
          if (oldSid && oldSid !== socket.id) io.to(oldSid).emit("voice:kicked", { reason: "Joined voice somewhere else." });
          leaveVoice(uid, io, "moved");
        }
        const others = [...h.voice.values()].filter((v) => v.channelId === row.id);
        if (others.length >= 12) return reply({ error: "This voice channel is full (12 people)." });
        const st: VoiceState = {
          userId: uid,
          channelId: row.id,
          muted: !!p.muted,
          deafened: !!p.deafened,
          streaming: false,
          video: false,
        };
        h.voice.set(uid, st);
        h.voiceSocket.set(uid, socket.id);
        socket.join(`voice:${row.id}`);
        emitToUsers(voiceAudience(row.id), "voice:update", { state: st });
        if ((row.type === "dm" || row.type === "group") && others.length === 0) {
          const ringees = channelAudience(row).filter((x) => x !== uid);
          emitToUsers(ringees, "call:ring", { channelId: row.id, from: uid });
          systemMessage(row.id, uid, "call", "started a call.");
        }
        reply({ ok: true, peers: others.map((o) => o.userId) });
      },
    );

    socket.on("voice:state", (p: Partial<VoiceState>) => {
      const st = h.voice.get(uid);
      if (!st || h.voiceSocket.get(uid) !== socket.id) return;
      if (typeof p.muted === "boolean") st.muted = p.muted;
      if (typeof p.deafened === "boolean") st.deafened = p.deafened;
      if (typeof p.streaming === "boolean") st.streaming = p.streaming;
      if (typeof p.video === "boolean") st.video = p.video;
      emitToUsers(voiceAudience(st.channelId), "voice:update", { state: st });
    });

    socket.on("voice:leave", () => {
      if (h.voiceSocket.get(uid) === socket.id) leaveVoice(uid, io);
    });

    socket.on("call:decline", (p: { channelId?: string }) => {
      if (typeof p?.channelId === "string") emitToUsers([uid], "call:dismiss", { channelId: p.channelId });
    });

    socket.on("rtc:signal", (p: { to?: string; data?: unknown }) => {
      if (typeof p?.to !== "string") return;
      const me = h.voice.get(uid);
      const them = h.voice.get(p.to);
      if (!me || !them || me.channelId !== them.channelId) return;
      const target = h.voiceSocket.get(p.to);
      if (target) io.to(target).emit("rtc:signal", { from: uid, data: p.data });
    });

    socket.on("disconnect", () => {
      if (h.voiceSocket.get(uid) === socket.id) leaveVoice(uid, io, "disconnect");
      const s = h.sockets.get(uid);
      s?.delete(socket.id);
      if (!s || s.size === 0) {
        // grace period so a page reload doesn't flash offline
        offlineTimers.set(
          uid,
          setTimeout(() => {
            offlineTimers.delete(uid);
            if ((h.sockets.get(uid)?.size ?? 0) === 0) broadcastUser(uid);
          }, 4000),
        );
      }
    });
  });
}
