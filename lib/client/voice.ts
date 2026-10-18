"use client";

import { get, resetVoice, setVoice, toast } from "./store";
import { getSocket } from "./socket";
import { play } from "./sounds";
import type { VoiceState } from "../types";

// Mesh WebRTC: every participant connects to every other participant.
// The newcomer sends offers; existing members answer. Each connection carries
// one audio and one video transceiver from the start, so mute / screen share
// only swap tracks and never need renegotiation.

interface Peer {
  pc: RTCPeerConnection;
  audio: MediaStream;
  video: MediaStream;
  audioEl: HTMLAudioElement;
  pendingIce: RTCIceCandidateInit[];
}

const peers = new Map<string, Peer>();
let mic: MediaStream | null = null;
let screen: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
const analysers = new Map<string, { an: AnalyserNode; src: MediaStreamAudioSourceNode }>();
let meterTimer: ReturnType<typeof setInterval> | null = null;

function iceServers(): RTCIceServer[] {
  try {
    const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
    return raw ? (JSON.parse(raw) as RTCIceServer[]) : [];
  } catch {
    return [];
  }
}

function emit(event: string, payload: unknown) {
  getSocket()?.emit(event, payload);
}

function micTrack(): MediaStreamTrack | null {
  const t = mic?.getAudioTracks()[0] ?? null;
  return t;
}

function syncMicEnabled() {
  const { muted, deafened } = get().voice;
  const t = micTrack();
  if (t) t.enabled = !muted && !deafened;
}

function syncDeafen() {
  const { deafened } = get().voice;
  for (const p of peers.values()) p.audioEl.muted = deafened;
}

function ensureAudioCtx() {
  if (!audioCtx && typeof AudioContext !== "undefined") audioCtx = new AudioContext();
  if (audioCtx?.state === "suspended") void audioCtx.resume().catch(() => {});
  return audioCtx;
}

function watchLevel(userId: string, stream: MediaStream) {
  const ctx = ensureAudioCtx();
  if (!ctx || !stream.getAudioTracks().length) return;
  analysers.get(userId)?.src.disconnect();
  try {
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    analysers.set(userId, { an, src });
  } catch {
    /* stream without live audio */
  }
  if (!meterTimer) {
    const buf = new Uint8Array(512);
    meterTimer = setInterval(() => {
      const speaking: Record<string, boolean> = {};
      const me = get().me?.id;
      for (const [uid, { an }] of analysers) {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const muted = uid === me ? get().voice.muted || get().voice.deafened : get().voiceStates[uid]?.muted;
        speaking[uid] = rms > 0.02 && !muted;
      }
      const prev = get().voice.speaking;
      const same = Object.keys(speaking).length === Object.keys(prev).length && Object.entries(speaking).every(([k, v]) => prev[k] === v);
      if (!same) setVoice({ speaking });
    }, 120);
  }
}

function makePeer(userId: string): Peer {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const audio = new MediaStream();
  const video = new MediaStream();
  const audioEl = new Audio();
  audioEl.autoplay = true;
  audioEl.muted = get().voice.deafened;
  const peer: Peer = { pc, audio, video, audioEl, pendingIce: [] };

  pc.onicecandidate = (e) => {
    if (e.candidate) emit("rtc:signal", { to: userId, data: { ice: e.candidate.toJSON() } });
  };
  pc.ontrack = (e) => {
    if (e.track.kind === "audio") {
      audio.getAudioTracks().forEach((t) => audio.removeTrack(t));
      audio.addTrack(e.track);
      audioEl.srcObject = audio;
      void audioEl.play().catch(() => {});
      watchLevel(userId, audio);
    } else {
      video.getVideoTracks().forEach((t) => video.removeTrack(t));
      video.addTrack(e.track);
    }
    setVoice({ remote: { ...get().voice.remote, [userId]: { audio, video } } });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      // try once more from our side if we were the offerer
      pc.restartIce?.();
    }
  };
  peers.set(userId, peer);
  setVoice({ remote: { ...get().voice.remote, [userId]: { audio, video } } });
  return peer;
}

