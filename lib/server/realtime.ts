import type { Server as IOServer } from "socket.io";
import type { Status, VoiceState } from "../types";

// Shared in-process state. Lives on globalThis so the custom server (server.ts) and the
// route handlers bundled by Next see the same instances.
interface Hub {
  io: IOServer | null;
  sockets: Map<string, Set<string>>; // userId -> socket ids
  voice: Map<string, VoiceState>; // userId -> state (one voice connection per user)
  voiceSocket: Map<string, string>; // userId -> socket id that owns the voice connection
}

type G = typeof globalThis & { __dabberHub?: Hub };

export function hub(): Hub {
  const g = globalThis as G;
  if (!g.__dabberHub) {
    g.__dabberHub = { io: null, sockets: new Map(), voice: new Map(), voiceSocket: new Map() };
  }
  return g.__dabberHub;
}

export const room = {
  user: (id: string) => `user:${id}`,
  server: (id: string) => `server:${id}`,
};

export function emitToUsers(userIds: Iterable<string>, event: string, payload: unknown) {
  const io = hub().io;
  if (!io) return;
  const rooms = [...new Set(userIds)].map(room.user);
  if (rooms.length) io.to(rooms).emit(event, payload);
}

export function emitToServer(serverId: string, event: string, payload: unknown) {
  hub().io?.to(room.server(serverId)).emit(event, payload);
}

/** Make every socket of a user join/leave a server room (after join/leave/kick). */
export function setServerRoom(userId: string, serverId: string, join: boolean) {
  const io = hub().io;
  if (!io) return;
  const r = room.server(serverId);
  if (join) io.in(room.user(userId)).socketsJoin(r);
  else io.in(room.user(userId)).socketsLeave(r);
}

export function isOnline(userId: string): boolean {
  return (hub().sockets.get(userId)?.size ?? 0) > 0;
}

export function onlineUserIds(): string[] {
  return [...hub().sockets.entries()].filter(([, s]) => s.size > 0).map(([id]) => id);
}

export function effectiveStatus(userId: string, pref: string): Status {
  if (!isOnline(userId)) return "offline";
  if (pref === "invisible") return "offline";
  return pref as Status;
}

/** Drop someone from voice server-side (kicked, banned, channel deleted). */
export function forceLeaveVoice(userId: string, audience: string[], reason: string) {
  const h = hub();
  const st = h.voice.get(userId);
  if (!st) return;
  h.voice.delete(userId);
  const sid = h.voiceSocket.get(userId);
  h.voiceSocket.delete(userId);
  if (sid) {
    h.io?.sockets.sockets.get(sid)?.leave(`voice:${st.channelId}`);
    h.io?.to(sid).emit("voice:kicked", { reason });
  }
  emitToUsers(audience, "voice:leave", { userId, channelId: st.channelId, reason: "removed" });
}

export function voiceStates(): VoiceState[] {
  return [...hub().voice.values()];
}
