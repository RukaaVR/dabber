"use client";

import { Plus, Search, Users, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { set, useStore, type State } from "@/lib/client/store";
import { href, useNav, useRoute } from "@/lib/client/route";
import { channelLabel, dmChannels, isUnread, statusLabel } from "@/lib/client/selectors";
import { api } from "@/lib/client/api";
import { ServerIcon, UserAvatar } from "../ui/Avatar";
import { Tip } from "../ui/Tip";
import { SidebarFooter } from "./UserBar";

function DmRow({ id, active }: { id: string; active: boolean }) {
  const c = useStore((s) => s.channels[id]);
  const label = useStore((s) => channelLabel(s, s.channels[id]));
  const unread = useStore((s) => isUnread(s, id));
  const count = useStore((s) => s.mentionCounts[id] ?? 0);
  const other = useStore((s) => (c?.type === "dm" ? s.users[c.recipients?.[0] ?? ""] : undefined));
  const inCall = useStore((s) => Object.values(s.voiceStates).some((v) => v.channelId === id));
  const nav = useNav();
  if (!c) return null;
  const sub =
    c.type === "group"
      ? `${(c.recipients?.length ?? 0) + 1} members`
      : inCall
        ? "In a call"
        : other?.customStatus || (other && other.status !== "offline" ? statusLabel(other.status) : "");
  return (
    <div className={`chat-row${active ? " active" : ""}${unread ? " unread" : ""}`}>
      <button
        className="flex items-center gap-[10px] flex-1 min-w-0 h-full text-left"
        onClick={() => nav(href.dm(id))}
        aria-current={active ? "page" : undefined}
      >
        {c.type === "group" ? (
          <ServerIcon name={label} icon={c.icon} size={32} radius="50%" seed={c.id} />
        ) : (
          <UserAvatar userId={c.recipients?.[0] ?? null} size={32} status />
        )}
        <span className="cr-main">
          <div className="cr-name">{label}</div>
          {sub && <div className="cr-sub">{sub}</div>}
        </span>
      </button>
      {count > 0 ? (
        <span className="badge">{count > 99 ? "99+" : count}</span>
      ) : (
        <Tip label={c.type === "group" ? "Hide group" : "Close DM"}>
          <button
            className="cr-close icon-btn sm"
            aria-label={c.type === "group" ? "Hide group" : "Close DM"}
            onClick={() => {
              void api.post(`dms/${id}/hide`).catch(() => {});
              if (active) nav(href.home());
            }}
          >
            <X size={16} />
          </button>
        </Tip>
      )}
    </div>
  );
}

export function HomeSidebar() {
  const route = useRoute();
  const dms = useStore(useShallow((s: State) => dmChannels(s).map((c) => c.id)));
  const pending = useStore((s) => Object.values(s.relationships).filter((r) => r.type === "incoming").length);
  const nav = useNav();
  return (
    <aside className="sidebar" aria-label="Direct messages">
      <div className="sidebar-head">
        <button className="sidebar-search" onClick={() => set({ quickSwitcher: true })}>
          <Search size={15} /> Find or start a conversation
        </button>
      </div>
      <div className="sidebar-scroll">
        <button className={`nav-row${route.kind === "home" ? " active" : ""}`} onClick={() => nav(href.friends())}>
          <Users size={20} /> Friends
          {pending > 0 && <span className="count">{pending}</span>}
        </button>
        <div className="dm-head">
          <span>Direct Messages</span>
          <Tip label="New group">
            <button onClick={() => set({ modal: { kind: "create-group" } })} aria-label="Create a group">
              <Plus size={16} />
            </button>
          </Tip>
        </div>
        {dms.length === 0 ? (
          <p style={{ color: "var(--text-faint)", fontSize: 13, padding: "6px 10px" }}>No chats yet. Add a friend, then say hi.</p>
        ) : (
          dms.map((id) => <DmRow key={id} id={id} active={route.kind === "dm" && route.channelId === id} />)
        )}
      </div>
      <SidebarFooter />
    </aside>
  );
}
