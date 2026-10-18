"use client";

import { get } from "./store";

export type SoundName =
  | "send"
  | "receive"
  | "mention"
  | "click"
  | "error"
  | "success"
  | "voice-join"
  | "voice-leave"
  | "mute"
  | "unmute"
  | "ring";

const VOLUME: Partial<Record<SoundName, number>> = {
  send: 0.35,
  receive: 0.5,
  mention: 0.7,
  click: 0.3,
  error: 0.45,
  success: 0.45,
  "voice-join": 0.4,
  "voice-leave": 0.4,
  mute: 0.45,
  unmute: 0.45,
  ring: 0.5,
};

const cache = new Map<SoundName, HTMLAudioElement>();
let ringEl: HTMLAudioElement | null = null;

function el(name: SoundName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  let a = cache.get(name);
  if (!a) {
    a = new Audio(`/sounds/${name}.mp3`);
    a.preload = "auto";
    cache.set(name, a);
  }
  return a;
}

/** Play a short UI sound unless the user muted sounds. Never throws. */
export function play(name: SoundName) {
  if (!get().prefs.sounds) return;
  const base = el(name);
  if (!base) return;
  try {
    const a = base.cloneNode(true) as HTMLAudioElement;
    a.volume = VOLUME[name] ?? 0.5;
    void a.play().catch(() => {});
  } catch {
    /* autoplay blocked etc. */
  }
}

export function startRing() {
  if (!get().prefs.sounds || typeof Audio === "undefined") return;
  stopRing();
  ringEl = new Audio("/sounds/ring.mp3");
  ringEl.loop = true;
  ringEl.volume = VOLUME.ring ?? 0.5;
  void ringEl.play().catch(() => {});
}

export function stopRing() {
  if (ringEl) {
    ringEl.pause();
    ringEl = null;
  }
}
