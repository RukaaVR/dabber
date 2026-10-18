"use client";

import { Compass, Plus, Volume2 } from "lucide-react";
import { set, useStore, type State } from "@/lib/client/store";
import { href, useNav, useRoute } from "@/lib/client/route";
import { channelLabel, dmChannels, serverUnread } from "@/lib/client/selectors";
import { api } from "@/lib/client/api";
import { copy } from "@/lib/client/actions";
import { Tip } from "../ui/Tip";
import { ServerIcon, UserAvatar } from "../ui/Avatar";
import { Perm, hasPerm } from "@/lib/types";
import { useShallow } from "zustand/react/shallow";
import { leaveServerFlow } from "./serverFlows";

function ServerButton({ id, active }: { id: string; active: boolean }) {
  const server = useStore((s) => s.servers[id]);
  const { unread, mentions } = useStore(useShallow((s: State) => serverUnread(s, id)));
  const inVoice = useStore((s) => {
    const cid = s.voice.channelId;
    return !!cid && s.channels[cid]?.serverId === id;
  });
  const lastChannel = useStore((s) => s.prefs.lastChannel[id]);
  const nav = useNav();
  if (!server) return null;
  const open = () => nav(href.server(id, lastChannel ?? null));
  const onCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = server.myPermissions;
    set({
      ctx: {
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: "Mark as read", onClick: () => void api.post(`servers/${id}/read`).catch(() => {}) },
          { sep: true, label: "" },
          ...(hasPerm(p, Perm.CREATE_INVITE) ? [{ label: "Invite people", onClick: () => set({ modal: { kind: "invite", serverId: id } }) }] : []),
          ...(hasPerm(p, Perm.MANAGE_SERVER) || hasPerm(p, Perm.MANAGE_ROLES) || hasPerm(p, Perm.BAN)
            ? [{ label: "Server settings", onClick: () => set({ serverSettings: { serverId: id, tab: "overview" } }) }]
            : []),
          { label: "Copy server ID", onClick: () => copy(id, "Server ID copied") },
          { sep: true, label: "" },
          ...(server.ownerId !== useStore.getState().me?.id ? [{ label: "Leave server", danger: true, onClick: () => leaveServerFlow(id) }] : []),
        ],
      },
    });
  };
  return (
    <div className={`rail-wrap${active ? " active" : ""}${unread && !active ? " unread" : ""}`}>
      <span className="rail-pill" />
      <Tip label={server.name} side="right">
        <button
          className={`rail-item${server.icon ? " has-icon" : ""}`}
          onClick={open}
          onContextMenu={onCtx}
          aria-label={`${server.name}${mentions ? `, ${mentions} mentions` : unread ? ", unread" : ""}`}
          aria-current={active ? "page" : undefined}
        >
          <span className="rail-inner">
            <ServerIcon name={server.name} icon={server.icon} size={48} radius="inherit" seed={server.id} />
          </span>
          {mentions > 0 ? (
            <span className="rail-badge">{mentions > 99 ? "99+" : mentions}</span>
          ) : inVoice ? (
            <span className="rail-voice">
              <Volume2 size={11} />
            </span>
          ) : null}
        </button>
      </Tip>
    </div>
  );
}

function UnreadDm({ channelId }: { channelId: string }) {
  const label = useStore((s) => channelLabel(s, s.channels[channelId]));
  const recipient = useStore((s) => s.channels[channelId]?.recipients?.[0] ?? null);
  const isGroup = useStore((s) => s.channels[channelId]?.type === "group");
  const icon = useStore((s) => s.channels[channelId]?.icon ?? null);
  const count = useStore((s) => s.mentionCounts[channelId] ?? 0);
  const nav = useNav();
  return (
    <div className="rail-wrap unread">
      <span className="rail-pill" />
      <Tip label={label} side="right">
        <button className="rail-item has-icon" onClick={() => nav(href.dm(channelId))} aria-label={`${label}, ${count} unread`}>
          <span className="rail-inner">
            {isGroup ? <ServerIcon name={label} icon={icon} size={48} radius="inherit" seed={channelId} /> : <UserAvatar userId={recipient} size={48} />}
          </span>
          <span className="rail-badge">{count > 99 ? "99+" : count}</span>
        </button>
      </Tip>
    </div>
  );
}

export function Rail() {
  const route = useRoute();
  const order = useStore(useShallow((s: State) => s.serverOrder));
  const unreadDms = useStore(
    useShallow((s: State) =>
      dmChannels(s)
        .filter((c) => (s.mentionCounts[c.id] ?? 0) > 0)
        .map((c) => c.id),
    ),
  );
  const pending = useStore((s) => Object.values(s.relationships).filter((r) => r.type === "incoming").length);
  const nav = useNav();
  const homeActive = route.kind === "home" || route.kind === "dm";

  return (
    <nav className="rail" aria-label="Servers">
      <div className={`rail-wrap${homeActive ? " active" : ""}`}>
        <span className="rail-pill" />
        <Tip label="Direct Messages" side="right">
          <button className="rail-item home" onClick={() => nav(href.home())} aria-label="Direct messages" aria-current={homeActive ? "page" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" draggable={false} />
            {pending > 0 && <span className="rail-badge">{pending}</span>}
          </button>
        </Tip>
      </div>
      {unreadDms.map((id) => (
        <UnreadDm key={id} channelId={id} />
      ))}
      <div className="rail-sep" />
      {order.map((id) => (
        <ServerButton key={id} id={id} active={route.kind === "server" && route.serverId === id} />
      ))}
      <div className="rail-wrap">
        <Tip label="Add a server" side="right">
          <button className="rail-item action" onClick={() => set({ modal: { kind: "create-server" } })} aria-label="Add a server">
            <Plus size={24} />
          </button>
        </Tip>
      </div>
      <div className={`rail-wrap${route.kind === "discover" ? " active" : ""}`}>
        <span className="rail-pill" />
        <Tip label="Discover servers" side="right">
          <button className="rail-item action" onClick={() => nav(href.discover())} aria-label="Discover servers">
            <Compass size={24} />
          </button>
        </Tip>
      </div>
    </nav>
  );
}
