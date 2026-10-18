"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Search } from "lucide-react";
import { ALL_EMOJI, EMOJI_CATEGORIES, pushRecentEmoji, recentEmoji } from "@/lib/client/emoji";

interface PickerState {
  open: boolean;
  x: number;
  y: number;
  above: boolean;
  keepOpen: boolean;
  onPick: ((e: string) => void) | null;
}

const usePicker = create<PickerState>(() => ({ open: false, x: 0, y: 0, above: false, keepOpen: false, onPick: null }));

/** Open the picker next to `anchor`. `keepOpen` keeps it open after a pick (composer). */
export function openEmojiPicker(anchor: HTMLElement, onPick: (e: string) => void, keepOpen = false) {
  const r = anchor.getBoundingClientRect();
  const above = r.top > 420;
  usePicker.setState({
    open: true,
    x: Math.max(12, Math.min(r.right - 344, window.innerWidth - 356)),
    y: above ? r.top - 8 : r.bottom + 8,
    above,
    keepOpen,
    onPick,
  });
}

export function closeEmojiPicker() {
  usePicker.setState({ open: false, onPick: null });
}

export function EmojiPicker() {
  const { open, x, y, above, keepOpen, onPick } = usePicker();
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<{ e: string; n: string } | null>(null);
  const [tab, setTab] = useState("recent");
  const ref = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (open) {
      setQ("");
      setRecent(recentEmoji());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeEmojiPicker();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeEmojiPicker();
      }
    };
    setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return ALL_EMOJI.filter((e) => e.n.includes(t)).slice(0, 120);
  }, [q]);

  if (!open) return null;

  const pick = (e: string) => {
    pushRecentEmoji(e);
    onPick?.(e);
    if (!keepOpen) closeEmojiPicker();
    else setRecent(recentEmoji());
  };

  const cell = (e: { e: string; n: string }) => (
    <button key={e.e} className="emoji-cell" onClick={() => pick(e.e)} onMouseEnter={() => setHover(e)} onFocus={() => setHover(e)} aria-label={e.n.split(" ")[0]} title={e.n.split(" ")[0]}>
      {e.e}
    </button>
  );

  const recents = recent.map((e) => ALL_EMOJI.find((x) => x.e === e) ?? { e, n: "recent" });

  return (
    <div
      ref={ref}
      className="emoji-picker"
      role="dialog"
      aria-label="Emoji picker"
      style={{ left: x, top: above ? undefined : y, bottom: above ? window.innerHeight - y : undefined }}
    >
      <div className="ep-search">
        <div className="prefixed-input">
          <span>
            <Search size={15} />
          </span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find the perfect emoji" aria-label="Search emoji" />
        </div>
      </div>
      {!results && (
        <div className="ep-tabs" role="tablist">
          {recents.length > 0 && (
            <button role="tab" aria-selected={tab === "recent"} aria-label="Recent" onClick={() => {
              setTab("recent");
              gridRef.current?.querySelector("#ep-recent")?.scrollIntoView();
            }}>
              🕘
            </button>
          )}
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={tab === c.key}
              aria-label={c.label}
              onClick={() => {
                setTab(c.key);
                gridRef.current?.querySelector(`#ep-${c.key}`)?.scrollIntoView();
              }}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}
      <div className="ep-grid" ref={gridRef}>
        {results ? (
          results.length ? (
            <div className="ep-cells">{results.map(cell)}</div>
          ) : (
            <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40 }}>No emoji match “{q}”.</p>
          )
        ) : (
          <>
            {recents.length > 0 && (
              <>
                <div className="ep-cat" id="ep-recent">
                  Frequently used
                </div>
                <div className="ep-cells">{recents.map(cell)}</div>
              </>
            )}
            {EMOJI_CATEGORIES.map((c) => (
              <div key={c.key}>
                <div className="ep-cat" id={`ep-${c.key}`}>
                  {c.label}
                </div>
                <div className="ep-cells">{c.items.map(cell)}</div>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="ep-foot">
        {hover ? (
          <>
            <span className="big">{hover.e}</span> :{hover.n.split(" ")[0].replace(/\s/g, "_")}:
          </>
        ) : (
          "Pick an emoji"
        )}
      </div>
    </div>
  );
}
