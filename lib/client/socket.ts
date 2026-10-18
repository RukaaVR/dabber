"use client";

import { io, type Socket } from "socket.io-client";
import {
  applyServerState,
  deleteMessage,
  get,
  insertMessage,
  removeServer,
  set,
  setReactions,
  toast,
  updateMessage,
  upsertUsers,
} from "./store";
import { api } from "./api";
import { play, startRing, stopRing } from "./sounds";
import { channelLabel, displayName } from "./selectors";
import type { Channel, Category, Me, Member, Message, PublicUser, Relationship, Server, VoiceState, ReactionGroup } from "../types";
import { onVoiceLeave, onVoiceUpdate, onSignal, onKicked } from "./voice";

let socket: Socket | null = null;

export function getSocket() {
  return socket;
}

/** Channel the user is currently looking at (set by the chat view). */
let activeChannel: string | null = null;
export function setActiveChannel(id: string | null) {
  activeChannel = id;
}
export function getActiveChannel() {
  return activeChannel;
}

function focused() {
  return typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
}

export async function refreshServer(serverId: string) {
  try {
    const st = await api.get<Parameters<typeof applyServerState>[0]>(`servers/${serverId}`);
    applyServerState(st);
    if (get().membersLoaded[serverId]) {
      // keep member roles fresh
      const r = await api.get<{ members: Member[]; users: PublicUser[] }>(`servers/${serverId}/members`);
      upsertUsers(r.users);
      set((s) => ({ members: { ...s.members, [serverId]: Object.fromEntries(r.members.map((m) => [m.userId, m])) } }));
    }
  } catch {
    /* removed from server meanwhile */
  }
}

