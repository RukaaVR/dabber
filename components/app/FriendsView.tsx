"use client";

import { useState } from "react";
import { Check, MessageCircle, MoreVertical, Search, Users, X, Volume2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { set, toast, useStore, type State } from "@/lib/client/store";
import { api, errMsg } from "@/lib/client/api";
import { openDm, copy } from "@/lib/client/actions";
import { href, useNav } from "@/lib/client/route";
import { channelLabel, statusLabel } from "@/lib/client/selectors";
import { play } from "@/lib/client/sounds";
import { UserAvatar } from "../ui/Avatar";
import { Empty } from "../ui/Empty";
import { Tip } from "../ui/Tip";
import { blockFlow, removeFriendFlow, unblock } from "./serverFlows";
import { openProfile } from "../overlays/ProfileCard";
import type { Relationship } from "@/lib/types";
import { BackButton } from "./BackButton";

type Tab = "online" | "all" | "pending" | "blocked" | "add";

function AddFriend() {
  const [name, setName] = useState("");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await api.post<{ accepted: boolean; user: { displayName: string } }>("friends", { username: name.trim() });
      setState({ ok: true, text: r.accepted ? `You and ${r.user.displayName} are friends now!` : `Success! Your friend request to ${name.trim()} was sent.` });
      setName("");
      play("success");
    } catch (err) {
      setState({ ok: false, text: errMsg(err) });
      play("error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ margin: "4px 0 6px", fontSize: 17, textTransform: "uppercase", letterSpacing: ".02em" }}>Add Friend</h2>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>You can add friends with their Dabber username.</p>
      <form onSubmit={submit} className={`add-friend-box${state ? (state.ok ? " ok" : " bad") : ""}`}>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setState(null);
          }}
          placeholder="Type the username of a friend"
          aria-label="Username"
          autoComplete="off"
          autoFocus
          maxLength={40}
        />
        <button className="btn small" disabled={!name.trim() || busy}>
          Send Friend Request
        </button>
      </form>
      {state && (
        <p role="status" style={{ color: state.ok ? "var(--success)" : "var(--danger)", fontSize: 14, marginTop: 8 }}>
          {state.text}
        </p>
      )}
      <div style={{ marginTop: 40 }}>
        <Empty art="friends" title="Find your people" compact>
          Ask a friend for their username, or share an invite link to a server you both like.
        </Empty>
      </div>
    </div>
  );
}

function PersonRow({ rel }: { rel: Relationship }) {
  const u = useStore((s) => s.users[rel.userId]);
  const nav = useNav();
  if (!u) return null;
  const message = async () => {
    const id = await openDm(u.id);
    if (id) nav(href.dm(id));
  };
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      toast(errMsg(e), "error");
    }
  };
  const sub =
    rel.type === "incoming"
      ? "Incoming friend request"
      : rel.type === "outgoing"
        ? "Outgoing friend request"
        : rel.type === "blocked"
          ? "Blocked"
          : u.customStatus || statusLabel(u.status);
  return (
    <div
      className="people-row"
      role="button"
      tabIndex={0}
      onClick={(e) => (rel.type === "friends" ? void message() : openProfile(u.id, null, e.currentTarget))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && rel.type === "friends") void message();
      }}
    >
      <UserAvatar userId={u.id} size={36} status={rel.type !== "blocked"} />
      <div className="pr-main">
        <div className="pr-name">
          {u.displayName}
          <span className="uname">@{u.username}</span>
        </div>
        <div className="pr-sub">{sub}</div>
      </div>
      <div className="pr-actions" onClick={(e) => e.stopPropagation()}>
        {rel.type === "friends" && (
          <>
            <Tip label="Message">
              <button className="round-btn" aria-label={`Message ${u.displayName}`} onClick={() => void message()}>
                <MessageCircle size={18} />
              </button>
            </Tip>
            <Tip label="More">
              <button
                className="round-btn"
                aria-label="More"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  set({
                    ctx: {
                      x: r.left - 160,
                      y: r.bottom + 4,
                      items: [
                        { label: "View profile", onClick: () => openProfile(u.id, null, e.currentTarget) },
                        { label: "Copy username", onClick: () => copy(u.username, "Username copied") },
                        { sep: true, label: "" },
                        { label: "Remove friend", danger: true, onClick: () => removeFriendFlow(u.id) },
                        { label: "Block", danger: true, onClick: () => blockFlow(u.id) },
                      ],
                    },
                  });
                }}
              >
                <MoreVertical size={18} />
              </button>
            </Tip>
          </>
        )}
        {rel.type === "incoming" && (
          <>
            <Tip label="Accept">
              <button className="round-btn ok" aria-label="Accept" onClick={() => void act(() => api.post(`friends/${u.id}/accept`))}>
                <Check size={18} />
              </button>
            </Tip>
            <Tip label="Ignore">
              <button className="round-btn no" aria-label="Ignore" onClick={() => void act(() => api.del(`friends/${u.id}`))}>
                <X size={18} />
              </button>
            </Tip>
          </>
        )}
        {rel.type === "outgoing" && (
          <Tip label="Cancel">
            <button className="round-btn no" aria-label="Cancel request" onClick={() => void act(() => api.del(`friends/${u.id}`))}>
              <X size={18} />
            </button>
          </Tip>
        )}
        {rel.type === "blocked" && (
          <button className="btn small secondary" onClick={() => void unblock(u.id)}>
            Unblock
          </button>
        )}
      </div>
    </div>
  );
}

