"use client";

import { create } from "zustand";
import type {
  Bootstrap,
  Category,
  Channel,
  Me,
  Member,
  Message,
  PublicUser,
  ReactionGroup,
  Relationship,
  Role,
  Server,
  VoiceState,
} from "../types";

export interface ChannelMessages {
  list: Message[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

export type Panel = "pins" | "search" | "mentions" | null;

export interface ProfileTarget {
  userId: string;
  serverId: string | null;
  x: number;
  y: number;
}

export interface CtxItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  hint?: string;
  sep?: boolean;
  quick?: string[];
  onQuick?: (emoji: string) => void;
}

export interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  text: string;
}

export type ModalState =
  | { kind: "create-server" }
  | { kind: "create-channel"; serverId: string; categoryId: string | null; type?: "text" | "voice" }
  | { kind: "create-category"; serverId: string }
  | { kind: "invite"; serverId: string; channelId?: string }
  | { kind: "create-group"; channelId?: string }
  | { kind: "edit-channel"; channelId: string }
  | { kind: "edit-category"; categoryId: string }
  | { kind: "confirm"; title: string; body: string; confirm: string; danger?: boolean; onConfirm: () => Promise<void> | void }
  | { kind: "nickname"; serverId: string; userId: string }
  | { kind: "ban"; serverId: string; userId: string }
  | { kind: "shortcuts" }
  | { kind: "custom-status" }
  | { kind: "group-details"; channelId: string };

export interface Prefs {
  theme: "dark" | "light";
  accent: string;
  sounds: boolean;
  desktopNotifs: boolean;
  compact: boolean;
  fontScale: number;
  collapsed: Record<string, boolean>;
  micId: string;
  lastChannel: Record<string, string>;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  accent: "violet",
  sounds: true,
  desktopNotifs: false,
  compact: false,
  fontScale: 1,
  collapsed: {},
  micId: "",
  lastChannel: {},
};

export interface VoiceLocal {
  channelId: string | null;
  status: "idle" | "connecting" | "connected";
  muted: boolean;
  deafened: boolean;
  streaming: boolean;
  remote: Record<string, { audio: MediaStream | null; video: MediaStream | null }>;
  localScreen: MediaStream | null;
  speaking: Record<string, boolean>;
  focused: string | null;
}

export interface State {
  ready: boolean;
  bootError: string | null;
  connected: boolean;
  me: Me | null;
  users: Record<string, PublicUser>;
  servers: Record<string, Server>;
  serverOrder: string[];
  channels: Record<string, Channel>;
  categories: Record<string, Category>;
  roles: Record<string, Role>;
  myRoles: Record<string, string[]>;
  members: Record<string, Record<string, Member>>;
  membersLoaded: Record<string, boolean>;
  relationships: Record<string, Relationship>;
  messages: Record<string, ChannelMessages>;
  readStates: Record<string, string | null>;
  mentionCounts: Record<string, number>;
  typing: Record<string, Record<string, number>>;
  voiceStates: Record<string, VoiceState>;
  voice: VoiceLocal;
  ring: { channelId: string; from: string } | null;

  membersOpen: boolean;
  panel: Panel;
  searchQuery: string;
  settingsOpen: string | null;
  serverSettings: { serverId: string; tab: string } | null;
  modal: ModalState | null;
  profile: ProfileTarget | null;
  ctx: { x: number; y: number; items: CtxItem[] } | null;
  lightbox: { url: string; name: string; mime: string } | null;
  quickSwitcher: boolean;
  toasts: Toast[];
  replyTo: Record<string, Message | null>;
  editing: string | null;
  jumpTo: { channelId: string; messageId: string } | null;
  drafts: Record<string, string>;
  prefs: Prefs;
}

const initialVoice: VoiceLocal = {
  channelId: null,
  status: "idle",
  muted: false,
  deafened: false,
  streaming: false,
  remote: {},
  localScreen: null,
  speaking: {},
  focused: null,
};

export const useStore = create<State>(() => ({
  ready: false,
  bootError: null,
  connected: false,
  me: null,
  users: {},
  servers: {},
  serverOrder: [],
  channels: {},
  categories: {},
  roles: {},
  myRoles: {},
  members: {},
  membersLoaded: {},
  relationships: {},
  messages: {},
  readStates: {},
  mentionCounts: {},
  typing: {},
  voiceStates: {},
  voice: initialVoice,
  ring: null,
  membersOpen: true,
  panel: null,
  searchQuery: "",
  settingsOpen: null,
  serverSettings: null,
  modal: null,
  profile: null,
  ctx: null,
  lightbox: null,
  quickSwitcher: false,
  toasts: [],
  replyTo: {},
  editing: null,
  jumpTo: null,
  drafts: {},
  prefs: DEFAULT_PREFS,
}));

export const get = useStore.getState;
export const set = useStore.setState;

// ---------------------------------------------------------------- helpers

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));

