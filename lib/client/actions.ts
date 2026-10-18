"use client";

import { api, errMsg } from "./api";
import {
  applyBootstrap,
  applyServerState,
  deleteMessage as removeLocal,
  emptyMessages,
  get,
  insertMessage,
  loadPrefs,
  patchMessages,
  set,
  toast,
  upsertUsers,
} from "./store";
import { connectSocket } from "./socket";
import { play } from "./sounds";
import type { Bootstrap, Channel, Member, Message, PublicUser } from "../types";

type ServerStateResp = Parameters<typeof applyServerState>[0] & { firstChannelId?: string | null };

let booting: Promise<void> | null = null;

export function boot(): Promise<void> {
  if (booting) return booting;
  loadPrefs();
  if (window.matchMedia("(max-width: 1000px)").matches) set({ membersOpen: false });
  booting = (async () => {
    try {
      const b = await api.get<Bootstrap>("bootstrap");
      applyBootstrap(b);
      connectSocket();
    } catch (e) {
      booting = null;
      const status = (e as { status?: number }).status;
      if (status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      set({ bootError: errMsg(e) });
    }
  })();
  return booting;
}

export async function resync() {
  try {
    const b = await api.get<Bootstrap>("bootstrap");
    applyBootstrap(b);
    // drop cached history so open channels refetch fresh
    set({ messages: {}, members: {}, membersLoaded: {} });
  } catch {
    /* next reconnect will retry */
  }
}

// ---------------------------------------------------------------- messages

interface Page {
  messages: Message[];
  users: PublicUser[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

function withMe(list: Message[]) {
  const me = get().me?.id;
  return list.map((m) => ({ ...m, reactions: m.reactions.map((r) => ({ ...r, me: !!me && r.userIds.includes(me) })) }));
}

export async function loadLatest(channelId: string, force = false) {
  const cur = get().messages[channelId];
  if (cur?.loading || (cur?.loaded && !force && !cur.hasMoreAfter)) return;
  patchMessages(channelId, (m) => ({ ...m, loading: true, error: null }));
  try {
    const r = await api.get<Page>(`channels/${channelId}/messages`);
    upsertUsers(r.users);
    patchMessages(channelId, () => ({
      ...emptyMessages(),
      list: withMe(r.messages),
      hasMoreBefore: r.hasMoreBefore,
      hasMoreAfter: false,
      loaded: true,
    }));
  } catch (e) {
    patchMessages(channelId, (m) => ({ ...m, loading: false, error: errMsg(e) }));
  }
}

export async function loadOlder(channelId: string) {
  const cur = get().messages[channelId];
  if (!cur || cur.loading || !cur.hasMoreBefore) return;
  const first = cur.list.find((m) => !m.id.startsWith("pending-"));
  if (!first) return;
  patchMessages(channelId, (m) => ({ ...m, loading: true }));
  try {
    const r = await api.get<Page>(`channels/${channelId}/messages?before=${first.id}`);
    upsertUsers(r.users);
    patchMessages(channelId, (m) => ({
      ...m,
      loading: false,
      hasMoreBefore: r.hasMoreBefore,
      list: [...withMe(r.messages), ...m.list.filter((x) => !r.messages.some((y) => y.id === x.id))],
    }));
  } catch (e) {
    patchMessages(channelId, (m) => ({ ...m, loading: false }));
    toast(errMsg(e), "error");
  }
}

export async function loadNewer(channelId: string) {
  const cur = get().messages[channelId];
  if (!cur || cur.loading || !cur.hasMoreAfter) return;
  const last = cur.list[cur.list.length - 1];
  if (!last) return;
  patchMessages(channelId, (m) => ({ ...m, loading: true }));
  try {
    const r = await api.get<Page>(`channels/${channelId}/messages?after=${last.id}`);
    upsertUsers(r.users);
    patchMessages(channelId, (m) => ({
      ...m,
      loading: false,
      hasMoreAfter: r.hasMoreAfter,
      list: [...m.list, ...withMe(r.messages).filter((x) => !m.list.some((y) => y.id === x.id))],
    }));
  } catch {
    patchMessages(channelId, (m) => ({ ...m, loading: false }));
  }
}

export async function loadAround(channelId: string, messageId: string) {
  patchMessages(channelId, (m) => ({ ...m, loading: true }));
  try {
    const r = await api.get<Page>(`channels/${channelId}/messages?around=${messageId}`);
    upsertUsers(r.users);
    patchMessages(channelId, () => ({
      ...emptyMessages(),
      list: withMe(r.messages),
      hasMoreBefore: r.hasMoreBefore,
      hasMoreAfter: r.hasMoreAfter,
      loaded: true,
    }));
  } catch (e) {
    patchMessages(channelId, (m) => ({ ...m, loading: false }));
    toast(errMsg(e), "error");
  }
}

let nonceSeq = 0;

export async function sendMessage(channelId: string, content: string, files: File[] = []) {
  const s = get();
  const me = s.me;
  if (!me) return;
  const reply = s.replyTo[channelId] ?? null;
  const nonce = `${Date.now()}-${++nonceSeq}`;
  const optimistic: Message = {
    id: `pending-${nonce}`,
    channelId,
    authorId: me.id,
    content,
    type: "default",
    replyTo: reply ? { id: reply.id, authorId: reply.authorId, content: reply.content, hasAttachments: reply.attachments.length > 0 } : null,
    mentions: [],
    mentionEveryone: false,
    pinned: false,
    editedAt: null,
    createdAt: Date.now(),
    attachments: files.map((f, i) => ({
      id: `pending-att-${i}`,
      filename: f.name,
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
      mime: f.type,
      size: f.size,
    })),
    reactions: [],
    nonce,
  };
  const cm = get().messages[channelId];
  if (cm?.hasMoreAfter) await loadLatest(channelId, true);
  insertMessage(optimistic);
  set((st) => ({ replyTo: { ...st.replyTo, [channelId]: null } }));
  try {
    let body: FormData | Record<string, unknown>;
    if (files.length) {
      const fd = new FormData();
      fd.append("content", content);
      fd.append("nonce", nonce);
      if (reply) fd.append("replyTo", reply.id);
      for (const f of files) fd.append("files", f);
      body = fd;
    } else body = { content, nonce, replyTo: reply?.id };
    const r = await api.post<{ message: Message }>(`channels/${channelId}/messages`, body);
    insertMessage({ ...r.message, nonce });
    set((st) => ({ readStates: { ...st.readStates, [channelId]: r.message.id } }));
    play("send");
  } catch (e) {
    patchMessages(channelId, (m) => ({
      ...m,
      list: m.list.map((x) => (x.nonce === nonce && x.id.startsWith("pending-") ? { ...x, id: `failed-${nonce}` } : x)),
    }));
    toast(errMsg(e), "error");
    play("error");
  }
}

export function discardFailed(channelId: string, id: string) {
  removeLocal(channelId, id);
}

export async function editMessage(id: string, content: string) {
  try {
    await api.patch(`messages/${id}`, { content });
  } catch (e) {
    toast(errMsg(e), "error");
    throw e;
  }
}

export async function deleteMessage(m: Message) {
  try {
    await api.del(`messages/${m.id}`);
    removeLocal(m.channelId, m.id);
  } catch (e) {
    toast(errMsg(e), "error");
  }
}

export async function toggleReaction(m: Message, emoji: string) {
  const mine = m.reactions.find((r) => r.emoji === emoji)?.me;
  try {
    if (mine) await api.del(`messages/${m.id}/reactions/${encodeURIComponent(emoji)}`);
    else await api.put(`messages/${m.id}/reactions/${encodeURIComponent(emoji)}`);
  } catch (e) {
    toast(errMsg(e), "error");
  }
}

export async function setPinned(m: Message, pinned: boolean) {
  try {
    await api.post(`messages/${m.id}/pin`, { pinned });
    toast(pinned ? "Pinned. Find it in the pin list up top." : "Unpinned.", "success");
  } catch (e) {
    toast(errMsg(e), "error");
  }
}

const readTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function markRead(channelId: string) {
  const s = get();
  const c = s.channels[channelId];
  if (!c?.lastMessageId) return;
  const last = s.readStates[channelId];
  if (last && last >= c.lastMessageId && !(s.mentionCounts[channelId] ?? 0)) return;
  set((st) => ({ readStates: { ...st.readStates, [channelId]: c.lastMessageId }, mentionCounts: { ...st.mentionCounts, [channelId]: 0 } }));
  clearTimeout(readTimers.get(channelId));
  readTimers.set(
    channelId,
    setTimeout(() => void api.post(`channels/${channelId}/read`, { messageId: c.lastMessageId }).catch(() => {}), 300),
  );
}

// ---------------------------------------------------------------- servers / members

export async function loadMembers(serverId: string, force = false) {
  if (get().membersLoaded[serverId] && !force) return;
  try {
    const r = await api.get<{ members: Member[]; users: PublicUser[] }>(`servers/${serverId}/members`);
    upsertUsers(r.users);
    set((s) => ({
      members: { ...s.members, [serverId]: Object.fromEntries(r.members.map((m) => [m.userId, m])) },
      membersLoaded: { ...s.membersLoaded, [serverId]: true },
    }));
  } catch {
    /* ignore: not a member anymore */
  }
}

export async function createServer(name: string, template: string, icon: string | null) {
  const r = await api.post<ServerStateResp>("servers", { name, template, icon });
  applyServerState(r);
  play("success");
  return r;
}

export async function joinInvite(code: string) {
  const r = await api.post<ServerStateResp>(`invites/${encodeURIComponent(code)}`);
  applyServerState(r);
  play("success");
  return r;
}

export async function joinPublic(serverId: string) {
  const r = await api.post<ServerStateResp>(`discover/${serverId}/join`);
  applyServerState(r);
  play("success");
  return r;
}

export async function openDm(userId: string): Promise<string | null> {
  try {
    const r = await api.post<{ channel: Channel; users: PublicUser[] }>("dms", { userId });
    upsertUsers(r.users);
    set((s) => ({ channels: { ...s.channels, [r.channel.id]: r.channel } }));
    return r.channel.id;
  } catch (e) {
    toast(errMsg(e), "error");
    return null;
  }
}

export async function setStatus(status: "online" | "idle" | "dnd" | "invisible") {
  try {
    await api.patch("users/me", { status });
  } catch (e) {
    toast(errMsg(e), "error");
  }
}

export async function logout() {
  try {
    await api.post("auth/logout");
  } finally {
    window.location.href = "/";
  }
}

export function copy(text: string, what = "Copied") {
  void navigator.clipboard
    ?.writeText(text)
    .then(() => toast(`${what}!`, "success"))
    .catch(() => toast("Couldn’t copy. Your browser blocked it.", "error"));
}
