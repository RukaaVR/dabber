"use client";

import { useEffect, useState } from "react";
import { AtSign, Hash, Pin, Search, X } from "lucide-react";
import { set, upsertUsers, useStore, type Panel } from "@/lib/client/store";
import { api, errMsg } from "@/lib/client/api";
import { channelLabel } from "@/lib/client/selectors";
import { href, useNav } from "@/lib/client/route";
import { MessageItem } from "./MessageItem";
import { Empty } from "../ui/Empty";
import type { Message, PublicUser } from "@/lib/types";

interface Result {
  messages: Message[];
  users: PublicUser[];
}

function ResultCard({ m, where }: { m: Message; where?: boolean }) {
  const ch = useStore((s) => s.channels[m.channelId]);
  const label = useStore((s) => channelLabel(s, s.channels[m.channelId]));
  const serverName = useStore((s) => (ch?.serverId ? s.servers[ch.serverId]?.name : null));
  const nav = useNav();
  const jump = () => {
    if (!ch) return;
    set({ jumpTo: { channelId: ch.id, messageId: m.id }, panel: null });
    nav(ch.serverId ? href.server(ch.serverId, ch.id) : href.dm(ch.id));
  };
  return (
    <div className="result-card">
      {where && (
        <div className="rc-where">
          {ch?.type === "text" ? <Hash size={12} /> : <AtSign size={12} />} {label}
          {serverName && <span style={{ color: "var(--text-faint)" }}>· {serverName}</span>}
        </div>
      )}
      <MessageItem m={m} grouped={false} serverId={ch?.serverId ?? null} canManage={false} canReact={false} canPin={false} candidates={[]} />
      <button className="btn tiny secondary rc-jump" onClick={jump}>
        Jump
      </button>
    </div>
  );
}

export function SidePanel({ kind, channelId, serverId }: { kind: Exclude<Panel, null>; channelId: string; serverId: string | null }) {
  const query = useStore((s) => s.searchQuery);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // pins: refresh when a message in this channel gets (un)pinned
  const pinSig = useStore((s) =>
    kind === "pins"
      ? (s.messages[channelId]?.list ?? [])
          .filter((m) => m.pinned)
          .map((m) => m.id)
          .join(",")
      : "",
  );

  useEffect(() => {
    let alive = true;
    const url =
      kind === "pins"
        ? `channels/${channelId}/pins`
        : kind === "mentions"
          ? "mentions"
          : `search?q=${encodeURIComponent(query)}&${serverId ? `serverId=${serverId}` : `channelId=${channelId}`}`;
    api
      .get<Result>(url)
      .then((r) => {
        if (!alive) return;
        upsertUsers(r.users);
        setData(r);
        setError(null);
      })
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [kind, channelId, serverId, query, pinSig, reloadKey]);

  const title = kind === "pins" ? "Pinned messages" : kind === "mentions" ? "Recent mentions" : `Results for “${query}”`;
  const Icon = kind === "pins" ? Pin : kind === "mentions" ? AtSign : Search;

  return (
    <aside className="side-panel" aria-label={title}>
      <div className="sp-head">
        <Icon size={18} />
        <span className="grow">{title}</span>
        <button className="icon-btn" aria-label="Close" onClick={() => set({ panel: null })}>
          <X size={18} />
        </button>
      </div>
      <div className="sp-body">
        {error ? (
          <Empty art="error" title="Couldn’t load" compact action={<button className="btn small" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>}>
            {error}
          </Empty>
        ) : !data ? (
          <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : data.messages.length === 0 ? (
          kind === "pins" ? (
            <Empty art="pins" title="Nothing pinned yet" compact>
              Open a message’s menu and choose Pin. Pinned messages show up here.
            </Empty>
          ) : kind === "mentions" ? (
            <Empty art="mentions" title="All quiet" compact>
              Nobody has mentioned you lately.
            </Empty>
          ) : (
            <Empty art="search" title="No results" compact>
              Nothing matches. Try other words, or from:username.
            </Empty>
          )
        ) : (
          <>
            {kind === "search" && (
              <div className="section-label" style={{ marginTop: 2 }}>
                {data.messages.length === 50 ? "50+ results" : `${data.messages.length} result${data.messages.length === 1 ? "" : "s"}`}
              </div>
            )}
            {data.messages.map((m) => (
              <ResultCard key={m.id} m={m} where={kind !== "pins"} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
