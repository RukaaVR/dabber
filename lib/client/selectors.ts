"use client";

import { get, useStore, type State } from "./store";
import { hasPerm, type Channel, type PublicUser, type Role } from "../types";

export function displayName(s: State, userId: string | null, serverId?: string | null): string {
  if (!userId) return "Deleted user";
  if (serverId) {
    const nick = s.members[serverId]?.[userId]?.nickname;
    if (nick) return nick;
  }
  const u = s.users[userId];
  return u?.displayName ?? "Unknown user";
}

export function useDisplayName(userId: string | null, serverId?: string | null) {
  return useStore((s) => displayName(s, userId, serverId));
}

export function sortedRoles(s: State, serverId: string): Role[] {
  return Object.values(s.roles)
    .filter((r) => r.serverId === serverId)
    .sort((a, b) => b.position - a.position);
}

export function memberRoleIds(s: State, serverId: string, userId: string): string[] {
  if (userId === s.me?.id) return s.myRoles[serverId] ?? [];
  return s.members[serverId]?.[userId]?.roleIds ?? [];
}

/** Top colored role → name color. */
export function roleColor(s: State, serverId: string | null | undefined, userId: string | null): string | undefined {
  if (!serverId || !userId) return undefined;
  const ids = memberRoleIds(s, serverId, userId);
  if (!ids.length) return undefined;
  let best: Role | undefined;
  for (const id of ids) {
    const r = s.roles[id];
    if (r && r.color && r.color !== "#99aab5" && (!best || r.position > best.position)) best = r;
  }
  return best?.color ?? undefined;
}

export function channelLabel(s: State, c: Channel | undefined): string {
  if (!c) return "";
  if (c.type === "dm") return displayName(s, c.recipients?.[0] ?? null);
  if (c.type === "group") {
    if (c.name) return c.name;
    const names = (c.recipients ?? []).map((id) => displayName(s, id));
    return names.length ? names.join(", ") : "Just you";
  }
  return c.name;
}

export function isUnread(s: State, channelId: string): boolean {
  const c = s.channels[channelId];
  if (!c?.lastMessageId) return false;
  const last = s.readStates[channelId];
  return !last || c.lastMessageId > last;
}

export function serverUnread(s: State, serverId: string): { unread: boolean; mentions: number } {
  let unread = false;
  let mentions = 0;
  for (const c of Object.values(s.channels)) {
    if (c.serverId !== serverId || c.type !== "text") continue;
    if (isUnread(s, c.id)) unread = true;
    mentions += s.mentionCounts[c.id] ?? 0;
  }
  return { unread, mentions };
}

export function dmChannels(s: State): Channel[] {
  return Object.values(s.channels)
    .filter((c) => c.type === "dm" || c.type === "group")
    .sort((a, b) => (b.lastMessageId ?? b.id).localeCompare(a.lastMessageId ?? a.id));
}

export function canDo(serverId: string | null | undefined, perm: number): boolean {
  if (!serverId) return false;
  const s = get();
  const p = s.servers[serverId]?.myPermissions ?? 0;
  return hasPerm(p, perm);
}

export function useCan(serverId: string | null | undefined, perm: number): boolean {
  return useStore((s) => (serverId ? hasPerm(s.servers[serverId]?.myPermissions ?? 0, perm) : false));
}

export function statusOf(u: PublicUser | undefined | null): string {
  return u?.status ?? "offline";
}

export function statusLabel(st: string): string {
  return (
    { online: "Online", idle: "Idle", dnd: "Do Not Disturb", invisible: "Invisible", offline: "Offline" } as Record<string, string>
  )[st] ?? "Offline";
}

export function voiceMembers(s: State, channelId: string) {
  return Object.values(s.voiceStates).filter((v) => v.channelId === channelId);
}
