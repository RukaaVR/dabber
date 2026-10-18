"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageCircle, MoreHorizontal, Pencil, Plus, UserPlus, X, Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { get, set, toast, useStore, type State } from "@/lib/client/store";
import { api, errMsg } from "@/lib/client/api";
import { copy, openDm } from "@/lib/client/actions";
import { displayName, memberRoleIds, sortedRoles, statusLabel } from "@/lib/client/selectors";
import { href, useNav } from "@/lib/client/route";
import { colorFor } from "@/lib/client/theme";
import { Perm, hasPerm } from "@/lib/types";
import { UserAvatar } from "../ui/Avatar";
import { Tip } from "../ui/Tip";
import { blockFlow, kickFlow, removeFriendFlow, sendFriendRequest, unblock } from "../app/serverFlows";

export function openProfile(userId: string, serverId: string | null, anchor: HTMLElement) {
  const r = anchor.getBoundingClientRect();
  const right = r.right + 10;
  const x = right + 330 < window.innerWidth ? right : Math.max(12, r.left - 330);
  set({ profile: { userId, serverId, x, y: r.top } });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function ProfileCard() {
  const p = useStore((s) => s.profile);
  const u = useStore((s) => (p ? s.users[p.userId] : undefined));
  const me = useStore((s) => s.me);
  const rel = useStore((s) => (p ? s.relationships[p.userId]?.type : undefined));
  const name = useStore((s) => (p ? displayName(s, p.userId, p.serverId) : ""));
  const member = useStore((s) => (p?.serverId ? s.members[p.serverId]?.[p.userId] : undefined));
  const serverPerms = useStore((s) => (p?.serverId ? (s.servers[p.serverId]?.myPermissions ?? 0) : 0));
  const ownerId = useStore((s) => (p?.serverId ? s.servers[p.serverId]?.ownerId : undefined));
  const roles = useStore(useShallow((s: State) => (p?.serverId ? sortedRoles(s, p.serverId).filter((r) => !r.isDefault) : [])));
  const myRoleIds = useStore(useShallow((s: State) => (p?.serverId && p ? memberRoleIds(s, p.serverId, p.userId) : [])));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [mutual, setMutual] = useState<{ servers: number; friends: number } | null>(null);
  const nav = useNav();

  useLayoutEffect(() => {
    if (!p || !ref.current) return;
    const h = ref.current.offsetHeight;
    const y = Math.max(12, Math.min(p.y, window.innerHeight - h - 12));
    const x = Math.max(12, Math.min(p.x, window.innerWidth - ref.current.offsetWidth - 12));
    setPos({ x, y });
  }, [p, u, member, addingRole]);

  useEffect(() => {
    if (!p) return;
    setAddingRole(false);
    setNote("");
    setMutual(null);
    let alive = true;
    api
      .get<{ user: import("@/lib/types").PublicUser; mutualServers: string[]; mutualFriends: string[] }>(`users/${p.userId}`)
      .then((r) => {
        if (!alive) return;
        setMutual({ servers: r.mutualServers.length, friends: r.mutualFriends.length });
        if (r.user.id !== get().me?.id) set((s) => ({ users: { ...s.users, [r.user.id]: r.user } }));
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && set({ profile: null });
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".ctx-menu")) set({ profile: null });
    };
    window.addEventListener("keydown", onKey);
    setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [p]);

  if (!p || !u) return null;
  const isMe = me?.id === u.id;
  const close = () => set({ profile: null });
  const canRoles = !!p.serverId && hasPerm(serverPerms, Perm.MANAGE_ROLES);
  const status = isMe ? (me?.statusPref ?? "online") : u.status;

  const setRoles = async (ids: string[]) => {
    if (!p.serverId) return;
    try {
      await api.patch(`servers/${p.serverId}/members/${u.id}`, { roleIds: ids });
    } catch (e) {
      toast(errMsg(e), "error");
    }
  };

  const message = async (text?: string) => {
    const id = await openDm(u.id);
    if (!id) return;
    close();
    nav(href.dm(id));
    if (text) {
      const { sendMessage } = await import("@/lib/client/actions");
      void sendMessage(id, text);
    }
  };

  const more = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sid = p.serverId;
    const canKick = !!sid && !isMe && u.id !== ownerId && hasPerm(serverPerms, Perm.KICK);
    const canBan = !!sid && !isMe && u.id !== ownerId && hasPerm(serverPerms, Perm.BAN);
    const canNick = !!sid && (isMe || hasPerm(serverPerms, Perm.MANAGE_NICKNAMES));
    set({
      ctx: {
        x: r.left,
        y: r.bottom + 4,
        items: [
          ...(canNick ? [{ label: isMe ? "Change nickname" : "Change nickname", onClick: () => set({ modal: { kind: "nickname", serverId: sid!, userId: u.id } }) }] : []),
          { label: "Copy username", onClick: () => copy(u.username, "Username copied") },
          { label: "Copy user ID", onClick: () => copy(u.id, "User ID copied") },
          ...(!isMe && rel === "friends" ? [{ label: "Remove friend", danger: true, onClick: () => removeFriendFlow(u.id) }] : []),
          ...(!isMe ? [rel === "blocked" ? { label: "Unblock", onClick: () => void unblock(u.id) } : { label: "Block", danger: true, onClick: () => blockFlow(u.id) }] : []),
          ...(canKick || canBan ? [{ sep: true, label: "" }] : []),
          ...(canKick ? [{ label: `Kick ${u.displayName}`, danger: true, onClick: () => kickFlow(sid!, u.id) }] : []),
          ...(canBan ? [{ label: `Ban ${u.displayName}`, danger: true, onClick: () => set({ modal: { kind: "ban", serverId: sid!, userId: u.id } }) }] : []),
        ],
      },
    });
  };

  return (
    <div
      ref={ref}
      className="profile-card"
      role="dialog"
      aria-label={`${u.displayName}'s profile`}
      style={{ left: pos?.x ?? p.x, top: pos?.y ?? p.y, visibility: pos ? "visible" : "hidden" }}
    >
      <div className="pc-banner" style={{ background: u.bannerColor ?? `linear-gradient(135deg, ${colorFor(u.avatarSeed)}, var(--accent-2))` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingRight: 12 }}>
        <div className="pc-avatar">
          <UserAvatar userId={u.id} size={80} status user={{ ...u, status }} />
        </div>
        <Tip label="More">
          <button className="icon-btn" style={{ marginTop: 8 }} aria-label="More" onClick={more}>
            <MoreHorizontal size={18} />
          </button>
        </Tip>
      </div>
      <div className="pc-body">
        <div className="pc-name">{name}</div>
        <div className="pc-uname">
          {u.username}
          {u.pronouns && ` · ${u.pronouns}`}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <span className={`status-pip status-dot ${status}`} style={{ position: "static", border: 0 }} /> {statusLabel(status)}
        </div>
        {u.customStatus && <div className="pc-custom">{u.customStatus}</div>}
        {u.about && (
          <div className="pc-section">
            <h4>About me</h4>
            <div className="pc-about">{u.about}</div>
          </div>
        )}
        <div className="pc-section">
          <h4>Member since</h4>
          <div style={{ fontSize: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span title="Joined Dabber">🟣 {fmtDate(u.createdAt)}</span>
            {member && <span title="Joined this server">🏠 {fmtDate(member.joinedAt)}</span>}
          </div>
          {mutual && !isMe && (mutual.servers > 0 || mutual.friends > 0) && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
              {mutual.friends > 0 && `${mutual.friends} mutual friend${mutual.friends === 1 ? "" : "s"}`}
              {mutual.friends > 0 && mutual.servers > 0 && " · "}
              {mutual.servers > 0 && `${mutual.servers} mutual server${mutual.servers === 1 ? "" : "s"}`}
            </div>
          )}
        </div>
        {p.serverId && (myRoleIds.length > 0 || canRoles) && (
          <div className="pc-section">
            <h4>Roles</h4>
            <div className="role-chips">
              {roles
                .filter((r) => myRoleIds.includes(r.id))
                .map((r) => (
                  <span key={r.id} className="role-chip">
                    <span className="rc-dot" style={{ background: r.color ?? "var(--text-faint)" }} />
                    {r.name}
                    {canRoles && (
                      <button aria-label={`Remove ${r.name}`} onClick={() => void setRoles(myRoleIds.filter((x) => x !== r.id))}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              {canRoles && (
                <button className="role-chip add" aria-label="Add a role" onClick={() => setAddingRole((v) => !v)}>
                  <Plus size={12} /> {myRoleIds.length ? "" : "Add role"}
                </button>
              )}
            </div>
            {addingRole && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                {roles.filter((r) => !myRoleIds.includes(r.id)).length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {roles.length ? "They have every role." : "Make some roles first (Server Settings → Roles)."}
                  </span>
                ) : (
                  roles
                    .filter((r) => !myRoleIds.includes(r.id))
                    .map((r) => (
                      <button
                        key={r.id}
                        className="nav-row"
                        style={{ height: 32, fontSize: 14 }}
                        onClick={() => {
                          setAddingRole(false);
                          void setRoles([...myRoleIds, r.id]);
                        }}
                      >
                        <span className="status-pip" style={{ background: r.color ?? "var(--text-faint)" }} /> {r.name}
                      </button>
                    ))
                )}
              </div>
            )}
          </div>
        )}
        {isMe ? (
          <div className="pc-actions">
            <button
              className="btn small secondary"
              onClick={() => {
                close();
                set({ settingsOpen: "profile" });
              }}
            >
              <Pencil size={15} /> Edit Profile
            </button>
          </div>
        ) : (
          <>
            {rel !== "blocked" && (
              <form
                className="pc-section"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) void message(note.trim());
                }}
              >
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Message @${u.username}`} aria-label={`Message ${u.displayName}`} maxLength={4000} />
              </form>
            )}
            <div className="pc-actions">
              {rel !== "blocked" && (
                <button className="btn small" onClick={() => void message()}>
                  <MessageCircle size={15} /> Message
                </button>
              )}
              {(!rel || rel === "incoming") && (
                <button className="btn small secondary" onClick={() => void sendFriendRequest(u.id)}>
                  {rel === "incoming" ? <Check size={15} /> : <UserPlus size={15} />} {rel === "incoming" ? "Accept" : "Add Friend"}
                </button>
              )}
              {rel === "outgoing" && (
                <button className="btn small secondary" disabled>
                  Request sent
                </button>
              )}
              {rel === "blocked" && (
                <button className="btn small secondary" onClick={() => void unblock(u.id)}>
                  Unblock
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
