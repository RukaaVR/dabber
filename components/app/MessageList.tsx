"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Hash } from "lucide-react";
import { set, useStore } from "@/lib/client/store";
import { loadAround, loadLatest, loadNewer, loadOlder, markRead } from "@/lib/client/actions";
import { MessageItem } from "./MessageItem";
import { Empty } from "../ui/Empty";
import type { Message } from "@/lib/types";

const GROUP_MS = 7 * 60 * 1000;

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(ts: number) {
  return new Date(ts).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function Skeleton() {
  return (
    <div aria-label="Loading messages" aria-busy="true" style={{ padding: "16px 0" }}>
      {[180, 260, 120, 300, 200, 90].map((w, i) => (
        <div key={i} style={{ display: "flex", gap: 14, padding: "10px 16px" }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: 110, height: 12, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: w, maxWidth: "80%", height: 12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageList({
  channelId,
  serverId,
  start,
  canManage,
  canReact,
  canPin,
  candidates,
}: {
  channelId: string;
  serverId: string | null;
  start: React.ReactNode;
  canManage: boolean;
  canReact: boolean;
  canPin: boolean;
  candidates: string[];
}) {
  const cm = useStore((s) => s.messages[channelId]);
  const jumpTo = useStore((s) => (s.jumpTo?.channelId === channelId ? s.jumpTo.messageId : null));
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [pendingScrollTo, setPendingScrollTo] = useState<string | null>(null);
  // Snapshot the read marker when the channel opens, for the "new" divider.
  const [readMarker] = useState(() => {
    const s = useStore.getState();
    const c = s.channels[channelId];
    const last = s.readStates[channelId];
    return c?.lastMessageId && last && c.lastMessageId > last ? last : null;
  });

  useEffect(() => {
    if (!jumpTo) void loadLatest(channelId);
  }, [channelId, jumpTo]);

  // jump-to-message requests (search, pins, replies)
  useEffect(() => {
    if (!jumpTo) return;
    set({ jumpTo: null });
    const have = useStore.getState().messages[channelId]?.list.some((m) => m.id === jumpTo);
    if (have) setPendingScrollTo(jumpTo);
    else void loadAround(channelId, jumpTo).then(() => setPendingScrollTo(jumpTo));
  }, [jumpTo, channelId]);

  useEffect(() => {
    if (!pendingScrollTo) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-mid="${pendingScrollTo}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      atBottom.current = false;
      setFlashId(pendingScrollTo);
      setTimeout(() => setFlashId(null), 1900);
    }
    setPendingScrollTo(null);
  }, [pendingScrollTo, cm?.list]);

  const list = useMemo(() => cm?.list ?? [], [cm?.list]);

  // keep the view pinned to the bottom, or keep position when older messages load
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [list]);

  // images load late and change heights
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [cm?.loaded]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || !cm) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 && !cm.hasMoreAfter;
    if (el.scrollTop < 300 && cm.hasMoreBefore && !cm.loading && cm.loaded) {
      prevHeight.current = el.scrollHeight;
      void loadOlder(channelId).then(() => {
        if (prevHeight.current !== null && !useStore.getState().messages[channelId]?.loading) {
          /* layout effect consumed it */
        }
      });
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && cm.hasMoreAfter && !cm.loading) void loadNewer(channelId);
    if (atBottom.current && document.hasFocus()) markRead(channelId);
  }, [cm, channelId]);

  // mark read when opening / when new messages arrive while at bottom
  const lastId = list[list.length - 1]?.id;
  useEffect(() => {
    if (atBottom.current && document.visibilityState === "visible") markRead(channelId);
  }, [lastId, channelId]);
  useEffect(() => {
    const onFocus = () => atBottom.current && markRead(channelId);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [channelId]);

  const jump = useCallback(
    (id: string) => {
      set({ jumpTo: { channelId, messageId: id } });
    },
    [channelId],
  );

  if (!cm || (!cm.loaded && !cm.error))
    return (
      <div className="messages" ref={ref}>
        <Skeleton />
      </div>
    );
  if (cm.error && !cm.loaded)
    return (
      <div className="messages" style={{ display: "grid" }}>
        <Empty art="error" title="Couldn’t load messages" action={<button className="btn" onClick={() => void loadLatest(channelId, true)}>Retry</button>}>
          {cm.error}
        </Empty>
      </div>
    );

  const rows: React.ReactNode[] = [];
  let prev: Message | null = null;
  let newShown = false;
  for (const m of list) {
    if (!prev || !sameDay(prev.createdAt, m.createdAt)) {
      rows.push(
        <div key={`d-${m.id}`} className="day-divider" role="separator">
          {dayLabel(m.createdAt)}
        </div>,
      );
    }
    if (!newShown && readMarker && m.id > readMarker && prev && prev.id <= readMarker) {
      newShown = true;
      rows.push(
        <div key="new" className="new-divider" role="separator">
          New
        </div>,
      );
    }
    const grouped =
      !!prev &&
      prev.type === "default" &&
      m.type === "default" &&
      prev.authorId === m.authorId &&
      !m.replyTo &&
      m.createdAt - prev.createdAt < GROUP_MS &&
      sameDay(prev.createdAt, m.createdAt);
    rows.push(
      <MessageItem
        key={m.nonce ?? m.id}
        m={m}
        grouped={grouped}
        serverId={serverId}
        canManage={canManage}
        canReact={canReact}
        canPin={canPin}
        candidates={candidates}
        flash={flashId === m.id}
        onJump={jump}
      />,
    );
    prev = m;
  }

  return (
    <>
      <div className="messages" ref={ref} onScroll={onScroll} role="log" aria-label="Messages" aria-live="polite" tabIndex={0}>
        <div>
          {cm.hasMoreBefore ? (
            <div className="load-older">{cm.loading ? <div className="spinner" aria-label="Loading older messages" /> : null}</div>
          ) : (
            start
          )}
          {rows}
          {list.length === 0 && !cm.hasMoreBefore && null}
          {cm.hasMoreAfter && (
            <div className="load-older">
              <div className="spinner" />
            </div>
          )}
        </div>
      </div>
      {cm.hasMoreAfter && (
        <div className="jump-present" role="status">
          You’re viewing older messages
          <button
            onClick={() => {
              atBottom.current = true;
              void loadLatest(channelId, true);
            }}
          >
            Jump to present
          </button>
        </div>
      )}
    </>
  );
}

export function ChannelStart({ name, topic }: { name: string; topic?: string }) {
  return (
    <div className="chat-start">
      <div className="hash-hero">
        <Hash size={40} />
      </div>
      <h1>Welcome to #{name}!</h1>
      <p>{topic || `This is the start of the #${name} channel.`}</p>
    </div>
  );
}
