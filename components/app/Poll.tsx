"use client";

import { useState } from "react";
import { BarChart3, Check, Plus, X } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { set, toast, useStore } from "@/lib/client/store";
import { play } from "@/lib/client/sounds";
import type { Message, Poll } from "@/lib/types";
import { Modal } from "../ui/Modal";
import { Switch } from "../ui/Switch";

export function PollCard({ m, poll }: { m: Message; poll: Poll }) {
  const me = useStore((s) => s.me?.id ?? "");
  const [busy, setBusy] = useState(false);
  const mine = poll.options.map((o, i) => (o.voterIds.includes(me) ? i : -1)).filter((i) => i >= 0);
  const voters = new Set(poll.options.flatMap((o) => o.voterIds));
  const total = poll.options.reduce((a, o) => a + o.voterIds.length, 0);
  const vote = async (i: number) => {
    if (m.id.startsWith("pending-")) return;
    const next = mine.includes(i) ? mine.filter((x) => x !== i) : poll.multi ? [...mine, i] : [i];
    setBusy(true);
    try {
      await api.put(`messages/${m.id}/poll`, { options: next });
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="poll" role="group" aria-label={`Poll: ${poll.question}`}>
      <div className="poll-q">{poll.question}</div>
      <div className="poll-sub">{poll.multi ? "Pick as many as you like" : "Pick one"}</div>
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((o.voterIds.length / total) * 100) : 0;
        const on = mine.includes(i);
        return (
          <button key={i} className={`poll-opt${on ? " on" : ""}`} onClick={() => void vote(i)} disabled={busy} aria-pressed={on}>
            <span className="poll-bar" style={{ width: `${mine.length ? pct : 0}%` }} />
            <span className="poll-check">{on && <Check size={13} />}</span>
            <span className="poll-text">{o.text}</span>
            {mine.length > 0 && (
              <span className="poll-pct">
                {o.voterIds.length} · {pct}%
              </span>
            )}
          </button>
        );
      })}
      <div className="poll-sub" style={{ marginTop: 8 }}>
        {voters.size} {voters.size === 1 ? "person" : "people"} voted{mine.length ? "" : " · vote to see results"}
      </div>
    </div>
  );
}

export function CreatePollModal({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = question.trim() && options.filter((o) => o.trim()).length >= 2;
  const post = async () => {
    setBusy(true);
    try {
      await api.post(`channels/${channelId}/polls`, { question, options, multi });
      play("send");
      set((s) => ({ readStates: { ...s.readStates } }));
      onClose();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };
  return (
    <Modal
      onClose={onClose}
      title="Create a poll"
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={!ready || busy} onClick={() => void post()}>
            <BarChart3 size={16} /> Post poll
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="poll-q">Question</label>
          <input id="poll-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="What should we play tonight?" autoFocus />
        </div>
        <div className="label" style={{ marginBottom: 6 }}>
          Answers
        </div>
        {options.map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              className="input"
              value={o}
              maxLength={80}
              aria-label={`Answer ${i + 1}`}
              placeholder={`Answer ${i + 1}`}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {options.length > 2 && (
              <button className="icon-btn" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {options.length < 10 && (
          <button className="btn small secondary" onClick={() => setOptions([...options, ""])}>
            <Plus size={15} /> Add another
          </button>
        )}
        <div className="toggle-row" style={{ marginTop: 10 }}>
          <div className="t-title">Allow several answers</div>
          <Switch checked={multi} onChange={setMulti} label="Allow several answers" />
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
    </Modal>
  );
}
