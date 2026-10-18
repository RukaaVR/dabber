"use client";

import { useEffect } from "react";
import { boot, resync } from "@/lib/client/actions";
import { set, useStore } from "@/lib/client/store";
import { applyTheme } from "@/lib/client/theme";
import { href, useNav, useRoute } from "@/lib/client/route";
import { toggleDeafen, toggleMute } from "@/lib/client/voice";
import { Rail } from "./Rail";
import { HomeSidebar } from "./HomeSidebar";
import { ServerSidebar } from "./ServerSidebar";
import { FriendsView } from "./FriendsView";
import { ChatView } from "./ChatView";
import { DiscoverView } from "./DiscoverView";
import { ServerLanding } from "./ServerLanding";
import { Overlays } from "../overlays/Overlays";
import { Empty } from "../ui/Empty";
import { Img } from "../ui/Img";

function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const upd = () => document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
    upd();
    vv.addEventListener("resize", upd);
    return () => vv.removeEventListener("resize", upd);
  }, []);
}

function useTitle() {
  const total = useStore((s) => Object.values(s.mentionCounts).reduce((a, b) => a + b, 0));
  const pending = useStore((s) => Object.values(s.relationships).filter((r) => r.type === "incoming").length);
  useEffect(() => {
    const n = total + pending;
    document.title = n ? `(${n}) Dabber` : "Dabber";
  }, [total, pending]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set((s) => ({ quickSwitcher: !s.quickSwitcher }));
      } else if (mod && e.key === "/") {
        e.preventDefault();
        set({ modal: { kind: "shortcuts" } });
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleMute();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleDeafen();
      } else if (mod && e.key === ",") {
        e.preventDefault();
        set({ settingsOpen: "account" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Loading() {
  return (
    <div className="auth-wrap" aria-busy="true" aria-label="Loading Dabber">
      <div style={{ textAlign: "center" }}>
        <Img src="/brand/logo-mark.png" width={96} height={96} style={{ animation: "bob 1.6s ease-in-out infinite" }} fallback={<div className="spinner" style={{ margin: "0 auto", width: 40, height: 40 }} />} />
        <p style={{ color: "var(--text-muted)", fontWeight: 600, marginTop: 14 }}>Loading your servers…</p>
      </div>
    </div>
  );
}

export function AppRoot() {
  const ready = useStore((s) => s.ready);
  const bootError = useStore((s) => s.bootError);
  const theme = useStore((s) => s.prefs.theme);
  const accent = useStore((s) => s.prefs.accent);
  const fontScale = useStore((s) => s.prefs.fontScale);
  const route = useRoute();
  const nav = useNav();

  useViewportHeight();
  useTitle();
  useShortcuts();

  useEffect(() => {
    void boot();
    const onResync = () => void resync();
    window.addEventListener("dabber:resync", onResync);
    return () => window.removeEventListener("dabber:resync", onResync);
  }, []);

  useEffect(() => {
    applyTheme(theme, accent);
  }, [theme, accent]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(fontScale * 100)}%`;
    document.body.style.fontSize = `${15 * fontScale}px`;
  }, [fontScale]);

  // Leave views that disappeared (kicked, channel deleted, group left).
  useEffect(() => {
    const onServerGone = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const r = route;
      if (r.kind === "server" && r.serverId === id) nav(href.home(), true);
    };
    const onChannelGone = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const r = route;
      if (r.kind === "dm" && r.channelId === id) nav(href.home(), true);
      if (r.kind === "server" && r.channelId === id) nav(href.server(r.serverId), true);
    };
    window.addEventListener("dabber:server-gone", onServerGone);
    window.addEventListener("dabber:channel-gone", onChannelGone);
    return () => {
      window.removeEventListener("dabber:server-gone", onServerGone);
      window.removeEventListener("dabber:channel-gone", onChannelGone);
    };
  }, [route, nav]);

  if (bootError)
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ padding: 8 }}>
          <Empty art="error" title="Dabber couldn’t load" action={<button className="btn" onClick={() => location.reload()}>Try again</button>}>
            {bootError}
          </Empty>
        </div>
      </div>
    );
  if (!ready) return <Loading />;

  const chatOpen = (route.kind === "home" && route.friends) || route.kind === "dm" || (route.kind === "server" && !!route.channelId) || route.kind === "discover";
  let sidebar = <HomeSidebar />;
  let main: React.ReactNode = <FriendsView />;
  if (route.kind === "server") {
    sidebar = <ServerSidebar serverId={route.serverId} channelId={route.channelId} />;
    main = route.channelId ? <ChatView key={route.channelId} channelId={route.channelId} /> : <ServerLanding serverId={route.serverId} />;
  } else if (route.kind === "dm") {
    main = <ChatView key={route.channelId} channelId={route.channelId} />;
  } else if (route.kind === "discover") {
    main = <DiscoverView />;
  }

  return (
    <div className={`app${chatOpen ? " chat-open" : ""}`}>
      <Rail />
      {sidebar}
      <main className="main" id="main">
        {main}
      </main>
      <Overlays />
    </div>
  );
}

