"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Hash, Phone, Pin, Search, UserPlus, Users, X, Settings as Cog, Upload } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { get, set, setPrefs, useStore, type State } from "@/lib/client/store";
import { channelLabel, statusLabel } from "@/lib/client/selectors";
import { loadMembers } from "@/lib/client/actions";
import { setActiveChannel } from "@/lib/client/socket";
import { joinVoice } from "@/lib/client/voice";
import { href, useNav } from "@/lib/client/route";
import { Perm, hasPerm, type Channel } from "@/lib/types";
import { MessageList, ChannelStart } from "./MessageList";
import { Composer, type Pending } from "./Composer";
import { MembersList, GroupMembers } from "./MembersList";
import { SidePanel } from "./SidePanels";
import { VoiceView, DmCall } from "./VoiceView";
import { BackButton } from "./BackButton";
import { ServerIcon, UserAvatar } from "../ui/Avatar";
import { Empty } from "../ui/Empty";
import { Tip } from "../ui/Tip";
import { blockFlow, removeFriendFlow, sendFriendRequest, unblock } from "./serverFlows";

function DmStart({ c }: { c: Channel }) {
  const other = useStore((s) => (c.type === "dm" ? s.users[c.recipients?.[0] ?? ""] : undefined));
  const rel = useStore((s) => (other ? s.relationships[other.id]?.type : undefined));
  const label = useStore((s) => channelLabel(s, c));
  if (c.type === "group")
    return (
      <div className="chat-start">
        <ServerIcon name={label} icon={c.icon} size={80} radius="50%" seed={c.id} />
        <h1>{label}</h1>
        <p>
          Welcome to the beginning of the <b>{label}</b> group.
        </p>
      </div>
    );
  if (!other) return null;
  return (
    <div className="chat-start">
      <UserAvatar userId={other.id} size={80} />
      <h1>{other.displayName}</h1>
      <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>{other.username}</p>
      <p style={{ marginTop: 8 }}>
        This is the beginning of your direct message history with <b>{other.displayName}</b>.
      </p>
      <div className="start-actions">
        {rel === "friends" && (
          <button className="btn small secondary" onClick={() => removeFriendFlow(other.id)}>
            Remove Friend
          </button>
        )}
        {(!rel || rel === "incoming") && (
          <button className="btn small" onClick={() => void sendFriendRequest(other.id)}>
            {rel === "incoming" ? "Accept Friend Request" : "Add Friend"}
          </button>
        )}
        {rel === "outgoing" && (
          <button className="btn small secondary" disabled>
            Friend Request Sent
          </button>
        )}
        {rel === "blocked" ? (
          <button className="btn small secondary" onClick={() => void unblock(other.id)}>
            Unblock
          </button>
        ) : (
          <button className="btn small secondary" onClick={() => blockFlow(other.id)}>
            Block
          </button>
        )}
      </div>
    </div>
  );
}

function HeadSearch({ channelId }: { channelId: string }) {
  const panel = useStore((s) => s.panel);
  const [q, setQ] = useState("");
  return (
    <form
      className="head-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        set({ panel: "search", searchQuery: q.trim() });
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search… try from:name"
        aria-label="Search messages"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            if (panel === "search") set({ panel: null });
          }
        }}
        data-channel={channelId}
      />
      {q ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQ("");
            if (panel === "search") set({ panel: null });
          }}
          style={{ display: "grid" }}
        >
          <X size={15} />
        </button>
      ) : (
        <Search size={15} />
      )}
    </form>
  );
}