export function applyBootstrap(b: Bootstrap) {
  const users = byId(b.users);
  users[b.me.id] = b.me;
  const readStates: Record<string, string | null> = {};
  const mentionCounts: Record<string, number> = {};
  for (const u of b.unreads) {
    readStates[u.channelId] = u.lastReadId;
    mentionCounts[u.channelId] = u.mentionCount;
  }
  set({
    ready: true,
    bootError: null,
    me: b.me,
    users,
    servers: byId(b.servers),
    serverOrder: b.servers.map((s) => s.id),
    channels: byId(b.channels),
    categories: byId(b.categories),
    roles: byId(b.roles),
    myRoles: b.myRoles,
    relationships: Object.fromEntries(b.relationships.map((r) => [r.userId, r])),
    readStates,
    mentionCounts,
    voiceStates: Object.fromEntries(b.voice.map((v) => [v.userId, v])),
  });
}

export function upsertUsers(list: PublicUser[]) {
  if (!list.length) return;
  set((s) => {
    const users = { ...s.users };
    for (const u of list) {
      if (u.id === s.me?.id) continue;
      users[u.id] = u;
    }
    return { users };
  });
}

export function applyServerState(st: {
  server: Server;
  channels: Channel[];
  categories: Category[];
  roles: Role[];
  myRoles: string[];
}) {
  set((s) => {
    const sid = st.server.id;
    const channels = Object.fromEntries(Object.entries(s.channels).filter(([, c]) => c.serverId !== sid));
    for (const c of st.channels) channels[c.id] = c;
    const categories = Object.fromEntries(Object.entries(s.categories).filter(([, c]) => c.serverId !== sid));
    for (const c of st.categories) categories[c.id] = c;
    const roles = Object.fromEntries(Object.entries(s.roles).filter(([, r]) => r.serverId !== sid));
    for (const r of st.roles) roles[r.id] = r;
    return {
      servers: { ...s.servers, [sid]: st.server },
      serverOrder: s.serverOrder.includes(sid) ? s.serverOrder : [...s.serverOrder, sid],
      channels,
      categories,
      roles,
      myRoles: { ...s.myRoles, [sid]: st.myRoles },
    };
  });
}

export function removeServer(id: string) {
  set((s) => {
    const servers = { ...s.servers };
    delete servers[id];
    return {
      servers,
      serverOrder: s.serverOrder.filter((x) => x !== id),
      channels: Object.fromEntries(Object.entries(s.channels).filter(([, c]) => c.serverId !== id)),
      categories: Object.fromEntries(Object.entries(s.categories).filter(([, c]) => c.serverId !== id)),
      roles: Object.fromEntries(Object.entries(s.roles).filter(([, r]) => r.serverId !== id)),
      serverSettings: s.serverSettings?.serverId === id ? null : s.serverSettings,
    };
  });
}

export function emptyMessages(): ChannelMessages {
  return { list: [], hasMoreBefore: true, hasMoreAfter: false, loading: false, loaded: false, error: null };
}

export function patchMessages(channelId: string, fn: (m: ChannelMessages) => ChannelMessages) {
  set((s) => ({ messages: { ...s.messages, [channelId]: fn(s.messages[channelId] ?? emptyMessages()) } }));
}

export function insertMessage(m: Message) {
  patchMessages(m.channelId, (cm) => {
    if (!cm.loaded || cm.hasMoreAfter) return cm; // viewing history; don't splice in
    const list = cm.list.slice();
    // replace optimistic copy
    if (m.nonce) {
      const i = list.findIndex((x) => x.nonce === m.nonce && x.id.startsWith("pending-"));
      if (i >= 0) {
        list[i] = m;
        return { ...cm, list };
      }
    }
    if (list.some((x) => x.id === m.id)) return cm;
    let i = list.length;
    while (i > 0 && list[i - 1].id > m.id && !list[i - 1].id.startsWith("pending-")) i--;
    list.splice(i, 0, m);
    return { ...cm, list };
  });
}

export function updateMessage(m: Message) {
  patchMessages(m.channelId, (cm) => ({ ...cm, list: cm.list.map((x) => (x.id === m.id ? { ...m, nonce: x.nonce } : x)) }));
}

export function deleteMessage(channelId: string, id: string) {
  patchMessages(channelId, (cm) => ({ ...cm, list: cm.list.filter((x) => x.id !== id) }));
}

export function setReactions(channelId: string, messageId: string, groups: ReactionGroup[]) {
  const me = get().me?.id;
  const withMe = groups.map((g) => ({ ...g, me: !!me && g.userIds.includes(me) }));
  patchMessages(channelId, (cm) => ({
    ...cm,
    list: cm.list.map((x) => (x.id === messageId ? { ...x, reactions: withMe } : x)),
  }));
}

let toastId = 0;
export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = ++toastId;
  set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, text }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "error" ? 5000 : 3200);
}

export function setVoice(patch: Partial<VoiceLocal>) {
  set((s) => ({ voice: { ...s.voice, ...patch } }));
}

export function resetVoice() {
  set((s) => ({ voice: { ...initialVoice, muted: s.voice.muted, deafened: s.voice.deafened } }));
}

// ---------------------------------------------------------------- prefs

const PREFS_KEY = "dabber-prefs";

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) set({ prefs: { ...DEFAULT_PREFS, ...JSON.parse(raw) } });
  } catch {
    /* storage unavailable */
  }
}

export function setPrefs(patch: Partial<Prefs>) {
  set((s) => ({ prefs: { ...s.prefs, ...patch } }));
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(get().prefs));
    if (patch.theme) localStorage.setItem("dabber-theme", patch.theme);
    if (patch.accent) localStorage.setItem("dabber-accent", patch.accent);
  } catch {
    /* storage unavailable */
  }
}
