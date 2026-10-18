"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "@/lib/client/store";
import { play } from "@/lib/client/sounds";
import { Tip } from "../ui/Tip";

const MAX_SECONDS = 300;

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Mic button that turns into a recording bar; hands back an audio File. */
export function VoiceRecorder({ onSend, onActive }: { onSend: (f: File) => void; onActive: (v: boolean) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const sendOnStop = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const stopAll = (r: MediaRecorder, send: boolean) => {
    sendOnStop.current = send;
    if (r.state !== "inactive") r.stop();
    r.stream.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
  };

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast("Your browser can’t record audio.", "error");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast("Allow microphone access to record a voice message.", "error");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      setRec(null);
      onActive(false);
      if (!sendOnStop.current) return;
      const type = (r.mimeType || "audio/webm").split(";")[0];
      const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
      const blob = new Blob(chunks.current, { type });
      if (blob.size < 800) {
        toast("That was too short to send.", "error");
        return;
      }
      onSend(new File([blob], `voice-message.${ext}`, { type }));
    };
    r.start(250);
    setRec(r);
    setSecs(0);
    onActive(true);
    play("click");
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setSecs(s);
      if (s >= MAX_SECONDS) stopAll(r, true);
    }, 200);
  };

  if (!rec)
    return (
      <Tip label="Record a voice message">
        <button className="icon-btn" aria-label="Record a voice message" onClick={() => void start()}>
          <Mic size={20} />
        </button>
      </Tip>
    );

  return (
    <div className="voice-rec" role="group" aria-label="Recording a voice message">
      <Tip label="Cancel voice message">
        <button className="icon-btn" aria-label="Cancel voice message" onClick={() => stopAll(rec, false)}>
          <Trash2 size={18} />
        </button>
      </Tip>
      <span className="rec-dot" aria-hidden="true" />
      <span className="rec-time" aria-live="off">
        {fmt(secs)}
      </span>
      <span className="rec-label">Recording… {MAX_SECONDS - secs < 30 ? `${Math.ceil(MAX_SECONDS - secs)}s left` : ""}</span>
      <button className="send-btn" aria-label="Send voice message" onClick={() => stopAll(rec, true)}>
        <SendHorizontal size={18} />
      </button>
    </div>
  );
}