function closePeer(userId: string) {
  const p = peers.get(userId);
  if (!p) return;
  p.pc.close();
  p.audioEl.srcObject = null;
  peers.delete(userId);
  analysers.get(userId)?.src.disconnect();
  analysers.delete(userId);
  const remote = { ...get().voice.remote };
  delete remote[userId];
  const speaking = { ...get().voice.speaking };
  delete speaking[userId];
  setVoice({ remote, speaking, focused: get().voice.focused === userId ? null : get().voice.focused });
}

async function attachLocalTracks(pc: RTCPeerConnection) {
  for (const t of pc.getTransceivers()) {
    const kind = t.receiver.track?.kind;
    if (kind === "audio") await t.sender.replaceTrack(micTrack());
    if (kind === "video") await t.sender.replaceTrack(screen?.getVideoTracks()[0] ?? null);
  }
}

async function callPeer(userId: string) {
  const peer = makePeer(userId);
  const { pc } = peer;
  pc.addTransceiver("audio", { direction: "sendrecv" });
  pc.addTransceiver("video", { direction: "sendrecv" });
  await attachLocalTracks(pc);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  emit("rtc:signal", { to: userId, data: { sdp: pc.localDescription } });
}

export async function onSignal(from: string, data: unknown) {
  if (!get().voice.channelId) return;
  const d = data as { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };
  try {
    if (d.sdp) {
      let peer = peers.get(from);
      if (d.sdp.type === "offer") {
        if (peer) closePeer(from); // fresh offer: rebuild the connection
        peer = makePeer(from);
        await peer.pc.setRemoteDescription(d.sdp);
        for (const t of peer.pc.getTransceivers()) t.direction = "sendrecv";
        await attachLocalTracks(peer.pc);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        emit("rtc:signal", { to: from, data: { sdp: peer.pc.localDescription } });
      } else if (peer) {
        await peer.pc.setRemoteDescription(d.sdp);
      }
      if (peer) {
        for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
      }
    } else if (d.ice) {
      const peer = peers.get(from);
      if (!peer) return;
      if (!peer.pc.remoteDescription) peer.pendingIce.push(d.ice);
      else await peer.pc.addIceCandidate(d.ice).catch(() => {});
    }
  } catch (e) {
    console.warn("[voice] signal failed", e);
  }
}

export function onVoiceUpdate(state: VoiceState) {
  const v = get().voice;
  if (state.userId === get().me?.id) return;
  if (v.channelId && state.channelId === v.channelId && !peers.has(state.userId)) {
    // they joined after us; they will call us. Make sure their tile shows.
    setVoice({ remote: { ...v.remote } });
  }
  if (v.channelId && state.channelId === v.channelId && v.status === "connected") {
    // someone joined our room
    if (!peers.has(state.userId) && !joinedSoundFor.has(state.userId)) {
      joinedSoundFor.add(state.userId);
      play("voice-join");
    }
  }
}
const joinedSoundFor = new Set<string>();

export function onVoiceLeave(userId: string, channelId: string) {
  const me = get().me?.id;
  if (userId === me) {
    if (get().voice.channelId === channelId) teardown(false);
    return;
  }
  joinedSoundFor.delete(userId);
  if (get().voice.channelId === channelId && peers.has(userId)) {
    closePeer(userId);
    play("voice-leave");
  }
}

export function onKicked(reason: string) {
  teardown(false);
  toast(reason);
}

async function getMic(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const id = get().prefs.micId;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: id ? { ideal: id } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    return null;
  }
}