export function ChatView({ channelId }: { channelId: string }) {
  const c = useStore((s) => s.channels[channelId]);
  const label = useStore((s) => channelLabel(s, s.channels[channelId]));
  const me = useStore((s) => s.me);
  const membersOpen = useStore((s) => s.membersOpen);
  const panel = useStore((s) => s.panel);
  const pinsCount = useStore((s) => (s.messages[channelId]?.list ?? []).filter((m) => m.pinned).length);
  const mentionTotal = useStore((s) => Object.values(s.mentionCounts).reduce((a, b) => a + b, 0));
  const other = useStore((s) => (c?.type === "dm" ? s.users[c.recipients?.[0] ?? ""] : undefined));
  const blocked = useStore((s) => (other ? s.relationships[other.id]?.type === "blocked" : false));
  const inCallHere = useStore((s) => Object.values(s.voiceStates).some((v) => v.channelId === channelId));
  const myCall = useStore((s) => s.voice.channelId === channelId);
  const serverId = c?.serverId ?? null;
  const perms = useStore((s) => (serverId ? (s.servers[serverId]?.myPermissions ?? 0) : null));
  const memberIds = useStore(useShallow((s: State) => (serverId ? Object.keys(s.members[serverId] ?? {}) : (c?.recipients ?? []))));
  const nav = useNav();
  const [files, setFiles] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    setActiveChannel(channelId);
    if (serverId) {
      void loadMembers(serverId);
      setPrefs({ lastChannel: { ...get().prefs.lastChannel, [serverId]: channelId } });
    }
    set({ panel: null, editing: null });
    return () => setActiveChannel(null);
  }, [channelId, serverId]);

  const candidates = useMemo(() => [...new Set([...memberIds, ...(me ? [me.id] : [])])].filter((id) => id !== me?.id), [memberIds, me]);

  if (!c)
    return (
      <>
        <header className="main-head">
          <BackButton />
        </header>
        <Empty
          art="lost"
          title="Nothing here"
          action={
            <button className="btn" onClick={() => nav(href.home())}>
              Go home
            </button>
          }
        >
          This channel doesn’t exist, or you can’t see it anymore.
        </Empty>
      </>
    );

  if (c.type === "voice") return <VoiceView channel={c} />;

  const isDm = c.type === "dm" || c.type === "group";
  const p = isDm ? Perm.SEND_MESSAGES | Perm.ATTACH_FILES | Perm.ADD_REACTIONS | Perm.MENTION_EVERYONE : (perms ?? 0);
  const canSend = hasPerm(p, Perm.SEND_MESSAGES) && !blocked;
  const canPin = isDm || hasPerm(p, Perm.MANAGE_MESSAGES);
  const showMembers = membersOpen && (c.type === "text" || c.type === "group");

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDrag(false);
    if (!e.dataTransfer.files.length) return;
    if (!canSend || !hasPerm(p, Perm.ATTACH_FILES)) return;
    const list = [...e.dataTransfer.files];
    setFiles((prev) => [...prev, ...list.map((f) => ({ file: f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null }))].slice(0, 10));
  };

  return (
    <>
      <header className="main-head">
        <BackButton />
        <div className="title">
          {c.type === "dm" ? (
            <UserAvatar userId={other?.id ?? null} size={24} status />
          ) : c.type === "group" ? (
            <ServerIcon name={label} icon={c.icon} size={24} radius="50%" seed={c.id} />
          ) : (
            <Hash size={22} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          )}
          <h1 className="t" style={{ fontSize: 16, margin: 0 }}>
            {label}
          </h1>
        </div>
        {(c.topic || (c.type === "dm" && other)) && (
          <div className="topic" title={c.topic}>
            {c.type === "dm" && other ? other.customStatus || statusLabel(other.status) : c.topic}
          </div>
        )}
        <div className="tools">
          {isDm && (
            <Tip label={myCall ? "You’re in this call" : inCallHere ? "Join call" : "Start voice call"} side="bottom">
              <button className="icon-btn" aria-label="Start voice call" disabled={blocked} onClick={() => void joinVoice(channelId)}>
                <Phone size={20} />
              </button>
            </Tip>
          )}
          <Tip label="Pinned messages" side="bottom">
            <button className={`icon-btn${panel === "pins" ? " on" : ""}`} aria-label="Pinned messages" aria-pressed={panel === "pins"} onClick={() => set({ panel: panel === "pins" ? null : "pins" })}>
              <Pin size={20} />
              {pinsCount > 0 && panel !== "pins" && <span className="dot" style={{ background: "var(--accent)" }} />}
            </button>
          </Tip>
          {c.type === "group" && (
            <Tip label="Group details" side="bottom">
              <button className="icon-btn" aria-label="Group details" onClick={() => set({ modal: { kind: "group-details", channelId } })}>
                <Cog size={20} />
              </button>
            </Tip>
          )}
          {c.type === "group" && (
            <Tip label="Add friends to group" side="bottom">
              <button className="icon-btn" aria-label="Add friends to group" onClick={() => set({ modal: { kind: "create-group", channelId } })}>
                <UserPlus size={20} />
              </button>
            </Tip>
          )}
          {(c.type === "text" || c.type === "group") && (
            <Tip label={membersOpen ? "Hide member list" : "Show member list"} side="bottom">
              <button className={`icon-btn${membersOpen ? " on" : ""}`} aria-label="Members" aria-pressed={membersOpen} onClick={() => set({ membersOpen: !membersOpen })}>
                <Users size={20} />
              </button>
            </Tip>
          )}
          <HeadSearch channelId={channelId} />
          <Tip label="Mentions" side="bottom">
            <button className={`icon-btn${panel === "mentions" ? " on" : ""}`} aria-label="Mentions" aria-pressed={panel === "mentions"} onClick={() => set({ panel: panel === "mentions" ? null : "mentions" })}>
              <AtSign size={20} />
              {mentionTotal > 0 && <span className="dot">{mentionTotal > 9 ? "9+" : mentionTotal}</span>}
            </button>
          </Tip>
        </div>
      </header>
      {isDm && (inCallHere || myCall) && <DmCall channel={c} />}
      <div className="content-row">
        <section
          className="chat"
          aria-label={`${label} chat`}
          onDragEnter={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            dragDepth.current++;
            setDrag(true);
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (!dragDepth.current) setDrag(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <MessageList
            channelId={channelId}
            serverId={serverId}
            start={isDm ? <DmStart c={c} /> : <ChannelStart name={c.name} topic={c.topic} />}
            canManage={hasPerm(p, Perm.MANAGE_MESSAGES) && !isDm}
            canReact={hasPerm(p, Perm.ADD_REACTIONS)}
            canPin={canPin}
            candidates={candidates}
          />
          <Composer
            key={channelId}
            channelId={channelId}
            serverId={serverId}
            placeholder={c.type === "dm" ? `Message @${label}` : c.type === "group" ? `Message ${label}` : `Message #${c.name}`}
            candidates={candidates}
            canSend={canSend}
            canAttach={hasPerm(p, Perm.ATTACH_FILES)}
            canMentionEveryone={hasPerm(p, Perm.MENTION_EVERYONE)}
            lockedReason={blocked ? "You blocked this person. Unblock them to send a message." : "You don’t have permission to send messages in this channel."}
            files={files}
            setFiles={setFiles}
          />
          {drag && (
            <div className="drop-overlay">
              <div className="drop-card">
                <Upload size={36} style={{ color: "var(--accent)" }} />
                <h3>{canSend && hasPerm(p, Perm.ATTACH_FILES) ? `Upload to ${isDm ? label : `#${c.name}`}` : "You can’t upload here"}</h3>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>Drop files to attach them. Up to 10 MB each.</p>
              </div>
            </div>
          )}
        </section>
        {panel ? (
          <SidePanel kind={panel} channelId={channelId} serverId={serverId} />
        ) : showMembers ? (
          c.type === "group" ? (
            <GroupMembers channel={c} />
          ) : serverId ? (
            <MembersList serverId={serverId} channel={c} />
          ) : null
        ) : null}
      </div>
    </>
  );
}