function notify(m: Message) {
  const s = get();
  const ch = s.channels[m.channelId];
  if (!ch || !s.me || m.authorId === s.me.id) return;
  const isDm = ch.type === "dm" || ch.type === "group";
  const mentionsMe = m.mentions.includes(s.me.id) || m.mentionEveryone;
  const viewing = activeChannel === m.channelId && focused();
  if (viewing) return;
  if (s.me.statusPref === "dnd") return;
  if (ch.serverId && s.prefs.mutedServers[ch.serverId] && !mentionsMe) return;
  if (isDm || mentionsMe) play("mention");
  else if (activeChannel === m.channelId) play("receive");
  if ((isDm || mentionsMe) && s.prefs.desktopNotifs && typeof Notification !== "undefined" && Notification.permission === "granted" && !focused()) {
    const who = displayName(s, m.authorId, ch.serverId);
    const where = isDm ? "" : ` (#${channelLabel(s, ch)})`;
    const body = m.content.replace(/<@([a-z0-9]{16})>/g, (_, id) => `@${displayName(s, id, ch.serverId)}`) || (m.poll ? `📊 ${m.poll.question}` : "Sent an attachment");
    try {
      const n = new Notification(`${who}${where}`, { body: body.slice(0, 180), icon: "/icons/icon-192.png", tag: m.channelId });
      n.onclick = () => {
        window.focus();
        const href = ch.serverId ? `/app/s/${ch.serverId}/${ch.id}` : `/app/dm/${ch.id}`;
        window.history.pushState(null, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      };
    } catch {
      /* notifications unsupported */
    }
  }
}

export function connectSocket() {
  if (socket) return socket;
  socket = io({ path: "/socket.io", transports: ["websocket", "polling"], withCredentials: true });

  socket.on("connect", () => {
    const wasDisconnected = !get().connected && get().ready;
    set({ connected: true });
    if (wasDisconnected) window.dispatchEvent(new Event("dabber:resync"));
  });
  socket.on("disconnect", () => set({ connected: false }));
  socket.on("connect_error", (e) => {
    if (e.message === "unauthorized") window.location.href = "/login";
  });

  socket.on("message:create", ({ message: m }: { message: Message }) => {
    const s = get();
    const me = s.me?.id;
    if (m.authorId) {
      if (!s.users[m.authorId]) void fetchUser(m.authorId);
    }
    insertMessage({ ...m, reactions: m.reactions.map((r) => ({ ...r, me: !!me && r.userIds.includes(me) })) });
    set((st) => {
      const ch = st.channels[m.channelId];
      const channels = ch ? { ...st.channels, [m.channelId]: { ...ch, lastMessageId: m.id } } : st.channels;
      const typing = { ...st.typing };
      if (m.authorId && typing[m.channelId]) {
        const t = { ...typing[m.channelId] };
        delete t[m.authorId];
        typing[m.channelId] = t;
      }
      const mine = m.authorId === me;
      const viewing = activeChannel === m.channelId && focused();
      const readStates = mine || viewing ? { ...st.readStates, [m.channelId]: m.id } : st.readStates;
      let mentionCounts = st.mentionCounts;
      if (!mine && !viewing && ch && m.type === "default") {
        const isDm = ch.type === "dm" || ch.type === "group";
        if (isDm || (me && m.mentions.includes(me)) || m.mentionEveryone)
          mentionCounts = { ...st.mentionCounts, [m.channelId]: (st.mentionCounts[m.channelId] ?? 0) + 1 };
      }
      return { channels, typing, readStates, mentionCounts };
    });
    if (activeChannel === m.channelId && focused() && m.authorId !== me) {
      void api.post(`channels/${m.channelId}/read`, { messageId: m.id }).catch(() => {});
    }
    if (m.type === "default") notify(m);
  });
  socket.on("message:update", ({ message }: { message: Message }) => {
    const me = get().me?.id;
    updateMessage({ ...message, reactions: message.reactions.map((r) => ({ ...r, me: !!me && r.userIds.includes(me) })) });
  });
  socket.on("message:delete", ({ id, channelId }: { id: string; channelId: string }) => deleteMessage(channelId, id));
  socket.on("reaction:update", (p: { messageId: string; channelId: string; reactions: ReactionGroup[] }) =>
    setReactions(p.channelId, p.messageId, p.reactions),
  );

  socket.on("typing", ({ channelId, userId }: { channelId: string; userId: string }) => {
    set((s) => ({ typing: { ...s.typing, [channelId]: { ...s.typing[channelId], [userId]: Date.now() + 8000 } } }));
  });

  socket.on("read:update", ({ channelId, lastReadId }: { channelId: string; lastReadId: string }) => {
    set((s) => {
      const prev = s.readStates[channelId];
      if (prev && prev >= lastReadId) return {};
      return { readStates: { ...s.readStates, [channelId]: lastReadId }, mentionCounts: { ...s.mentionCounts, [channelId]: 0 } };
    });
  });

  socket.on("user:update", ({ user }: { user: PublicUser }) => upsertUsers([user]));
  socket.on("me:update", ({ me }: { me: Me }) => set((s) => ({ me, users: { ...s.users, [me.id]: me } })));
  socket.on("user:remove", ({ userId }: { userId: string }) =>
    set((s) => {
      const u = s.users[userId];
      if (!u) return {};
      return { users: { ...s.users, [userId]: { ...u, displayName: "Deleted user", avatar: null, status: "offline" } } };
    }),
  );

  socket.on("relationship:update", (p: { userId: string; relationship: Relationship | null; user: PublicUser | null }) => {
    if (p.user) upsertUsers([p.user]);
    const prev = get().relationships[p.userId];
    set((s) => {
      const relationships = { ...s.relationships };
      if (p.relationship) relationships[p.userId] = p.relationship;
      else delete relationships[p.userId];
      return { relationships };
    });
    if (p.relationship?.type === "incoming" && prev?.type !== "incoming") play("receive");
  });

  socket.on("dm:create", ({ channel, users }: { channel: Channel; users: PublicUser[] }) => {
    upsertUsers(users);
    set((s) => ({ channels: { ...s.channels, [channel.id]: { ...s.channels[channel.id], ...channel } } }));
  });
  socket.on("dm:hide", ({ channelId }: { channelId: string }) => {
    set((s) => {
      const channels = { ...s.channels };
      delete channels[channelId];
      return { channels };
    });
    window.dispatchEvent(new CustomEvent("dabber:channel-gone", { detail: channelId }));
  });

  socket.on("server:refresh", ({ serverId }: { serverId: string }) => void refreshServer(serverId));
  socket.on("server:update", ({ server }: { server: Partial<Server> & { id: string } }) =>
    set((s) => (s.servers[server.id] ? { servers: { ...s.servers, [server.id]: { ...s.servers[server.id], ...server } } } : {})),
  );
  socket.on("server:delete", ({ id, name, reason }: { id: string; name?: string; reason?: string }) => {
    if (!get().servers[id]) return;
    removeServer(id);
    if (reason === "kicked") toast(`You were kicked from ${name}.`, "error");
    if (reason === "banned") toast(`You were banned from ${name}.`, "error");
    if (reason === "deleted") toast(`${name} was deleted by its owner.`);
    window.dispatchEvent(new CustomEvent("dabber:server-gone", { detail: id }));
  });
  socket.on("channel:upsert", ({ channel }: { channel: Channel }) =>
    set((s) => ({ channels: { ...s.channels, [channel.id]: channel } })),
  );
  socket.on("channel:delete", ({ id }: { id: string }) => {
    set((s) => {
      const channels = { ...s.channels };
      delete channels[id];
      return { channels };
    });
    window.dispatchEvent(new CustomEvent("dabber:channel-gone", { detail: id }));
  });
  socket.on("category:upsert", ({ category }: { category: Category }) =>
    set((s) => ({ categories: { ...s.categories, [category.id]: category } })),
  );
  socket.on("member:add", ({ member, user }: { member: Member; user: PublicUser }) => {
    upsertUsers([user]);
    set((s) => {
      const servers = s.servers[member.serverId]
        ? { ...s.servers, [member.serverId]: { ...s.servers[member.serverId], memberCount: s.servers[member.serverId].memberCount + 1 } }
        : s.servers;
      if (!s.membersLoaded[member.serverId]) return { servers };
      return { servers, members: { ...s.members, [member.serverId]: { ...s.members[member.serverId], [member.userId]: member } } };
    });
  });
  socket.on("member:update", ({ member }: { member: Member }) =>
    set((s) =>
      s.membersLoaded[member.serverId]
        ? { members: { ...s.members, [member.serverId]: { ...s.members[member.serverId], [member.userId]: member } } }
        : {},
    ),
  );
  socket.on("member:remove", ({ serverId, userId }: { serverId: string; userId: string }) =>
    set((s) => {
      const servers = s.servers[serverId]
        ? { ...s.servers, [serverId]: { ...s.servers[serverId], memberCount: Math.max(0, s.servers[serverId].memberCount - 1) } }
        : s.servers;
      if (!s.members[serverId]) return { servers };
      const m = { ...s.members[serverId] };
      delete m[userId];
      return { servers, members: { ...s.members, [serverId]: m } };
    }),
  );

  socket.on("voice:update", ({ state }: { state: VoiceState }) => {
    if (!get().users[state.userId]) void fetchUser(state.userId);
    set((s) => ({ voiceStates: { ...s.voiceStates, [state.userId]: state } }));
    onVoiceUpdate(state);
  });
  socket.on("voice:leave", ({ userId, channelId }: { userId: string; channelId: string }) => {
    set((s) => {
      const v = { ...s.voiceStates };
      if (v[userId]?.channelId === channelId) delete v[userId];
      return { voiceStates: v };
    });
    onVoiceLeave(userId, channelId);
  });
  socket.on("voice:kicked", (p: { reason: string }) => onKicked(p.reason));
  socket.on("rtc:signal", (p: { from: string; data: unknown }) => void onSignal(p.from, p.data));

  socket.on("call:ring", ({ channelId, from }: { channelId: string; from: string }) => {
    if (get().voice.channelId === channelId) return;
    if (get().me?.statusPref === "dnd") return;
    set({ ring: { channelId, from } });
    startRing();
    setTimeout(() => {
      if (get().ring?.channelId === channelId) {
        set({ ring: null });
        stopRing();
      }
    }, 30000);
  });
  socket.on("call:end", ({ channelId }: { channelId: string }) => {
    if (get().ring?.channelId === channelId) {
      set({ ring: null });
      stopRing();
    }
  });
  socket.on("call:dismiss", ({ channelId }: { channelId: string }) => {
    if (get().ring?.channelId === channelId) {
      set({ ring: null });
      stopRing();
    }
  });

  return socket;
}

const inflight = new Set<string>();
export async function fetchUser(id: string) {
  if (inflight.has(id)) return;
  inflight.add(id);
  try {
    const r = await api.get<{ user: PublicUser }>(`users/${id}`);
    upsertUsers([r.user]);
  } catch {
    /* ignore */
  } finally {
    inflight.delete(id);
  }
}

export function emitTyping(channelId: string) {
  socket?.emit("typing", { channelId });
}

// Typing indicators expire on their own.
if (typeof window !== "undefined") {
  setInterval(() => {
    const t = get().typing;
    const now = Date.now();
    let changed = false;
    const next: typeof t = {};
    for (const [cid, users] of Object.entries(t)) {
      const keep = Object.fromEntries(Object.entries(users).filter(([, exp]) => exp > now));
      if (Object.keys(keep).length !== Object.keys(users).length) changed = true;
      next[cid] = keep;
    }
    if (changed) set({ typing: next });
  }, 1500);
}