export async function joinVoice(channelId: string) {
  const v = get().voice;
  if (v.channelId === channelId && v.status !== "idle") return;
  if (v.channelId) await leaveVoice(true);
  const sock = getSocket();
  if (!sock?.connected) {
    toast("You’re offline. Reconnecting…", "error");
    return;
  }
  setVoice({ channelId, status: "connecting", remote: {}, speaking: {}, streaming: false, localScreen: null, focused: null });
  ensureAudioCtx();
  mic = await getMic();
  if (!mic) toast("No microphone found or allowed. You can still listen.", "error");
  const me = get().me?.id;
  if (mic && me) watchLevel(me, mic);
  syncMicEnabled();
  const { muted, deafened } = get().voice;
  const res = await new Promise<{ ok?: boolean; error?: string; peers?: string[] }>((resolve) => {
    sock.timeout(8000).emit("voice:join", { channelId, muted: muted || !mic, deafened }, (err: unknown, r: { ok?: boolean; error?: string; peers?: string[] }) =>
      resolve(err ? { error: "Voice server didn’t answer. Try again." } : r),
    );
  });
  if (!res.ok) {
    teardown(false);
    toast(res.error ?? "Couldn’t join voice.", "error");
    play("error");
    return;
  }
  if (!mic) setVoice({ muted: true });
  setVoice({ status: "connected" });
  play("voice-join");
  for (const p of res.peers ?? []) {
    joinedSoundFor.add(p);
    void callPeer(p).catch((e) => console.warn("[voice] call failed", e));
  }
}

function teardown(sound: boolean) {
  for (const id of [...peers.keys()]) closePeer(id);
  mic?.getTracks().forEach((t) => t.stop());
  screen?.getTracks().forEach((t) => t.stop());
  mic = null;
  screen = null;
  for (const a of analysers.values()) a.src.disconnect();
  analysers.clear();
  if (meterTimer) clearInterval(meterTimer);
  meterTimer = null;
  joinedSoundFor.clear();
  if (sound) play("voice-leave");
  resetVoice();
}

export async function leaveVoice(silent = false) {
  if (!get().voice.channelId) return;
  emit("voice:leave", {});
  teardown(!silent);
}

export function toggleMute() {
  const v = get().voice;
  if (!mic && v.channelId && (v.muted || v.deafened)) {
    toast("No microphone available.", "error");
    return;
  }
  if (v.deafened) setVoice({ deafened: false, muted: false });
  else setVoice({ muted: !v.muted });
  syncMicEnabled();
  syncDeafen();
  play(get().voice.muted ? "mute" : "unmute");
  if (v.channelId) emit("voice:state", { muted: get().voice.muted, deafened: get().voice.deafened });
}

export function toggleDeafen() {
  const v = get().voice;
  setVoice({ deafened: !v.deafened });
  syncMicEnabled();
  syncDeafen();
  play(get().voice.deafened ? "mute" : "unmute");
  if (v.channelId) emit("voice:state", { muted: get().voice.muted, deafened: get().voice.deafened });
}

export async function toggleScreenShare() {
  const v = get().voice;
  if (!v.channelId) return;
  if (v.streaming) {
    stopScreen();
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    toast("Screen sharing isn’t supported in this browser.", "error");
    return;
  }
  try {
    screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
  } catch {
    return; // user cancelled
  }
  const track = screen.getVideoTracks()[0];
  track.onended = () => stopScreen();
  for (const p of peers.values()) {
    const t = p.pc.getTransceivers().find((x) => x.receiver.track?.kind === "video");
    await t?.sender.replaceTrack(track);
  }
  setVoice({ streaming: true, localScreen: screen, focused: get().me?.id ?? null });
  emit("voice:state", { streaming: true });
  play("success");
}

function stopScreen() {
  screen?.getTracks().forEach((t) => t.stop());
  screen = null;
  for (const p of peers.values()) {
    const t = p.pc.getTransceivers().find((x) => x.receiver.track?.kind === "video");
    void t?.sender.replaceTrack(null);
  }
  setVoice({ streaming: false, localScreen: null, focused: get().voice.focused === get().me?.id ? null : get().voice.focused });
  emit("voice:state", { streaming: false });
}

// Leaving the page leaves voice (server also cleans up on disconnect).
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (get().voice.channelId) emit("voice:leave", {});
  });
}

