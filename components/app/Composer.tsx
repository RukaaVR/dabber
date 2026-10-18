"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, PlusCircle, SendHorizontal, Smile, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { get, set, toast, useStore, type State } from "@/lib/client/store";
import { sendMessage } from "@/lib/client/actions";
import { emitTyping } from "@/lib/client/socket";
import { displayName } from "@/lib/client/selectors";
import { plainText } from "@/lib/client/markdown";
import { openEmojiPicker } from "../overlays/EmojiPicker";
import { fromEditable, fmtSize } from "./MessageItem";
import { UserAvatar } from "../ui/Avatar";
import { VoiceRecorder } from "./VoiceRecorder";
import { CreatePollModal } from "./Poll";
import { Tip } from "../ui/Tip";
import { LIMITS } from "@/lib/types";

export interface Pending {
  file: File;
  url: string | null;
}

export function Composer({
  channelId,
  serverId,
  placeholder,
  candidates,
  canSend,
  canAttach,
  canMentionEveryone,
  lockedReason,
  files,
  setFiles,
}: {
  channelId: string;
  serverId: string | null;
  placeholder: string;
  candidates: string[];
  canSend: boolean;
  canAttach: boolean;
  canMentionEveryone: boolean;
  lockedReason?: string;
  files: Pending[];
  setFiles: (f: Pending[] | ((p: Pending[]) => Pending[])) => void;
}) {
  const [text, setText] = useState(() => get().drafts[channelId] ?? "");
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const [sel, setSel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const reply = useStore((s) => s.replyTo[channelId] ?? null);
  const replyName = useStore((s) => (reply ? displayName(s, reply.authorId, serverId) : ""));
  const users = useStore((s) => s.users);
  const typingNames = useStore(
    useShallow((s: State) =>
      Object.keys(s.typing[channelId] ?? {})
        .filter((id) => id !== s.me?.id)
        .map((id) => displayName(s, id, serverId)),
    ),
  );

  // persist drafts per channel
  useEffect(() => {
    const t = setTimeout(() => set((s) => ({ drafts: { ...s.drafts, [channelId]: text } })), 250);
    return () => clearTimeout(t);
  }, [text, channelId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
  }, [text]);

  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) ref.current?.focus();
  }, [channelId]);

  const options = useMemo(() => {
    if (!mention) return [];
    const q = mention.q.toLowerCase();
    const list = candidates
      .map((id) => users[id])
      .filter(Boolean)
      .filter((u) => u.username.toLowerCase().startsWith(q) || u.displayName.toLowerCase().includes(q))
      .slice(0, 8)
      .map((u) => ({ id: u.id, label: u.displayName, sub: `@${u.username}`, insert: `@${u.username} ` }));
    if (canMentionEveryone && serverId)
      for (const k of ["everyone", "here"]) if (k.startsWith(q)) list.push({ id: k, label: `@${k}`, sub: k === "everyone" ? "Notify everyone in this channel" : "Notify everyone online", insert: `@${k} ` });
    return list;
  }, [mention, candidates, users, canMentionEveryone, serverId]);

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@([\w.]{0,32})$/);
    if (m) {
      setMention({ q: m[2], start: caret - m[2].length - 1 });
      setSel(0);
    } else setMention(null);
  };

  const pick = (insert: string) => {
    if (!mention) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const next = text.slice(0, mention.start) + insert + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + insert.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const addFiles = (list: FileList | File[]) => {
    if (!canAttach) {
      toast("You can’t upload files here.", "error");
      return;
    }
    const arr = [...list];
    const big = arr.find((f) => f.size > LIMITS.attachmentBytes);
    if (big) {
      toast(`${big.name} is too big. Files can be up to 10 MB.`, "error");
      return;
    }
    setFiles((prev) => {
      const next = [...prev, ...arr.map((f) => ({ file: f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null }))];
      if (next.length > LIMITS.attachmentsPerMessage) toast(`Up to ${LIMITS.attachmentsPerMessage} files per message.`, "error");
      return next.slice(0, LIMITS.attachmentsPerMessage);
    });
  };

  const submit = () => {
    const t = text.trim();
    if (!t && !files.length) return;
    if (t.length > LIMITS.messageLength) {
      toast(`Messages can be at most ${LIMITS.messageLength} characters. Yours is ${t.length}.`, "error");
      return;
    }
    const content = fromEditable(t, candidates);
    void sendMessage(
      channelId,
      content,
      files.map((f) => f.file),
    );
    setText("");
    setFiles([]);
    setMention(null);
    set((s) => ({ drafts: { ...s.drafts, [channelId]: "" } }));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && options.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((i) => (i + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((i) => (i - 1 + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(options[sel].insert);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "Escape" && reply) {
      set((s) => ({ replyTo: { ...s.replyTo, [channelId]: null } }));
      return;
    }
    if (e.key === "ArrowUp" && !text) {
      const s = get();
      const mine = [...(s.messages[channelId]?.list ?? [])].reverse().find((m) => m.authorId === s.me?.id && m.type === "default" && !m.id.startsWith("pending-") && !m.id.startsWith("failed-"));
      if (mine) {
        e.preventDefault();
        set({ editing: mine.id });
      }
    }
  };

  const typingText =
    typingNames.length === 0
      ? null
      : typingNames.length === 1
        ? (
            <>
              <b>{typingNames[0]}</b> is typing…
            </>
          )
        : typingNames.length <= 3
          ? (
              <>
                <b>{typingNames.slice(0, -1).join(", ")}</b> and <b>{typingNames[typingNames.length - 1]}</b> are typing…
              </>
            )
          : "Several people are typing…";

  if (!canSend)
    return (
      <div className="composer">
        <div className="composer-locked">{lockedReason ?? "You can’t send messages in this channel."}</div>
        <div style={{ height: 0 }} />
      </div>
    );

  return (
    <div className={`composer${reply ? " has-bar" : ""}`}>
      {mention && options.length > 0 && (
        <div className="mention-menu" role="listbox" aria-label="Mention someone">
          <div className="mm-title">Members{mention.q ? ` matching @${mention.q}` : ""}</div>
          {options.map((o, i) => (
            <button
              key={o.id}
              role="option"
              aria-selected={i === sel}
              onMouseEnter={() => setSel(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o.insert);
              }}
            >
              {o.id === "everyone" || o.id === "here" ? <span style={{ width: 24, textAlign: "center" }}>@</span> : <UserAvatar userId={o.id} size={24} />}
              <span style={{ fontWeight: 600 }}>{o.label}</span>
              <span className="mm-sub">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
      {reply && (
        <div className="reply-bar">
          <span className="grow">
            Replying to <b>{replyName}</b>
            <span style={{ marginLeft: 8, color: "var(--text-faint)" }}>{plainText(reply.content, (id) => displayName(get(), id, serverId)).slice(0, 80)}</span>
          </span>
          <Tip label="Cancel reply">
            <button className="icon-btn sm" aria-label="Cancel reply" onClick={() => set((s) => ({ replyTo: { ...s.replyTo, [channelId]: null } }))}>
              <X size={16} />
            </button>
          </Tip>
        </div>
      )}
      {files.length > 0 && (
        <div className="upload-strip" aria-label="Attachments">
          {files.map((f, i) => (
            <div key={i} className="upload-tile">
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ut-thumb" src={f.url} alt="" />
              ) : (
                <div className="ut-thumb">
                  <FileText size={30} />
                </div>
              )}
              <div className="ut-name" title={f.file.name}>
                {f.file.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{fmtSize(f.file.size)}</div>
              <button
                className="ut-remove"
                aria-label={`Remove ${f.file.name}`}
                onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="composer-box">
        {!recording && (
          <Tip label="Upload or create">
            <button
              className="icon-btn"
              aria-label="Upload or create"
              aria-haspopup="menu"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                set({
                  ctx: {
                    x: r.left,
                    y: r.top - 8,
                    items: [
                      ...(canAttach ? [{ label: "📎  Upload a file", onClick: () => fileRef.current?.click() }] : []),
                      { label: "📊  Create a poll", onClick: () => setPollOpen(true) },
                    ],
                  },
                });
              }}
            >
              <PlusCircle size={21} />
            </button>
          </Tip>
        )}
        {canAttach && (
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            aria-label="Upload a file"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        )}
        <textarea
          hidden={recording}
          ref={ref}
          value={text}
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={LIMITS.messageLength + 200}
          onChange={(e) => {
            setText(e.target.value);
            detectMention(e.target.value, e.target.selectionStart);
            const now = Date.now();
            if (e.target.value && now - lastTyping.current > 3000) {
              lastTyping.current = now;
              emitTyping(channelId);
            }
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => detectMention(text, e.currentTarget.selectionStart)}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          onPaste={(e) => {
            const fl = e.clipboardData.files;
            if (fl.length) {
              e.preventDefault();
              addFiles(fl);
            }
          }}
        />
        {!recording && text.length > LIMITS.messageLength - 200 && (
          <span className={`char-count${text.trim().length > LIMITS.messageLength ? " over" : ""}`} aria-live="polite">
            {LIMITS.messageLength - text.trim().length}
          </span>
        )}
        {!recording && (
          <Tip label="Emoji">
            <button
              className="icon-btn"
              aria-label="Emoji"
              onClick={(e) =>
                openEmojiPicker(
                  e.currentTarget,
                  (emoji) => {
                    const el = ref.current;
                    const pos = el?.selectionStart ?? text.length;
                    const next = text.slice(0, pos) + emoji + text.slice(pos);
                    setText(next);
                    requestAnimationFrame(() => {
                      el?.focus();
                      el?.setSelectionRange(pos + emoji.length, pos + emoji.length);
                    });
                  },
                  true,
                )
              }
            >
              <Smile size={20} />
            </button>
          </Tip>
        )}
        {canAttach && !text.trim() && !files.length ? (
          <VoiceRecorder
            onActive={setRecording}
            onSend={(f) => {
              void sendMessage(channelId, "", [f]);
            }}
          />
        ) : (
          <button className="send-btn" aria-label="Send" disabled={!text.trim() && !files.length} onClick={submit}>
            <SendHorizontal size={18} />
          </button>
        )}
      </div>
      {pollOpen && <CreatePollModal channelId={channelId} onClose={() => setPollOpen(false)} />}
      <div className="typing-line" aria-live="polite">
        {typingText && (
          <>
            <span className="typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{typingText}</span>
          </>
        )}
      </div>
    </div>
  );
}
