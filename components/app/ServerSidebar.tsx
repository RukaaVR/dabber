"use client";

import { BellOff, ChevronDown, Hash, Lock, MicOff, HeadphoneOff, Plus, Settings, UserPlus, Volume2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useState } from "react";
import { setPrefs, set, toast, useStore, type State } from "@/lib/client/store";
import { href, useNav } from "@/lib/client/route";
import { displayName, isUnread, useCan } from "@/lib/client/selectors";
import { api, errMsg } from "@/lib/client/api";
import { copy } from "@/lib/client/actions";
import { joinVoice } from "@/lib/client/voice";
import { Perm, hasPerm, type Channel } from "@/lib/types";
import { UserAvatar } from "../ui/Avatar";
import { Tip } from "../ui/Tip";
import { SidebarFooter } from "./UserBar";
import { deleteCategoryFlow, deleteChannelFlow, leaveServerFlow } from "./serverFlows";
import { openProfile } from "../overlays/ProfileCard";

function VoicePeople({ channelId, serverId }: { channelId: string; serverId: string }) {
  const people = useStore(useShallow((s: State) => Object.values(s.voiceStates).filter((v) => v.channelId === channelId)));
  const speaking = useStore((s) => s.voice.speaking);
  const names = useStore(useShallow((s: State) => people.map((p) => displayName(s, p.userId, serverId))));
  if (!people.length) return null;
  return (
    <div className="voice-people">
      {people.map((p, i) => (
        <button key={p.userId} className="voice-person" onClick={(e) => openProfile(p.userId, serverId, e.currentTarget)}>
          <UserAvatar userId={p.userId} size={24} speaking={!!speaking[p.userId]} />
          <span className="vp-name">{names[i]}</span>
          <span className="vp-icons">
            {p.streaming && <span className="live-chip">LIVE</span>}
            {p.deafened ? <HeadphoneOff size={14} /> : p.muted ? <MicOff size={14} /> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

let dragging: { kind: "channel" | "category"; id: string } | null = null;

async function moveChannel(id: string, target: Channel, all: Channel[]) {
  if (id === target.id) return;
  const without = all.filter((x) => x.id !== id);
  const idx = without.findIndex((x) => x.id === target.id);
  try {
    await api.patch(`channels/${id}`, { position: idx, categoryId: target.categoryId });
  } catch (e) {
    toast(errMsg(e), "error");
  }
}

function ChannelRow({ c, active, all }: { c: Channel; active: boolean; all: Channel[] }) {
  const [over, setOver] = useState(false);
  const unread = useStore((s) => c.type === "text" && isUnread(s, c.id));
  const mentions = useStore((s) => s.mentionCounts[c.id] ?? 0);
  const canManage = useCan(c.serverId, Perm.MANAGE_CHANNELS);
  const canInvite = useCan(c.serverId, Perm.CREATE_INVITE);
  const nav = useNav();
  const open = () => {
    if (!c.serverId) return;
    if (c.type === "voice") void joinVoice(c.id);
    nav(href.server(c.serverId, c.id));
  };
  const onCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    set({
      ctx: {
        x: e.clientX,
        y: e.clientY,
        items: [
          ...(c.type === "text"
            ? [{ label: "Mark as read", onClick: () => void api.post(`channels/${c.id}/read`).catch(() => {}) }]
            : [{ label: "Join voice", onClick: open }]),
          ...(canInvite && c.serverId ? [{ label: "Invite people", onClick: () => set({ modal: { kind: "invite", serverId: c.serverId!, channelId: c.id } }) }] : []),
          ...(canManage
            ? [
                { sep: true, label: "" },
                { label: "Edit channel", onClick: () => set({ modal: { kind: "edit-channel", channelId: c.id } }) },
                { label: "Delete channel", danger: true, onClick: () => deleteChannelFlow(c.id) },
              ]
            : []),
          { sep: true, label: "" },
          { label: "Copy channel ID", onClick: () => copy(c.id, "Channel ID copied") },
        ],
      },
    });
  };
  const Icon = c.type === "voice" ? Volume2 : Hash;
  return (
    <>
      <div
        className={`channel-row${active ? " active" : ""}${unread && !active ? " unread" : ""}${over ? " drop-target" : ""}`}
        onContextMenu={onCtx}
        draggable={canManage}
        onDragStart={(e) => {
          dragging = { kind: "channel", id: c.id };
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", c.name);
        }}
        onDragEnd={() => (dragging = null)}
        onDragOver={(e) => {
          if (dragging?.kind !== "channel" || dragging.id === c.id) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (dragging?.kind === "channel") void moveChannel(dragging.id, c, all);
          dragging = null;
        }}
        title={canManage ? "Drag to rearrange" : undefined}
      >
        <button className="ch-main" onClick={open} aria-current={active ? "page" : undefined} aria-label={`${c.name} (${c.type === "voice" ? "voice" : "text"} channel)${unread ? ", unread" : ""}`}>
          <Icon size={18} style={{ flexShrink: 0 }} />
          <span className="ch-name">{c.name}</span>
          {c.isPrivate && <Lock size={12} style={{ flexShrink: 0, opacity: 0.7 }} aria-label="Private channel" />}
        </button>
        {mentions > 0 && !active ? <span className="badge">{mentions}</span> : null}
        <span className="ch-tools">
          {canInvite && c.serverId && (
            <Tip label="Invite people">
              <button aria-label="Invite people" onClick={() => set({ modal: { kind: "invite", serverId: c.serverId!, channelId: c.id } })}>
                <UserPlus size={15} />
              </button>
            </Tip>
          )}
          {canManage && (
            <Tip label="Edit channel">
              <button aria-label="Edit channel" onClick={() => set({ modal: { kind: "edit-channel", channelId: c.id } })}>
                <Settings size={15} />
              </button>
            </Tip>
          )}
        </span>
      </div>
      {c.type === "voice" && c.serverId && <VoicePeople channelId={c.id} serverId={c.serverId} />}
    </>
  );
}

export function ServerSidebar({ serverId, channelId }: { serverId: string; channelId: string | null }) {
  const server = useStore((s) => s.servers[serverId]);
  const me = useStore((s) => s.me);
  const channels = useStore(
    useShallow((s: State) =>
      Object.values(s.channels)
        .filter((c) => c.serverId === serverId)
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
    ),
  );
  const cats = useStore(
    useShallow((s: State) =>
      Object.values(s.categories)
        .filter((c) => c.serverId === serverId)
        .sort((a, b) => a.position - b.position),
    ),
  );
  const collapsed = useStore((s) => s.prefs.collapsed);
  const muted = useStore((s) => !!s.prefs.mutedServers[serverId]);
  const [overCat, setOverCat] = useState<string | null>(null);
  const nav = useNav();
  if (!server)
    return (
      <aside className="sidebar">
        <div className="sidebar-head" />
        <div className="sidebar-scroll" style={{ padding: 16, color: "var(--text-muted)" }}>
          Server not found.{" "}
          <button className="btn link" onClick={() => nav(href.home())}>
            Go home
          </button>
        </div>
        <SidebarFooter />
      </aside>
    );

  const p = server.myPermissions;
  const canManage = hasPerm(p, Perm.MANAGE_CHANNELS);
  const showSettings = hasPerm(p, Perm.MANAGE_SERVER) || hasPerm(p, Perm.MANAGE_ROLES) || hasPerm(p, Perm.BAN) || hasPerm(p, Perm.KICK);

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    set({
      ctx: {
        x: r.left + 10,
        y: r.bottom + 4,
        items: [
          ...(hasPerm(p, Perm.CREATE_INVITE) ? [{ label: "Invite people", onClick: () => set({ modal: { kind: "invite", serverId } }) }] : []),
          ...(showSettings ? [{ label: "Server settings", onClick: () => set({ serverSettings: { serverId, tab: "overview" } }) }] : []),
          ...(canManage
            ? [
                { label: "Create channel", onClick: () => set({ modal: { kind: "create-channel", serverId, categoryId: null } }) },
                { label: "Create category", onClick: () => set({ modal: { kind: "create-category", serverId } }) },
              ]
            : []),
          { sep: true, label: "" },
          { label: "Mark all as read", onClick: () => void api.post(`servers/${serverId}/read`).catch(() => {}) },
          {
            label: muted ? "Unmute server" : "Mute server",
            hint: muted ? undefined : "Only mentions ping",
            onClick: () => setPrefs({ mutedServers: { ...useStore.getState().prefs.mutedServers, [serverId]: !muted } }),
          },
          { label: "Copy server ID", onClick: () => copy(serverId, "Server ID copied") },
          ...(server.ownerId !== me?.id ? [{ sep: true, label: "" }, { label: "Leave server", danger: true, onClick: () => leaveServerFlow(serverId) }] : []),
        ],
      },
    });
  };

  const groups: { id: string | null; name: string | null; list: Channel[] }[] = [
    { id: null, name: null, list: channels.filter((c) => !c.categoryId || !cats.some((k) => k.id === c.categoryId)) },
    ...cats.map((k) => ({ id: k.id, name: k.name, list: channels.filter((c) => c.categoryId === k.id) })),
  ];

  return (
    <aside className="sidebar" aria-label={`${server.name} channels`}>
      {server.bannerColor ? (
        <div className="server-banner" style={{ background: `linear-gradient(160deg, ${server.bannerColor}, color-mix(in srgb, ${server.bannerColor} 40%, var(--bg-side)))` }}>
          <button className="server-head" onClick={openMenu} aria-haspopup="menu">
            <span className="name">{server.name}</span>
            {muted && <BellOff size={15} aria-label="Muted" style={{ opacity: 0.8 }} />}
            <ChevronDown size={18} />
          </button>
        </div>
      ) : (
        <button className="server-head" onClick={openMenu} aria-haspopup="menu">
          <span className="name">{server.name}</span>
          {muted && <BellOff size={15} aria-label="Muted" style={{ opacity: 0.6 }} />}
          <ChevronDown size={18} />
        </button>
      )}
      <div className="sidebar-scroll">
        {channels.length === 0 && (
          <p style={{ color: "var(--text-faint)", fontSize: 13, padding: "10px 8px" }}>
            No channels yet.
            {canManage && (
              <>
                {" "}
                <button className="btn link" onClick={() => set({ modal: { kind: "create-channel", serverId, categoryId: null } })}>
                  Create one
                </button>
              </>
            )}
          </p>
        )}
        {groups.map((g) => {
          if (g.id === null && !g.list.length) return null;
          const isCollapsed = g.id ? !!collapsed[g.id] : false;
          const visible = isCollapsed ? g.list.filter((c) => c.id === channelId) : g.list;
          return (
            <div key={g.id ?? "none"} role="group" aria-label={g.name ?? "Channels"}>
              {g.id && (
                <div
                  className={`cat-row${isCollapsed ? " collapsed" : ""}${overCat === g.id ? " drop-target" : ""}`}
                  draggable={canManage}
                  onDragStart={(e) => {
                    dragging = { kind: "category", id: g.id! };
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", g.name ?? "");
                  }}
                  onDragEnd={() => (dragging = null)}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    if (dragging.kind === "category" && dragging.id === g.id) return;
                    e.preventDefault();
                    setOverCat(g.id);
                  }}
                  onDragLeave={() => setOverCat(null)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setOverCat(null);
                    const d = dragging;
                    dragging = null;
                    if (!d) return;
                    try {
                      if (d.kind === "category") {
                        const idx = cats.filter((k) => k.id !== d.id).findIndex((k) => k.id === g.id);
                        await api.patch(`categories/${d.id}`, { position: idx });
                      } else {
                        // dropping a channel on a category header moves it to the top of that category
                        const first = g.list[0];
                        if (first) await moveChannel(d.id, first, channels);
                        else await api.patch(`channels/${d.id}`, { categoryId: g.id });
                      }
                    } catch (err) {
                      toast(errMsg(err), "error");
                    }
                  }}
                  onContextMenu={(e) => {
                    if (!canManage) return;
                    e.preventDefault();
                    set({
                      ctx: {
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          { label: "Edit category", onClick: () => set({ modal: { kind: "edit-category", categoryId: g.id! } }) },
                          { label: "Delete category", danger: true, onClick: () => deleteCategoryFlow(g.id!) },
                        ],
                      },
                    });
                  }}
                >
                  <button
                    className="cat-toggle"
                    aria-expanded={!isCollapsed}
                    onClick={() => setPrefs({ collapsed: { ...collapsed, [g.id!]: !isCollapsed } })}
                  >
                    <ChevronDown size={12} />
                    <span>{g.name}</span>
                  </button>
                  {canManage && (
                    <Tip label="Create channel">
                      <button
                        className="cat-add"
                        aria-label={`Create channel in ${g.name}`}
                        onClick={() => set({ modal: { kind: "create-channel", serverId, categoryId: g.id } })}
                      >
                        <Plus size={16} />
                      </button>
                    </Tip>
                  )}
                </div>
              )}
              {visible.map((c) => (
                <ChannelRow key={c.id} c={c} active={c.id === channelId} all={channels} />
              ))}
            </div>
          );
        })}
      </div>
      <SidebarFooter />
    </aside>
  );
}

