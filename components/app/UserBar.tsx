"use client";

import { Headphones, HeadphoneOff, Mic, MicOff, MonitorUp, PhoneOff, Settings, Signal, Bell, BellOff } from "lucide-react";
import { set, setPrefs, useStore } from "@/lib/client/store";
import { play } from "@/lib/client/sounds";
import { channelLabel, statusLabel } from "@/lib/client/selectors";
import { leaveVoice, toggleDeafen, toggleMute, toggleScreenShare } from "@/lib/client/voice";
import { logout, setStatus, copy } from "@/lib/client/actions";
import { href, useNav } from "@/lib/client/route";
import { UserAvatar } from "../ui/Avatar";
import { Tip } from "../ui/Tip";

function VoicePanel() {
  const v = useStore((s) => s.voice);
  const where = useStore((s) => {
    const c = v.channelId ? s.channels[v.channelId] : undefined;
    if (!c) return "";
    const label = channelLabel(s, c);
    return c.serverId ? `${label} / ${s.servers[c.serverId]?.name ?? ""}` : label;
  });
  const target = useStore((s) => {
    const c = v.channelId ? s.channels[v.channelId] : undefined;
    if (!c) return null;
    return c.serverId ? href.server(c.serverId, c.id) : href.dm(c.id);
  });
  const nav = useNav();
  if (!v.channelId) return null;
  return (
    <div className="voice-panel" aria-label="Voice connection">
      <div className="vp-status">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={`vp-title${v.status === "connecting" ? " connecting" : ""}`}>
            <Signal size={16} /> {v.status === "connecting" ? "Connecting…" : "Voice Connected"}
          </div>
          <button className="vp-where" onClick={() => target && nav(target)} style={{ maxWidth: "100%" }}>
            {where}
          </button>
        </div>
        <Tip label="Disconnect">
          <button className="icon-btn" onClick={() => void leaveVoice()} aria-label="Disconnect from voice">
            <PhoneOff size={20} />
          </button>
        </Tip>
      </div>
      <div className="vp-actions">
        <button className={`btn small ${v.streaming ? "" : "secondary"}`} onClick={() => void toggleScreenShare()} aria-pressed={v.streaming}>
          <MonitorUp size={16} /> {v.streaming ? "Stop sharing" : "Share screen"}
        </button>
      </div>
    </div>
  );
}

export function openStatusMenu(x: number, y: number) {
  const cur = useStore.getState().me?.statusPref;
  const mark = (s: string, hint?: string) => (cur === s ? "✓ Current" : hint);
  set({
    ctx: {
      x,
      y,
      items: [
        { label: "🟢  Online", hint: mark("online"), onClick: () => void setStatus("online") },
        { label: "🌙  Idle", hint: mark("idle"), onClick: () => void setStatus("idle") },
        { label: "⛔  Do Not Disturb", hint: mark("dnd", "Mutes notifications"), onClick: () => void setStatus("dnd") },
        { label: "⚪  Invisible", hint: mark("invisible", "Look offline"), onClick: () => void setStatus("invisible") },
        { sep: true, label: "" },
        { label: "Set a custom status", onClick: () => set({ modal: { kind: "custom-status" } }) },
        { label: "Edit profile", onClick: () => set({ settingsOpen: "profile" }) },
        { label: "Copy user ID", onClick: () => copy(useStore.getState().me?.id ?? "", "User ID copied") },
        { sep: true, label: "" },
        { label: "Log out", danger: true, onClick: () => void logout() },
      ],
    },
  });
}

export function SidebarFooter() {
  const me = useStore((s) => s.me);
  const muted = useStore((s) => s.voice.muted);
  const deafened = useStore((s) => s.voice.deafened);
  const sounds = useStore((s) => s.prefs.sounds);
  if (!me) return null;
  const sub = me.customStatus || statusLabel(me.status === "invisible" ? "invisible" : me.statusPref);
  return (
    <>
      <VoicePanel />
      <div className="user-bar">
        <button
          className="me-card"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openStatusMenu(r.left, r.top - 8);
          }}
          aria-label="Set status"
        >
          <UserAvatar userId={me.id} size={36} status user={{ ...me, status: me.statusPref === "invisible" ? "offline" : me.statusPref }} />
          <span style={{ minWidth: 0 }}>
            <div className="me-name">{me.displayName}</div>
            <div className="me-sub">{sub}</div>
          </span>
        </button>
        <Tip label={muted ? "Unmute" : "Mute"}>
          <button className={`icon-btn${muted ? " danger-on" : ""}`} onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>
            {muted ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
        </Tip>
        <Tip label={deafened ? "Undeafen" : "Deafen"}>
          <button
            className={`icon-btn${deafened ? " danger-on" : ""}`}
            onClick={toggleDeafen}
            aria-label={deafened ? "Undeafen" : "Deafen"}
            aria-pressed={deafened}
          >
            {deafened ? <HeadphoneOff size={19} /> : <Headphones size={19} />}
          </button>
        </Tip>
        <Tip label={sounds ? "Mute sounds" : "Unmute sounds"}>
          <button
            className={`icon-btn${sounds ? "" : " danger-on"}`}
            onClick={() => {
              setPrefs({ sounds: !sounds });
              if (!sounds) setTimeout(() => play("click"), 0);
            }}
            aria-label={sounds ? "Mute sounds" : "Unmute sounds"}
            aria-pressed={!sounds}
          >
            {sounds ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        </Tip>
        <Tip label="User settings">
          <button className="icon-btn" onClick={() => set({ settingsOpen: "account" })} aria-label="Settings">
            <Settings size={19} />
          </button>
        </Tip>
      </div>
    </>
  );
}
