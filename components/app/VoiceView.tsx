"use client";

import { useEffect, useRef } from "react";
import { HeadphoneOff, Headphones, Maximize, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Volume2, Phone } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { setVoice, useStore, type State } from "@/lib/client/store";
import { channelLabel, displayName } from "@/lib/client/selectors";
import { joinVoice, leaveVoice, toggleDeafen, toggleMute, toggleScreenShare } from "@/lib/client/voice";
import { colorFor } from "@/lib/client/theme";
import type { Channel } from "@/lib/types";
import { UserAvatar } from "../ui/Avatar";
import { Tip } from "../ui/Tip";
import { BackButton } from "./BackButton";
import { Img } from "../ui/Img";

function Video({ stream, muted = true }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}

function useParticipants(channelId: string) {
  return useStore(useShallow((s: State) => Object.values(s.voiceStates).filter((v) => v.channelId === channelId)));
}

function streamFor(s: State, userId: string): MediaStream | null {
  if (userId === s.me?.id) return s.voice.localScreen;
  const st = s.voiceStates[userId];
  if (!st?.streaming) return null;
  const v = s.voice.remote[userId]?.video;
  return v && v.getVideoTracks().length ? v : null;
}

function Tile({ userId, serverId, compact }: { userId: string; serverId: string | null; compact?: boolean }) {
  const st = useStore((s) => s.voiceStates[userId]);
  const speaking = useStore((s) => !!s.voice.speaking[userId]);
  const name = useStore((s) => displayName(s, userId, serverId));
  const stream = useStore((s) => streamFor(s, userId));
  const tint = useStore((s) => s.users[userId]?.bannerColor ?? null);
  return (
    <div
      className={`voice-tile${speaking ? " speaking" : ""}`}
      style={{ ["--tile" as string]: tint ?? `color-mix(in srgb, ${colorFor(userId)} 35%, #1c1d22)` }}
      onClick={() => stream && setVoice({ focused: userId })}
      role={stream ? "button" : undefined}
      aria-label={stream ? `Watch ${name}'s stream` : undefined}
    >
      {stream ? <Video stream={stream} /> : <UserAvatar userId={userId} size={compact ? 48 : 80} speaking={speaking} />}
      <span className="vt-name">
        <span>{name}</span>
      </span>
      {st?.streaming && (
        <span className="vt-live">
          <span className="live-chip">LIVE</span>
        </span>
      )}
      {(st?.muted || st?.deafened) && (
        <span className="vt-state">
          {st.deafened ? (
            <span aria-label="Deafened">
              <HeadphoneOff size={14} />
            </span>
          ) : (
            <span aria-label="Muted">
              <MicOff size={14} />
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function Stage({ channelId, serverId, compact }: { channelId: string; serverId: string | null; compact?: boolean }) {
  const people = useParticipants(channelId);
  const focused = useStore((s) => s.voice.focused);
  const focusStream = useStore((s) => (focused ? streamFor(s, focused) : null));
  const focusName = useStore((s) => (focused ? displayName(s, focused, serverId) : ""));
  const mainRef = useRef<HTMLDivElement>(null);
  if (focused && focusStream) {
    return (
      <div className="voice-stage">
        <div className="stream-main" ref={mainRef}>
          <Video stream={focusStream} />
          <span className="stream-label">
            <span className="live-chip">LIVE</span> {focusName}
          </span>
          <span className="stream-tools">
            <Tip label="Full screen">
              <button aria-label="Full screen" onClick={() => void mainRef.current?.requestFullscreen?.().catch(() => {})}>
                <Maximize size={18} />
              </button>
            </Tip>
            <Tip label="Stop watching">
              <button aria-label="Stop watching" onClick={() => setVoice({ focused: null })}>
                <MonitorX size={18} />
              </button>
            </Tip>
          </span>
        </div>
        <div className="voice-grid strip">
          {people.map((p) => (
            <Tile key={p.userId} userId={p.userId} serverId={serverId} compact />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="voice-stage">
      <div className="voice-grid" style={compact ? { gridTemplateColumns: "repeat(auto-fit, minmax(160px, 220px))", justifyContent: "center" } : undefined}>
        {people.map((p) => (
          <Tile key={p.userId} userId={p.userId} serverId={serverId} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function Controls({ channelId, joinLabel }: { channelId: string; joinLabel: string }) {
  const v = useStore((s) => s.voice);
  const here = v.channelId === channelId;
  if (!here)
    return (
      <div className="call-controls">
        <button className="call-btn join" onClick={() => void joinVoice(channelId)}>
          <Phone size={18} /> {joinLabel}
        </button>
      </div>
    );
  return (
    <div className="call-controls" role="toolbar" aria-label="Call controls">
      <Tip label={v.muted ? "Unmute" : "Mute"}>
        <button className={`call-btn${v.muted ? " off" : ""}`} onClick={toggleMute} aria-label={v.muted ? "Unmute" : "Mute"} aria-pressed={v.muted}>
          {v.muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
      </Tip>
      <Tip label={v.deafened ? "Undeafen" : "Deafen"}>
        <button className={`call-btn${v.deafened ? " off" : ""}`} onClick={toggleDeafen} aria-label={v.deafened ? "Undeafen" : "Deafen"} aria-pressed={v.deafened}>
          {v.deafened ? <HeadphoneOff size={22} /> : <Headphones size={22} />}
        </button>
      </Tip>
      <Tip label={v.streaming ? "Stop sharing" : "Share your screen"}>
        <button className={`call-btn${v.streaming ? " live" : ""}`} onClick={() => void toggleScreenShare()} aria-label="Share screen" aria-pressed={v.streaming}>
          <MonitorUp size={22} />
        </button>
      </Tip>
      <Tip label="Disconnect">
        <button className="call-btn hang" onClick={() => void leaveVoice()} aria-label="Disconnect">
          <PhoneOff size={22} />
        </button>
      </Tip>
    </div>
  );
}

export function VoiceView({ channel }: { channel: Channel }) {
  const people = useParticipants(channel.id);
  const status = useStore((s) => (s.voice.channelId === channel.id ? s.voice.status : "idle"));
  return (
    <div className="voice-view">
      <header className="vv-head">
        <BackButton />
        <Volume2 size={20} style={{ opacity: 0.7 }} />
        <h1 style={{ fontSize: 16, margin: 0 }}>{channel.name}</h1>
        {status === "connecting" && <span style={{ color: "var(--warning)", fontSize: 13, fontWeight: 600 }}>Connecting…</span>}
      </header>
      {people.length === 0 ? (
        <div className="voice-empty">
          <div>
            <Img src="/illustrations/voice.png" />
            <h2>No one’s here yet</h2>
            <p style={{ margin: 0 }}>Jump in and wait for people to show up.</p>
          </div>
        </div>
      ) : (
        <Stage channelId={channel.id} serverId={channel.serverId} />
      )}
      <Controls channelId={channel.id} joinLabel="Join Voice" />
    </div>
  );
}

export function DmCall({ channel }: { channel: Channel }) {
  const label = useStore((s) => channelLabel(s, channel));
  const here = useStore((s) => s.voice.channelId === channel.id);
  return (
    <div className="dm-call" aria-label={`Call in ${label}`}>
      <Stage channelId={channel.id} serverId={null} compact />
      <Controls channelId={channel.id} joinLabel={here ? "Join" : "Join call"} />
    </div>
  );
}
