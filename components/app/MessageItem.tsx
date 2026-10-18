"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Pencil, Reply, SmilePlus, MoreHorizontal, Trash2, PhoneCall, Pin, UserPlus, LogOut, Sparkles, FileText, Download, RotateCcw } from "lucide-react";
import { get, set, useStore } from "@/lib/client/store";
import { displayName, roleColor } from "@/lib/client/selectors";
import { Markdown, isJumbo, plainText } from "@/lib/client/markdown";
import { copy, deleteMessage, discardFailed, editMessage, setPinned, toggleReaction } from "@/lib/client/actions";
import { QUICK_REACTIONS } from "@/lib/client/emoji";
import { UserAvatar } from "../ui/Avatar";
import { Tip } from "../ui/Tip";
import { openProfile } from "../overlays/ProfileCard";
import { openEmojiPicker } from "../overlays/EmojiPicker";
import type { Message } from "@/lib/types";

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtStamp(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  const t = fmtTime(ts);
  if (d.toDateString() === now.toDateString()) return `Today at ${t}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday at ${t}`;
  return `${d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" })} ${t}`;
}

export function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** `<@id>` → `@username` for editing, and back on save. */
export function toEditable(content: string) {
  const users = get().users;
  return content.replace(/<@([a-z0-9]{16})>/g, (m, id) => (users[id] ? `@${users[id].username}` : m));
}

export function fromEditable(text: string, candidates: string[]) {
  const users = get().users;
  const byName = new Map<string, string>();
  for (const id of candidates) {
    const u = users[id];
    if (u) byName.set(u.username.toLowerCase(), id);
  }
  return text.replace(/(^|[^\w<])@([a-z0-9_.]{2,32})/gi, (m, pre: string, name: string) => {
    const id = byName.get(name.toLowerCase());
    return id ? `${pre}<@${id}>` : m;
  });
}

function Editor({ m, candidates, onDone }: { m: Message; candidates: string[]; onDone: () => void }) {
  const [text, setText] = useState(() => toEditable(m.content));
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [text]);
  const save = async () => {
    const t = text.trim();
    if (t === toEditable(m.content).trim()) return onDone();
    if (!t && !m.attachments.length) {
      onDone();
      set({ modal: { kind: "confirm", title: "Delete message", body: "Saving an empty message deletes it. Delete it?", confirm: "Delete", danger: true, onConfirm: () => deleteMessage(m) } });
      return;
    }
    try {
      await editMessage(m.id, fromEditable(t, candidates));
      onDone();
    } catch {
      /* toast shown */
    }
  };
  return (
    <div className="msg-editor">
      <textarea
        ref={ref}
        value={text}
        rows={1}
        aria-label="Edit message"
        maxLength={4000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onDone();
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
      />
      <div className="msg-editor-hint">
        escape to <button onClick={onDone}>cancel</button> • enter to <button onClick={() => void save()}>save</button>
      </div>
    </div>
  );
}

