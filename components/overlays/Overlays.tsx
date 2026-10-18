"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, ExternalLink, Hash, Info, Phone, PhoneOff, Volume2, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { get, set, useStore, type State } from "@/lib/client/store";
import { channelLabel, dmChannels } from "@/lib/client/selectors";
import { href, useNav } from "@/lib/client/route";
import { joinVoice } from "@/lib/client/voice";
import { getSocket } from "@/lib/client/socket";
import { stopRing } from "@/lib/client/sounds";
import { ServerIcon, UserAvatar } from "../ui/Avatar";
import { ProfileCard } from "./ProfileCard";
import { EmojiPicker } from "./EmojiPicker";
import { ModalHost } from "./Modals";
import { SettingsScreen } from "../settings/Settings";
import { ServerSettings } from "../settings/ServerSettings";

function CtxMenu() {
  const ctx = useStore((s) => s.ctx);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!ctx || !ref.current) return setPos(null);
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    setPos({
      x: Math.max(8, Math.min(ctx.x, window.innerWidth - w - 8)),
      y: Math.max(8, ctx.y + h > window.innerHeight - 8 ? ctx.y - h : ctx.y),
    });
    ref.current.querySelector<HTMLElement>(".ctx-item")?.focus();
  }, [ctx]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => set({ ctx: null });
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLElement>(".ctx-item") ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [ctx]);

  if (!ctx) return null;
  const items = ctx.items.filter((it, i, arr) => !(it.sep && (i === 0 || i === arr.length - 1 || arr[i - 1]?.sep)));
  return (
    <div ref={ref} className="ctx-menu" role="menu" style={{ left: pos?.x ?? ctx.x, top: pos?.y ?? ctx.y, visibility: pos ? "visible" : "hidden" }}>
      {items.map((it, i) =>
        it.sep ? (
          <div key={i} className="ctx-sep" role="separator" />
        ) : it.quick ? (
          <div key={i} className="ctx-quick">
            {it.quick.map((e) => (
              <button
                key={e}
                aria-label={`React with ${e}`}
                onClick={() => {
                  set({ ctx: null });
                  it.onQuick?.(e);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`ctx-item${it.danger ? " danger" : ""}`}
            onClick={() => {
              set({ ctx: null });
              it.onClick?.();
            }}
          >
            <span>{it.label}</span>
            {it.hint && <span style={{ fontSize: 11, opacity: 0.7 }}>{it.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toast-stack" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === "error" ? <AlertCircle size={18} /> : t.kind === "success" ? <CheckCircle2 size={18} /> : <Info size={18} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Lightbox() {
  const lb = useStore((s) => s.lightbox);
  useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && set({ lightbox: null });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb]);
  if (!lb) return null;
  return (
    <div className="lightbox" role="dialog" aria-label={lb.name} onClick={(e) => e.target === e.currentTarget && set({ lightbox: null })}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lb.url} alt={lb.name} />
      <div className="lb-bar">
        <a href={lb.url} download={lb.name} aria-label="Download">
          <Download size={18} />
        </a>
        <a href={lb.url} target="_blank" rel="noreferrer" aria-label="Open original">
          <ExternalLink size={18} />
        </a>
        <button aria-label="Close" onClick={() => set({ lightbox: null })}>
          <X size={20} />
        </button>
      </div>
      <div className="lb-name">{lb.name}</div>
    </div>
  );
}

interface QsItem {
  key: string;
  label: string;
  where: string;
  kind: "dm" | "group" | "text" | "voice" | "server" | "friend";
  go: () => void;
  icon: React.ReactNode;
}

function QuickSwitcher() {
  const open = useStore((s) => s.quickSwitcher);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const nav = useNav();
  const state = useStore(
    useShallow((s: State) => ({ channels: s.channels, servers: s.servers, users: s.users, relationships: s.relationships })),
  );

  const items = useMemo<QsItem[]>(() => {
    if (!open) return [];
    const s = get();
    const out: QsItem[] = [];
    for (const c of dmChannels(s)) {
      const label = channelLabel(s, c);
      out.push({
        key: c.id,
        label,
        where: c.type === "group" ? "Group" : "DM",
        kind: c.type === "group" ? "group" : "dm",
        go: () => nav(href.dm(c.id)),
        icon: c.type === "group" ? <ServerIcon name={label} icon={c.icon} size={24} radius="50%" seed={c.id} /> : <UserAvatar userId={c.recipients?.[0] ?? null} size={24} />,
      });
    }
    for (const r of Object.values(state.relationships)) {
      if (r.type !== "friends") continue;
      if (out.some((o) => o.kind === "dm" && o.label === state.users[r.userId]?.displayName)) continue;
      const u = state.users[r.userId];
      if (!u) continue;
      out.push({
        key: `f-${u.id}`,
        label: u.displayName,
        where: "Friend",
        kind: "friend",
        go: () => {
          void import("@/lib/client/actions").then(async ({ openDm }) => {
            const id = await openDm(u.id);
            if (id) nav(href.dm(id));
          });
        },
        icon: <UserAvatar userId={u.id} size={24} />,
      });
    }
    for (const c of Object.values(state.channels)) {
      if (!c.serverId) continue;
      const srv = state.servers[c.serverId];
      out.push({
        key: c.id,
        label: c.name,
        where: srv?.name ?? "",
        kind: c.type === "voice" ? "voice" : "text",
        go: () => {
          if (c.type === "voice") void joinVoice(c.id);
          nav(href.server(c.serverId!, c.id));
        },
        icon: c.type === "voice" ? <Volume2 size={18} /> : <Hash size={18} />,
      });
    }
    for (const sv of Object.values(state.servers))
      out.push({ key: sv.id, label: sv.name, where: "Server", kind: "server", go: () => nav(href.server(sv.id)), icon: <ServerIcon name={sv.name} icon={sv.icon} size={24} radius={8} seed={sv.id} /> });
    const t = q.trim().replace(/^[#@*]/, "").toLowerCase();
    const prefix = q.trim()[0];
    let list = out;
    if (prefix === "#") list = list.filter((i) => i.kind === "text" || i.kind === "voice");
    if (prefix === "@") list = list.filter((i) => i.kind === "dm" || i.kind === "friend" || i.kind === "group");
    if (prefix === "*") list = list.filter((i) => i.kind === "server");
    if (t) list = list.filter((i) => i.label.toLowerCase().includes(t)).sort((a, b) => Number(!a.label.toLowerCase().startsWith(t)) - Number(!b.label.toLowerCase().startsWith(t)));
    return list.slice(0, 30);
  }, [open, q, state, nav]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
    }
  }, [open]);

  if (!open) return null;
  const close = () => set({ quickSwitcher: false });
  const go = (i: QsItem | undefined) => {
    if (!i) return;
    close();
    i.go();
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="qs" role="dialog" aria-label="Quick switcher">
        <input
          className="input"
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          placeholder="Where do you want to go?"
          aria-label="Search channels, DMs and servers"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(items.length - 1, s + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            }
            if (e.key === "Enter") go(items[sel]);
          }}
        />
        <div className="qs-list" role="listbox">
          {items.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 16 }}>Nothing matches.</p>
          ) : (
            items.map((i, idx) => (
              <button key={i.key} className="qs-item" role="option" aria-selected={idx === sel} onMouseEnter={() => setSel(idx)} onClick={() => go(i)}>
                <span style={{ width: 24, display: "grid", placeItems: "center", color: "var(--text-muted)" }}>{i.icon}</span>
                <span style={{ fontWeight: 600 }}>{i.label}</span>
                <span className="qs-where">{i.where}</span>
              </button>
            ))
          )}
        </div>
        <div className="qs-tip">
          Tip: start with <b>@</b> for people, <b>#</b> for channels or <b>*</b> for servers. <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to pick, <kbd className="kbd">Enter</kbd> to go.
        </div>
      </div>
    </div>
  );
}

function RingCard() {
  const ring = useStore((s) => s.ring);
  const label = useStore((s) => (ring ? channelLabel(s, s.channels[ring.channelId]) : ""));
  const from = useStore((s) => (ring ? s.users[ring.from] : undefined));
  const nav = useNav();
  if (!ring) return null;
  const dismiss = () => {
    set({ ring: null });
    stopRing();
    getSocket()?.emit("call:decline", { channelId: ring.channelId });
  };
  return (
    <div className="ring-card" role="alertdialog" aria-label={`Incoming call from ${from?.displayName ?? "someone"}`}>
      <UserAvatar userId={ring.from} size={80} />
      <h3>{from?.displayName ?? "Someone"}</h3>
      <p>Incoming call{label && label !== from?.displayName ? ` · ${label}` : ""}…</p>
      <div className="ring-actions">
        <button style={{ background: "var(--danger)" }} aria-label="Decline" onClick={dismiss}>
          <PhoneOff size={20} />
        </button>
        <button
          style={{ background: "var(--success)" }}
          aria-label="Accept"
          onClick={() => {
            const id = ring.channelId;
            set({ ring: null });
            stopRing();
            nav(href.dm(id));
            void joinVoice(id);
          }}
        >
          <Phone size={20} />
        </button>
      </div>
    </div>
  );
}

function ConnectionBanner() {
  const connected = useStore((s) => s.connected);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (connected) return setShow(false);
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [connected]);
  if (!show) return null;
  return (
    <div className="toast-stack" style={{ top: 12, bottom: "auto" }} role="status">
      <div className="toast error">
        <div className="spinner" style={{ width: 16, height: 16 }} /> Connection lost. Reconnecting…
      </div>
    </div>
  );
}

export function Overlays() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const serverSettings = useStore((s) => s.serverSettings);
  const modalOpen = useStore((s) => !!s.modal);
  // a modal launched from a profile card replaces it
  useEffect(() => {
    if (modalOpen) set({ profile: null });
  }, [modalOpen]);
  return (
    <>
      {settingsOpen && <SettingsScreen />}
      {serverSettings && <ServerSettings serverId={serverSettings.serverId} />}
      <ProfileCard />
      <ModalHost />
      <QuickSwitcher />
      <EmojiPicker />
      <CtxMenu />
      <Lightbox />
      <RingCard />
      <Toasts />
      <ConnectionBanner />
    </>
  );
}
