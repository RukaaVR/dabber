"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play } from "lucide-react";

function fmt(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Themed audio player for voice messages and audio files. */
export function AudioPlayer({ src, label, filename }: { src: string; label: string; filename: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => {
      // webm from MediaRecorder reports Infinity until seeked once
      if (a.duration === Infinity) {
        a.currentTime = 1e9;
        a.addEventListener(
          "timeupdate",
          () => {
            setDur(a.duration);
            a.currentTime = 0;
          },
          { once: true },
        );
      } else setDur(a.duration);
    };
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onEnd);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onEnd);
      a.removeEventListener("play", onPlay);
    };
  }, []);

  const pct = dur ? Math.min(100, (t / dur) * 100) : 0;
  return (
    <div className="audio-player" role="group" aria-label={label}>
      <button
        className="ap-btn"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          const a = ref.current;
          if (!a) return;
          if (a.paused) void a.play().catch(() => {});
          else a.pause();
        }}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="ap-main">
        <div className="ap-label">{label}</div>
        <input
          className="ap-seek"
          type="range"
          min={0}
          max={dur || 0}
          step={0.01}
          value={Math.min(t, dur || 0)}
          aria-label="Position"
          style={{ ["--pct" as string]: `${pct}%` }}
          onChange={(e) => {
            const a = ref.current;
            if (a) a.currentTime = Number(e.target.value);
            setT(Number(e.target.value));
          }}
        />
      </div>
      <span className="ap-time">{fmt(playing || t ? t : dur)}</span>
      <a className="icon-btn sm" href={src} download={filename} aria-label={`Download ${filename}`}>
        <Download size={15} />
      </a>
      <audio ref={ref} src={src} preload="metadata" />
    </div>
  );
}