function Attachments({ m }: { m: Message }) {
  if (!m.attachments.length) return null;
  return (
    <div className="msg-attachments">
      {m.attachments.map((a) => {
        if (a.mime.startsWith("image/") && a.url)
          return (
            <button key={a.id} className="msg-img" onClick={() => set({ lightbox: { url: a.url, name: a.filename, mime: a.mime } })} aria-label={`Open picture ${a.filename}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.filename} loading="lazy" />
            </button>
          );
        if (a.mime.startsWith("video/") && a.url)
          return (
            <div key={a.id} className="msg-img" style={{ cursor: "default" }}>
              <video src={a.url} controls preload="metadata" />
            </div>
          );
        if (a.mime.startsWith("audio/") && a.url)
          return (
            <div key={a.id} className="msg-file" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className="f-name">{a.filename}</div>
              <audio src={a.url} controls preload="metadata" style={{ width: "100%" }} />
            </div>
          );
        return (
          <div key={a.id} className="msg-file">
            <FileText size={28} style={{ color: "var(--accent-text)", flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="f-name">{a.filename}</div>
              <div className="f-size">{fmtSize(a.size)}</div>
            </div>
            {a.url && (
              <a className="icon-btn" href={a.url} download={a.filename} aria-label={`Download ${a.filename}`}>
                <Download size={18} />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Reactions({ m, canReact }: { m: Message; canReact: boolean }) {
  const users = useStore((s) => s.users);
  if (!m.reactions.length) return null;
  return (
    <div className="reactions">
      {m.reactions.map((r) => {
        const who = r.userIds
          .slice(0, 3)
          .map((id) => users[id]?.displayName ?? "someone")
          .join(", ");
        const more = r.count > 3 ? ` and ${r.count - 3} more` : "";
        return (
          <Tip key={r.emoji} label={`${who}${more} reacted with ${r.emoji}`}>
            <button className={`reaction${r.me ? " me" : ""}`} onClick={() => canReact && void toggleReaction(m, r.emoji)} aria-pressed={r.me} aria-label={`${r.emoji} ${r.count}`}>
              <span>{r.emoji}</span>
              <span className="r-count">{r.count}</span>
            </button>
          </Tip>
        );
      })}
      {canReact && (
        <button
          className="reaction add"
          aria-label="Add reaction"
          onClick={(e) => openEmojiPicker(e.currentTarget, (emoji) => void toggleReaction({ ...m, reactions: m.reactions }, emoji))}
        >
          <SmilePlus size={15} />
        </button>
      )}
    </div>
  );
}

const SYSTEM_TEXT: Record<string, string> = {
  join: "joined the server. Say hi! 👋",
  call: "started a call.",
};

export interface ItemProps {
  m: Message;
  grouped: boolean;
  serverId: string | null;
  canManage: boolean;
  canReact: boolean;
  canPin: boolean;
  candidates: string[];
  flash?: boolean;
  onJump?: (id: string) => void;
}

function MessageItemInner({ m, grouped, serverId, canManage, canReact, canPin, candidates, flash, onJump }: ItemProps) {
  const me = useStore((s) => s.me?.id);
  const name = useStore((s) => displayName(s, m.authorId, serverId));
  const color = useStore((s) => roleColor(s, serverId, m.authorId));
  const replyName = useStore((s) => (m.replyTo ? displayName(s, m.replyTo.authorId, serverId) : ""));
  const blocked = useStore((s) => (m.authorId ? s.relationships[m.authorId]?.type === "blocked" : false));
  const editing = useStore((s) => s.editing === m.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const mine = m.authorId === me;
  const pending = m.id.startsWith("pending-");
  const failed = m.id.startsWith("failed-");
  const mentioned = !!me && !mine && (m.mentions.includes(me) || m.mentionEveryone);
  const mentionName = (id: string) => displayName(get(), id, serverId);
  const ctx = {
    mentionName,
    onMention: (id: string, el: HTMLElement) => openProfile(id, serverId, el),
  };

  if (m.type !== "default") {
    let content: React.ReactNode = SYSTEM_TEXT[m.type] ?? "";
    let Icon = Sparkles;
    if (m.type === "join") Icon = UserPlus;
    if (m.type === "call") Icon = PhoneCall;
    if (m.type === "pin") {
      Icon = Pin;
      content = (
        <>
          pinned{" "}
          <button className="btn link" onClick={() => onJump?.(m.content)}>
            a message
          </button>{" "}
          to this channel. See all{" "}
          <button className="btn link" onClick={() => set({ panel: "pins" })}>
            pinned messages
          </button>
          .
        </>
      );
    }
    if (m.type === "system") {
      Icon = /left/.test(m.content) ? LogOut : Sparkles;
      content = <Markdown text={m.content} ctx={ctx} />;
    }
    return (
      <div className="msg system" data-mid={m.id}>
        <div className="msg-gutter">
          <span className="sys-icon">
            <Icon size={16} />
          </span>
        </div>
        <div className="msg-body">
          <b role="button" tabIndex={0} onClick={(e) => m.authorId && openProfile(m.authorId, serverId, e.currentTarget)} style={{ color }}>
            {name}
          </b>{" "}
          {content}
          <span className="msg-time">{fmtStamp(m.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (blocked && !showBlocked) {
    return (
      <div className="msg system" data-mid={m.id}>
        <div className="msg-gutter" />
        <div className="msg-body" style={{ color: "var(--text-faint)" }}>
          Blocked message —{" "}
          <button className="btn link" onClick={() => setShowBlocked(true)}>
            Show
          </button>
        </div>
      </div>
    );
  }

  const openMenu = (x: number, y: number) => {
    setMenuOpen(true);
    set({
      ctx: {
        x,
        y,
        items: [
          ...(canReact ? [{ label: "", quick: QUICK_REACTIONS.slice(0, 5), onQuick: (e: string) => void toggleReaction(m, e) }] : []),
          ...(canReact
            ? [
                {
                  label: "Add reaction",
                  onClick: () => {
                    const el = document.querySelector<HTMLElement>(`[data-mid="${m.id}"]`);
                    if (el) openEmojiPicker(el, (emoji) => void toggleReaction(m, emoji));
                  },
                },
              ]
            : []),
          ...(mine ? [{ label: "Edit message", onClick: () => set({ editing: m.id }) }] : []),
          { label: "Reply", onClick: () => startReply(m) },
          ...(canPin ? [{ label: m.pinned ? "Unpin message" : "Pin message", onClick: () => void setPinned(m, !m.pinned) }] : []),
          { label: "Copy text", onClick: () => copy(plainText(m.content, mentionName), "Text copied") },
          { label: "Copy message ID", onClick: () => copy(m.id, "Message ID copied") },
          ...(mine || canManage ? [{ sep: true, label: "" }, { label: "Delete message", danger: true, onClick: () => confirmDelete(m) }] : []),
        ],
      },
    });
    const unsub = useStore.subscribe((s) => {
      if (!s.ctx) {
        setMenuOpen(false);
        unsub();
      }
    });
  };

  const jumbo = isJumbo(m.content);

  return (
    <div
      className={`msg${grouped ? " grouped" : ""}${menuOpen ? " menu-open" : ""}${editing ? " editing" : ""}${mentioned ? " mentioned" : ""}${pending ? " pending" : ""}${failed ? " failed" : ""}${flash ? " flash" : ""}`}
      data-mid={m.id}
      onContextMenu={(e) => {
        if (pending || failed || editing) return;
        if ((e.target as HTMLElement).closest("a, textarea")) return;
        e.preventDefault();
        openMenu(e.clientX, e.clientY);
      }}
    >
      <div className="msg-gutter">
        {grouped ? (
          <span className="msg-hover-time" title={fmtStamp(m.createdAt)}>
            {fmtTime(m.createdAt)}
          </span>
        ) : (
          <button onClick={(e) => m.authorId && openProfile(m.authorId, serverId, e.currentTarget)} aria-label={`${name}'s profile`} style={{ height: 40 }}>
            <UserAvatar userId={m.authorId} size={40} />
          </button>
        )}
      </div>
      <div className="msg-body">
        {!grouped && m.replyTo && (
          <div
            className="msg-reply"
            role="button"
            tabIndex={0}
            onClick={() => m.replyTo && !m.replyTo.deleted && onJump?.(m.replyTo.id)}
            onKeyDown={(e) => e.key === "Enter" && m.replyTo && !m.replyTo.deleted && onJump?.(m.replyTo.id)}
          >
            {m.replyTo.deleted ? (
              <span className="reply-text" style={{ fontStyle: "italic" }}>
                Original message was deleted
              </span>
            ) : (
              <>
                <UserAvatar userId={m.replyTo.authorId} size={16} />
                <span className="reply-name">@{replyName}</span>
                <span className="reply-text">{plainText(m.replyTo.content, mentionName) || (m.replyTo.hasAttachments ? "Click to see attachment" : "")}</span>
              </>
            )}
          </div>
        )}
        {!grouped && (
          <div className="msg-head">
            <span
              className="msg-author"
              style={{ color }}
              role="button"
              tabIndex={0}
              onClick={(e) => m.authorId && openProfile(m.authorId, serverId, e.currentTarget)}
              onKeyDown={(e) => e.key === "Enter" && m.authorId && openProfile(m.authorId, serverId, e.currentTarget)}
            >
              {name}
            </span>
            <time className="msg-time" dateTime={new Date(m.createdAt).toISOString()}>
              {fmtStamp(m.createdAt)}
            </time>
          </div>
        )}
        {editing ? (
          <Editor m={m} candidates={candidates} onDone={() => set({ editing: null })} />
        ) : (
          m.content && (
            <div className={`msg-text${jumbo ? " jumbo" : ""}`}>
              <Markdown text={m.content} ctx={ctx} />
              {m.editedAt && (
                <span className="msg-edited" title={fmtStamp(m.editedAt)}>
                  (edited)
                </span>
              )}
            </div>
          )
        )}
        <Attachments m={m} />
        {failed && (
          <div style={{ fontSize: 13, color: "var(--danger)", marginTop: 2, display: "flex", gap: 10 }}>
            Didn’t send.
            <button className="btn link" onClick={() => discardFailed(m.channelId, m.id)}>
              Dismiss
            </button>
          </div>
        )}
        <Reactions m={m} canReact={canReact && !pending && !failed} />
      </div>
      {!pending && !failed && !editing && (
        <div className="msg-actions" role="toolbar" aria-label="Message actions">
          {canReact &&
            QUICK_REACTIONS.slice(0, 3).map((e) => (
              <Tip key={e} label={`React ${e}`}>
                <button className="icon-btn quick" onClick={() => void toggleReaction(m, e)} aria-label={`React with ${e}`}>
                  {e}
                </button>
              </Tip>
            ))}
          {canReact && (
            <Tip label="Add reaction">
              <button className="icon-btn" aria-label="Add reaction" onClick={(e) => openEmojiPicker(e.currentTarget, (emoji) => void toggleReaction(m, emoji))}>
                <SmilePlus size={18} />
              </button>
            </Tip>
          )}
          {mine ? (
            <Tip label="Edit">
              <button className="icon-btn" aria-label="Edit" onClick={() => set({ editing: m.id })}>
                <Pencil size={17} />
              </button>
            </Tip>
          ) : (
            <Tip label="Reply">
              <button className="icon-btn" aria-label="Reply" onClick={() => startReply(m)}>
                <Reply size={18} />
              </button>
            </Tip>
          )}
          {(mine || canManage) && (
            <Tip label="Delete (shift-click skips the check)">
              <button
                className="icon-btn"
                aria-label="Delete message"
                onClick={(e) => (e.shiftKey ? void deleteMessage(m) : confirmDelete(m))}
              >
                <Trash2 size={17} />
              </button>
            </Tip>
          )}
          <Tip label="More">
            <button
              className="icon-btn"
              aria-label="More"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openMenu(r.left - 170, r.bottom + 4);
              }}
            >
              <MoreHorizontal size={18} />
            </button>
          </Tip>
        </div>
      )}
      {failed && (
        <div className="msg-actions" style={{ display: "flex" }}>
          <Tip label="Dismiss">
            <button className="icon-btn" aria-label="Dismiss failed message" onClick={() => discardFailed(m.channelId, m.id)}>
              <RotateCcw size={17} />
            </button>
          </Tip>
        </div>
      )}
    </div>
  );
}

export const MessageItem = memo(MessageItemInner);

export function startReply(m: Message) {
  set((s) => ({ replyTo: { ...s.replyTo, [m.channelId]: m } }));
  setTimeout(() => document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(), 0);
}

export function confirmDelete(m: Message) {
  set({
    modal: {
      kind: "confirm",
      title: "Delete message",
      body: "Are you sure you want to delete this message? Tip: hold Shift when clicking the trash can to skip this.",
      confirm: "Delete",
      danger: true,
      onConfirm: () => deleteMessage(m),
    },
  });
}
