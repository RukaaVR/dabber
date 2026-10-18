"use client";

import { Crown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStore, type State } from "@/lib/client/store";
import { displayName, roleColor, sortedRoles } from "@/lib/client/selectors";
import { hasPerm, Perm, type Channel } from "@/lib/types";
import { UserAvatar } from "../ui/Avatar";
import { Tip } from "../ui/Tip";
import { openProfile } from "../overlays/ProfileCard";

function Row({ userId, serverId, owner }: { userId: string; serverId: string | null; owner: boolean }) {
  const u = useStore((s) => s.users[userId]);
  const name = useStore((s) => displayName(s, userId, serverId));
  const color = useStore((s) => roleColor(s, serverId, userId));
  const inVoice = useStore((s) => !!s.voiceStates[userId]);
  if (!u) return null;
  const offline = u.status === "offline";
  return (
    <button className={`member-row${offline ? " offline" : ""}`} onClick={(e) => openProfile(userId, serverId, e.currentTarget)}>
      <UserAvatar userId={userId} size={32} status />
      <span className="mr-main">
        <span className="mr-name" style={{ color }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          {owner && (
            <Tip label="Owner">
              <Crown size={13} style={{ color: "var(--warning)", flexShrink: 0 }} aria-label="Owner" />
            </Tip>
          )}
        </span>
        {(u.customStatus || inVoice) && <span className="mr-sub">{inVoice ? "🎧 In voice" : u.customStatus}</span>}
      </span>
    </button>
  );
}

export function MembersList({ serverId, channel }: { serverId: string; channel: Channel }) {
  const loaded = useStore((s) => !!s.membersLoaded[serverId]);
  const groups = useStore(
    useShallow((s: State) => {
      const members = Object.values(s.members[serverId] ?? {});
      const roles = sortedRoles(s, serverId);
      const hoisted = roles.filter((r) => r.hoist && !r.isDefault);
      const server = s.servers[serverId];
      const visible = members.filter((m) => {
        if (!channel.isPrivate) return true;
        if (m.userId === server?.ownerId) return true;
        const mine = m.userId === s.me?.id ? (s.myRoles[serverId] ?? []) : m.roleIds;
        const perms = roles.filter((r) => r.isDefault || mine.includes(r.id)).reduce((a, r) => a | r.permissions, 0);
        if (hasPerm(perms, Perm.ADMIN) || hasPerm(perms, Perm.MANAGE_CHANNELS)) return true;
        return mine.some((id) => channel.roleIds.includes(id));
      });
      const name = (id: string) => displayName(s, id, serverId).toLowerCase();
      const out: { key: string; label: string; ids: string[] }[] = [];
      const used = new Set<string>();
      for (const r of hoisted) {
        const ids = visible
          .filter((m) => !used.has(m.userId) && (s.users[m.userId]?.status ?? "offline") !== "offline")
          .filter((m) => (m.userId === s.me?.id ? (s.myRoles[serverId] ?? []) : m.roleIds).includes(r.id))
          .map((m) => m.userId)
          .sort((a, b) => name(a).localeCompare(name(b)));
        ids.forEach((id) => used.add(id));
        if (ids.length) out.push({ key: r.id, label: r.name, ids });
      }
      const online = visible
        .filter((m) => !used.has(m.userId) && (s.users[m.userId]?.status ?? "offline") !== "offline")
        .map((m) => m.userId)
        .sort((a, b) => name(a).localeCompare(name(b)));
      const offline = visible
        .filter((m) => !used.has(m.userId) && (s.users[m.userId]?.status ?? "offline") === "offline")
        .map((m) => m.userId)
        .sort((a, b) => name(a).localeCompare(name(b)));
      if (online.length) out.push({ key: "online", label: "Online", ids: online });
      if (offline.length) out.push({ key: "offline", label: "Offline", ids: offline });
      return out.map((g) => `${g.key}|${g.label}|${g.ids.join(",")}`);
    }),
  );
  const ownerId = useStore((s) => s.servers[serverId]?.ownerId);
  return (
    <aside className="members" aria-label="Members">
      {!loaded
        ? [1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px" }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%" }} />
              <div className="skeleton" style={{ width: 100 + i * 12, height: 12 }} />
            </div>
          ))
        : groups.map((g) => {
            const [key, label, ids] = g.split("|");
            const list = ids ? ids.split(",") : [];
            return (
              <div key={key} role="group" aria-label={label}>
                <div className="m-group">
                  {label} — {list.length}
                </div>
                {list.map((id) => (
                  <Row key={id} userId={id} serverId={serverId} owner={id === ownerId} />
                ))}
              </div>
            );
          })}
    </aside>
  );
}

export function GroupMembers({ channel }: { channel: Channel }) {
  const me = useStore((s) => s.me?.id);
  const ids = [...(me ? [me] : []), ...(channel.recipients ?? [])];
  return (
    <aside className="members" aria-label="Members">
      <div className="m-group">Members — {ids.length}</div>
      {ids.map((id) => (
        <Row key={id} userId={id} serverId={null} owner={id === channel.ownerId} />
      ))}
    </aside>
  );
}