function ActiveNow() {
  const active = useStore(
    useShallow((s: State) =>
      Object.values(s.relationships)
        .filter((r) => r.type === "friends" && s.voiceStates[r.userId])
        .map((r) => r.userId),
    ),
  );
  const where = useStore(
    useShallow((s: State) =>
      active.map((id) => {
        const c = s.channels[s.voiceStates[id]?.channelId ?? ""];
        if (!c) return "In voice";
        return c.serverId ? `${s.servers[c.serverId]?.name ?? ""} · ${c.name}` : `In a call · ${channelLabel(s, c)}`;
      }),
    ),
  );
  const names = useStore(useShallow((s: State) => active.map((id) => s.users[id]?.displayName ?? "")));
  return (
    <aside className="activity" aria-label="Active now">
      <h3 style={{ margin: "4px 0 14px", fontSize: 18 }}>Active Now</h3>
      {active.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <b>It’s quiet for now…</b>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "6px 0 0" }}>
            When a friend hops into voice, they’ll show up here.
          </p>
        </div>
      ) : (
        active.map((id, i) => (
          <div key={id} className="card" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, ["--ring" as string]: "var(--bg-side)" }}>
            <UserAvatar userId={id} size={36} status />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{names[i]}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 4, alignItems: "center" }}>
                <Volume2 size={13} /> {where[i]}
              </div>
            </div>
          </div>
        ))
      )}
    </aside>
  );
}

export function FriendsView() {
  const [tab, setTab] = useState<Tab>("online");
  const [q, setQ] = useState("");
  const rels = useStore(useShallow((s: State) => Object.values(s.relationships)));
  const users = useStore((s) => s.users);
  const pending = rels.filter((r) => r.type === "incoming").length;

  let list: Relationship[] = [];
  if (tab === "online") list = rels.filter((r) => r.type === "friends" && (users[r.userId]?.status ?? "offline") !== "offline");
  if (tab === "all") list = rels.filter((r) => r.type === "friends");
  if (tab === "pending") list = rels.filter((r) => r.type === "incoming" || r.type === "outgoing");
  if (tab === "blocked") list = rels.filter((r) => r.type === "blocked");
  const ql = q.trim().toLowerCase();
  if (ql) list = list.filter((r) => `${users[r.userId]?.displayName} ${users[r.userId]?.username}`.toLowerCase().includes(ql));
  list.sort((a, b) => (users[a.userId]?.displayName ?? "").localeCompare(users[b.userId]?.displayName ?? ""));

  const label = { online: "Online", all: "All friends", pending: "Pending", blocked: "Blocked" } as Record<string, string>;
  const empties: Record<string, { art: "friends" | "search"; title: string; text: string }> = {
    online: { art: "friends", title: "No one’s around", text: "None of your friends are online right now. They’ll show up here when they are." },
    all: { art: "friends", title: "No friends yet", text: "Add a friend with their username and they’ll show up here." },
    pending: { art: "friends", title: "No pending requests", text: "Requests you send and get will wait here." },
    blocked: { art: "search", title: "Nobody’s blocked", text: "You haven’t blocked anyone. Nice." },
  };

  return (
    <>
      <header className="main-head">
        <BackButton />
        <div className="title">
          <Users size={20} style={{ color: "var(--text-muted)" }} />
          <span className="t">Friends</span>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />
        <nav className="friends-tabs" role="tablist" aria-label="Friends">
          {(["online", "all", "pending", "blocked"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "all" ? "All" : label[t]}
              {t === "pending" && pending > 0 && <span className="pill">{pending}</span>}
            </button>
          ))}
          <button role="tab" className="add" aria-selected={tab === "add"} onClick={() => setTab("add")}>
            Add Friend
          </button>
        </nav>
      </header>
      <div className="content-row">
        <div className="friends-body">
          {tab === "add" ? (
            <AddFriend />
          ) : (
            <>
              <div className="head-search" style={{ width: "100%", height: 36, marginBottom: 14 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search friends" />
                <Search size={16} />
              </div>
              <div className="section-label" style={{ marginTop: 4 }}>
                {label[tab]} — {list.length}
              </div>
              {list.length === 0 ? (
                ql ? (
                  <Empty art="search" title="Nothing matches" compact>
                    No one here matches “{q}”.
                  </Empty>
                ) : (
                  <Empty
                    art={empties[tab].art}
                    title={empties[tab].title}
                    compact
                    action={
                      tab !== "blocked" && (
                        <button className="btn" onClick={() => setTab("add")}>
                          Add Friend
                        </button>
                      )
                    }
                  >
                    {empties[tab].text}
                  </Empty>
                )
              ) : (
                list.map((r) => <PersonRow key={r.userId} rel={r} />)
              )}
            </>
          )}
        </div>
        <ActiveNow />
      </div>
    </>
  );
}
