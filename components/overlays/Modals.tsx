"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ChevronRight, Copy, Hash, Lock, Volume2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { set, toast, upsertUsers, useStore, type ModalState, type State } from "@/lib/client/store";
import { api, errMsg, uploadImage } from "@/lib/client/api";
import { createServer, joinInvite, openDm, sendMessage } from "@/lib/client/actions";
import { channelLabel, displayName, sortedRoles } from "@/lib/client/selectors";
import { href, useNav } from "@/lib/client/route";
import { play } from "@/lib/client/sounds";
import { Modal } from "../ui/Modal";
import { Switch } from "../ui/Switch";
import { UserAvatar } from "../ui/Avatar";
import { deleteCategoryFlow, deleteChannelFlow, leaveGroupFlow } from "../app/serverFlows";
import type { Channel, PublicUser } from "@/lib/types";

const close = () => set({ modal: null });

function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
      play("error");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

function IconPicker({ value, onChange, label }: { value: string | null; onChange: (url: string | null) => void; label: string }) {
  const [uploading, setUploading] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 16 }}>
      <label className="icon-upload" aria-label={label} style={{ cursor: "pointer" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" /> : uploading ? <div className="spinner" /> : (
          <span>
            <Camera size={22} style={{ display: "block", margin: "0 auto 2px" }} />
            Upload
          </span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            try {
              onChange(await uploadImage(f));
            } catch (err) {
              toast(errMsg(err), "error");
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      {value && (
        <button className="btn link" style={{ fontSize: 13 }} onClick={() => onChange(null)}>
          Remove icon
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------- create / join server

const TEMPLATES = [
  { key: "blank", label: "Create my own", sub: "Start from scratch", icon: "✨" },
  { key: "gaming", label: "Gaming", sub: "Lobby, clips and squads", icon: "🎮" },
  { key: "friends", label: "Friends", sub: "Memes, plans and a hangout", icon: "💬" },
  { key: "study", label: "Study group", sub: "Homework help and a study room", icon: "📚" },
  { key: "creators", label: "Artists & Creators", sub: "Showcase and feedback", icon: "🎨" },
];

function CreateServer() {
  const [step, setStep] = useState<"pick" | "name" | "join">("pick");
  const [template, setTemplate] = useState("blank");
  const me = useStore((s) => s.me);
  const [name, setName] = useState(`${me?.displayName ?? "My"}’s server`);
  const [icon, setIcon] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const { busy, error, run, setError } = useBusy();
  const nav = useNav();

  if (step === "join")
    return (
      <Modal
        onClose={close}
        title="Join a server"
        sub="Enter an invite below to join an existing server."
        center
        foot={
          <>
            <button className="btn ghost left" onClick={() => setStep("pick")}>
              Back
            </button>
            <button
              className="btn"
              disabled={!code.trim() || busy}
              onClick={() =>
                void run(async () => {
                  const c = code.trim().replace(/^.*\/invite\//, "").replace(/[/?#].*$/, "");
                  const r = await joinInvite(c);
                  close();
                  nav(href.server(r.server.id, r.firstChannelId));
                  toast(`Welcome to ${r.server.name}!`, "success");
                })
              }
            >
              {busy ? "Joining…" : "Join Server"}
            </button>
          </>
        }
      >
        <div className="modal-body">
          <div className="field">
            <label htmlFor="invite-code">Invite link</label>
            <input
              id="invite-code"
              className={`input${error ? " invalid" : ""}`}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              placeholder={`${typeof window !== "undefined" ? location.host : "dabber"}/invite/hTKzmak`}
              autoFocus
            />
            {error ? <span className="error-text">{error}</span> : <span className="hint">Invites look like hTKzmak or a full /invite/ link.</span>}
          </div>
        </div>
      </Modal>
    );

  if (step === "name")
    return (
      <Modal
        onClose={close}
        title="Customize your server"
        sub="Give your new server a personality with a name and an icon. You can always change it later."
        center
        foot={
          <>
            <button className="btn ghost left" onClick={() => setStep("pick")}>
              Back
            </button>
            <button
              className="btn"
              disabled={!name.trim() || busy}
              onClick={() =>
                void run(async () => {
                  const r = await createServer(name.trim(), template, icon);
                  close();
                  nav(href.server(r.server.id, r.firstChannelId));
                })
              }
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <div className="modal-body">
          <IconPicker value={icon} onChange={setIcon} label="Upload server icon" />
          <div className="field">
            <label htmlFor="server-name">Server name</label>
            <input id="server-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} autoFocus />
            {error && <span className="error-text">{error}</span>}
          </div>
        </div>
      </Modal>
    );

  return (
    <Modal onClose={close} title="Create a server" sub="Your server is where you and your friends hang out. Make yours and start talking." center>
      <div className="modal-body">
        {TEMPLATES.map((t, i) => (
          <div key={t.key}>
            <button
              className="pick-row"
              onClick={() => {
                setTemplate(t.key);
                setStep("name");
              }}
            >
              <span className="pick-icon">{t.icon}</span>
              <span>
                <div className="pick-row-name">{t.label}</div>
                <div className="pick-row-sub">{t.sub}</div>
              </span>
              <ChevronRight className="chev" size={18} />
            </button>
            {i === 0 && <div className="section-label">Start from a template</div>}
          </div>
        ))}
      </div>
      <div className="modal-foot" style={{ flexDirection: "column", alignItems: "stretch", textAlign: "center" }}>
        <b>Have an invite already?</b>
        <button className="btn secondary block" onClick={() => setStep("join")}>
          Join a Server
        </button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- channels & categories

function RolePicker({ serverId, value, onChange }: { serverId: string; value: string[]; onChange: (v: string[]) => void }) {
  const roles = useStore(useShallow((s: State) => sortedRoles(s, serverId).filter((r) => !r.isDefault)));
  if (!roles.length) return <p className="hint" style={{ fontSize: 13, color: "var(--text-muted)" }}>Make some roles first (Server Settings → Roles). Admins and channel managers can always see private channels.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {roles.map((r) => {
        const on = value.includes(r.id);
        return (
          <button key={r.id} className="pick-row" style={{ padding: "8px 12px", marginBottom: 0 }} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])}>
            <span className="status-pip" style={{ background: r.color ?? "var(--text-faint)" }} />
            <span className="pick-row-name" style={{ flex: 1 }}>
              {r.name}
            </span>
            {on && <Check size={16} />}
          </button>
        );
      })}
    </div>
  );
}

function CreateChannel({ m }: { m: Extract<ModalState, { kind: "create-channel" }> }) {
  const [type, setType] = useState<"text" | "voice">(m.type ?? "text");
  const [name, setName] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const catName = useStore((s) => (m.categoryId ? s.categories[m.categoryId]?.name : null));
  const { busy, error, run } = useBusy();
  const nav = useNav();
  const shown = type === "text" ? name.toLowerCase().replace(/\s+/g, "-") : name;
  return (
    <Modal
      onClose={close}
      title="Create Channel"
      sub={catName ? `in ${catName}` : undefined}
      foot={
        <>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            className="btn"
            disabled={!name.trim() || busy}
            onClick={() =>
              void run(async () => {
                const r = await api.post<{ channel: Channel }>(`servers/${m.serverId}/channels`, { name, type, categoryId: m.categoryId, isPrivate, roleIds });
                set((s) => ({ channels: { ...s.channels, [r.channel.id]: r.channel } }));
                close();
                nav(href.server(m.serverId, r.channel.id));
                play("success");
              })
            }
          >
            Create Channel
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="label" style={{ marginBottom: 8 }}>
          Channel type
        </div>
        {(
          [
            ["text", Hash, "Text", "Send messages, pictures, emoji and opinions"],
            ["voice", Volume2, "Voice", "Hang out with voice and screen sharing"],
          ] as const
        ).map(([k, Icon, l, sub]) => (
          <button key={k} className="pick-row" aria-pressed={type === k} onClick={() => setType(k)}>
            <span className="pick-icon">
              <Icon size={20} />
            </span>
            <span>
              <div className="pick-row-name">{l}</div>
              <div className="pick-row-sub">{sub}</div>
            </span>
            <span className="chev" style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid currentColor", display: "grid", placeItems: "center" }}>
              {type === k && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
            </span>
          </button>
        ))}
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="ch-name">Channel name</label>
          <div className="prefixed-input">
            <span>{type === "text" ? <Hash size={16} /> : <Volume2 size={16} />}</span>
            <input
              id="ch-name"
              value={shown}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "text" ? "new-channel" : "Lounge"}
              maxLength={64}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) (e.currentTarget.closest(".modal")?.querySelector(".modal-foot .btn:not(.ghost)") as HTMLButtonElement)?.click();
              }}
            />
          </div>
          {error && <span className="error-text">{error}</span>}
        </div>
        <div className="toggle-row">
          <div>
            <div className="t-title" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Lock size={14} /> Private channel
            </div>
            <div className="t-desc">Only the roles you pick (and admins) can see it.</div>
          </div>
          <Switch checked={isPrivate} onChange={setPrivate} label="Private channel" />
        </div>
        {isPrivate && (
          <div style={{ marginTop: 10 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              Who can access this channel?
            </div>
            <RolePicker serverId={m.serverId} value={roleIds} onChange={setRoleIds} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditChannel({ id }: { id: string }) {
  const c = useStore((s) => s.channels[id]);
  const cats = useStore(useShallow((s: State) => Object.values(s.categories).filter((k) => k.serverId === c?.serverId)));
  const [name, setName] = useState(c?.name ?? "");
  const [topic, setTopic] = useState(c?.topic ?? "");
  const [isPrivate, setPrivate] = useState(!!c?.isPrivate);
  const [roleIds, setRoleIds] = useState<string[]>(c?.roleIds ?? []);
  const [cat, setCat] = useState<string>(c?.categoryId ?? "");
  const { busy, error, run } = useBusy();
  if (!c || !c.serverId) return null;
  return (
    <Modal
      onClose={close}
      title="Edit channel"
      sub={c.type === "voice" ? c.name : `#${c.name}`}
      foot={
        <>
          <button
            className="btn ghost left"
            style={{ color: "var(--danger)" }}
            onClick={() => {
              close();
              deleteChannelFlow(id);
            }}
          >
            Delete channel
          </button>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            className="btn"
            disabled={!name.trim() || busy}
            onClick={() =>
              void run(async () => {
                await api.patch(`channels/${id}`, { name, topic, isPrivate, roleIds, categoryId: cat || null });
                close();
                toast("Channel saved.", "success");
              })
            }
          >
            Save
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="ec-name">Channel name</label>
          <input id="ec-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
        </div>
        {c.type === "text" && (
          <div className="field">
            <label htmlFor="ec-topic">Topic</label>
            <textarea id="ec-topic" className="textarea" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={256} placeholder="Let everyone know how to use this channel!" />
            <span className="hint">{256 - topic.length} characters left</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="ec-cat">Category</label>
          <select id="ec-cat" className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">No category</option>
            {cats.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        <div className="toggle-row">
          <div>
            <div className="t-title">Private channel</div>
            <div className="t-desc">Only picked roles (and admins) can see it.</div>
          </div>
          <Switch checked={isPrivate} onChange={setPrivate} label="Private channel" />
        </div>
        {isPrivate && <RolePicker serverId={c.serverId} value={roleIds} onChange={setRoleIds} />}
        {error && <p className="error-text">{error}</p>}
      </div>
    </Modal>
  );
}

function CategoryModal({ serverId, categoryId }: { serverId?: string; categoryId?: string }) {
  const existing = useStore((s) => (categoryId ? s.categories[categoryId] : undefined));
  const [name, setName] = useState(existing?.name ?? "");
  const { busy, error, run } = useBusy();
  const save = () =>
    void run(async () => {
      if (categoryId) await api.patch(`categories/${categoryId}`, { name });
      else await api.post(`servers/${serverId}/categories`, { name });
      close();
    });
  return (
    <Modal
      onClose={close}
      title={categoryId ? "Edit category" : "Create Category"}
      foot={
        <>
          {categoryId && (
            <button
              className="btn ghost left"
              style={{ color: "var(--danger)" }}
              onClick={() => {
                close();
                deleteCategoryFlow(categoryId);
              }}
            >
              Delete
            </button>
          )}
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn" disabled={!name.trim() || busy} onClick={save}>
            {categoryId ? "Save" : "Create Category"}
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="cat-name">Category name</label>
          <input id="cat-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="New category" autoFocus onKeyDown={(e) => e.key === "Enter" && name.trim() && save()} />
          {error && <span className="error-text">{error}</span>}
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- invite

function Invite({ serverId, channelId }: { serverId: string; channelId?: string }) {
  const server = useStore((s) => s.servers[serverId]);
  const chName = useStore((s) => (channelId ? s.channels[channelId]?.name : null));
  const friends = useStore(useShallow((s: State) => Object.values(s.relationships).filter((r) => r.type === "friends").map((r) => r.userId)));
  const users = useStore((s) => s.users);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  useEffect(() => {
    api
      .post<{ code: string }>(`servers/${serverId}/invites`)
      .then((r) => setCode(r.code))
      .catch((e) => setError(errMsg(e)));
  }, [serverId]);
  const link = code ? `${location.origin}/invite/${code}` : "";
  const list = friends.filter((id) => `${users[id]?.displayName} ${users[id]?.username}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal onClose={close} title={`Invite friends to ${server?.name ?? "server"}`} sub={chName ? `Recipients will land in #${chName}` : undefined}>
      <div className="modal-body">
        {friends.length > 0 && (
          <>
            <input className="input" placeholder="Search for friends" aria-label="Search for friends" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 12, ["--ring" as string]: "var(--bg-main)" }}>
              {list.map((id) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}>
                  <UserAvatar userId={id} size={32} status />
                  <span style={{ flex: 1, fontWeight: 600 }}>{users[id]?.displayName}</span>
                  <button
                    className={`btn tiny ${sent[id] ? "secondary" : ""}`}
                    disabled={!code || sent[id]}
                    onClick={async () => {
                      const dm = await openDm(id);
                      if (!dm) return;
                      await sendMessage(dm, link);
                      setSent((s) => ({ ...s, [id]: true }));
                    }}
                  >
                    {sent[id] ? "Sent" : "Invite"}
                  </button>
                </div>
              ))}
              {list.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No friends match.</p>}
            </div>
          </>
        )}
        <div className="label" style={{ marginBottom: 6 }}>
          Or, send a server invite link to a friend
        </div>
        {error ? (
          <p className="error-text">{error}</p>
        ) : (
          <div className="add-friend-box" style={{ marginTop: 0 }}>
            <input readOnly value={link || "Making a link…"} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <button
              className={`btn small${copied ? " success" : ""}`}
              disabled={!code}
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8 }}>Your invite link never expires.</p>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- groups

function CreateGroup({ channelId }: { channelId?: string }) {
  const existing = useStore((s) => (channelId ? s.channels[channelId] : undefined));
  const friends = useStore(useShallow((s: State) => Object.values(s.relationships).filter((r) => r.type === "friends").map((r) => r.userId)));
  const users = useStore((s) => s.users);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const { busy, error, run } = useBusy();
  const nav = useNav();
  const already = existing?.recipients ?? [];
  const room = 9 - already.length;
  const list = friends
    .filter((id) => !already.includes(id))
    .filter((id) => `${users[id]?.displayName} ${users[id]?.username}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (users[a]?.displayName ?? "").localeCompare(users[b]?.displayName ?? ""));
  return (
    <Modal
      onClose={close}
      title={existing ? "Add friends" : "Select Friends"}
      sub={room - picked.length >= 0 ? `You can add ${room - picked.length} more friend${room - picked.length === 1 ? "" : "s"}.` : "That’s too many."}
      foot={
        <>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            className="btn"
            disabled={!picked.length || busy || picked.length > room}
            onClick={() =>
              void run(async () => {
                if (existing) {
                  await api.post(`dms/${existing.id}/members`, { userIds: picked });
                  close();
                  return;
                }
                if (picked.length === 1 && !name.trim()) {
                  const id = await openDm(picked[0]);
                  close();
                  if (id) nav(href.dm(id));
                  return;
                }
                const r = await api.post<{ channel: Channel; users: PublicUser[] }>("dms", { userIds: picked, name: name.trim() });
                upsertUsers(r.users);
                set((s) => ({ channels: { ...s.channels, [r.channel.id]: r.channel } }));
                close();
                nav(href.dm(r.channel.id));
              })
            }
          >
            {existing ? "Add" : picked.length > 1 || name.trim() ? "Create Group" : "Create DM"}
          </button>
        </>
      }
    >
      <div className="modal-body">
        {friends.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>You don’t have any friends to add yet. Add some from the Friends page first.</p>
        ) : (
          <>
            <input className="input" placeholder="Type the username of a friend" aria-label="Search friends" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <div style={{ maxHeight: 280, overflowY: "auto", margin: "10px 0", ["--ring" as string]: "var(--bg-main)" }}>
              {list.map((id) => {
                const on = picked.includes(id);
                return (
                  <button
                    key={id}
                    className="pick-row"
                    style={{ padding: "6px 10px", marginBottom: 4 }}
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== id) : [...p, id]))}
                  >
                    <UserAvatar userId={id} size={32} status />
                    <span style={{ flex: 1 }}>
                      <div className="pick-row-name">{users[id]?.displayName}</div>
                      <div className="pick-row-sub">{users[id]?.username}</div>
                    </span>
                    <span style={{ width: 20, height: 20, borderRadius: 6, border: "2px solid var(--text-muted)", display: "grid", placeItems: "center", background: on ? "var(--accent)" : undefined, borderColor: on ? "var(--accent)" : undefined }}>
                      {on && <Check size={14} color="#fff" />}
                    </span>
                  </button>
                );
              })}
              {list.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Nothing matches.</p>}
            </div>
            {!existing && picked.length > 1 && (
              <div className="field">
                <label htmlFor="group-name">Group name (optional)</label>
                <input id="group-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="Game Night" />
              </div>
            )}
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </Modal>
  );
}

function GroupDetails({ channelId }: { channelId: string }) {
  const c = useStore((s) => s.channels[channelId]);
  const label = useStore((s) => channelLabel(s, s.channels[channelId]));
  const [name, setName] = useState(c?.name ?? "");
  const [icon, setIcon] = useState<string | null>(c?.icon ?? null);
  const { busy, error, run } = useBusy();
  if (!c) return null;
  return (
    <Modal
      onClose={close}
      title="Group details"
      foot={
        <>
          <button
            className="btn ghost left"
            style={{ color: "var(--danger)" }}
            onClick={() => {
              close();
              leaveGroupFlow(channelId);
            }}
          >
            Leave group
          </button>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.patch(`channels/${channelId}`, { name, icon });
                close();
              })
            }
          >
            Save
          </button>
        </>
      }
    >
      <div className="modal-body">
        <IconPicker value={icon} onChange={setIcon} label="Upload group picture" />
        <div className="field">
          <label htmlFor="g-name">Group name</label>
          <input id="g-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder={label} />
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- misc

function Confirm({ m }: { m: Extract<ModalState, { kind: "confirm" }> }) {
  const { busy, error, run } = useBusy();
  return (
    <Modal
      onClose={close}
      title={m.title}
      foot={
        <>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            className={`btn${m.danger ? " danger" : ""}`}
            disabled={busy}
            autoFocus
            onClick={() =>
              void run(async () => {
                await m.onConfirm();
                close();
              })
            }
          >
            {m.confirm}
          </button>
        </>
      }
    >
      <div className="modal-body">
        <p style={{ margin: 0, color: "var(--text-muted)" }}>{m.body}</p>
        {error && <p className="error-text">{error}</p>}
      </div>
    </Modal>
  );
}

function Nickname({ serverId, userId }: { serverId: string; userId: string }) {
  const current = useStore((s) => s.members[serverId]?.[userId]?.nickname ?? "");
  const base = useStore((s) => s.users[userId]?.displayName ?? "");
  const isMe = useStore((s) => s.me?.id === userId);
  const [nick, setNick] = useState(current);
  const { busy, error, run } = useBusy();
  const save = (value: string | null) =>
    void run(async () => {
      await api.patch(`servers/${serverId}/members/${userId}`, { nickname: value });
      close();
    });
  return (
    <Modal
      onClose={close}
      title="Change Nickname"
      sub={isMe ? "Nicknames only show in this server." : `Change ${base}’s nickname in this server.`}
      foot={
        <>
          <button className="btn ghost left" onClick={() => save(null)}>
            Reset
          </button>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn" disabled={busy} onClick={() => save(nick.trim() || null)}>
            Save
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="nick">Nickname</label>
          <input id="nick" className="input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder={base} maxLength={32} autoFocus onKeyDown={(e) => e.key === "Enter" && save(nick.trim() || null)} />
          {error && <span className="error-text">{error}</span>}
        </div>
      </div>
    </Modal>
  );
}

function Ban({ serverId, userId }: { serverId: string; userId: string }) {
  const name = useStore((s) => displayName(s, userId, serverId));
  const [reason, setReason] = useState("");
  const [wipe, setWipe] = useState(false);
  const { busy, error, run } = useBusy();
  return (
    <Modal
      onClose={close}
      title={`Ban ${name}?`}
      sub="They’ll be removed and can’t rejoin unless you unban them."
      foot={
        <>
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.put(`servers/${serverId}/bans/${userId}`, { reason, deleteMessages: wipe });
                close();
                toast(`${name} was banned.`);
              })
            }
          >
            Ban
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="ban-reason">Reason (optional)</label>
          <textarea id="ban-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Spamming, harassing people in #general" />
        </div>
        <div className="toggle-row">
          <div>
            <div className="t-title">Delete all their messages too</div>
            <div className="t-desc">Everything they wrote in this server. Can’t be undone.</div>
          </div>
          <Switch checked={wipe} onChange={setWipe} label="Delete their messages" />
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
    </Modal>
  );
}

function CustomStatus() {
  const me = useStore((s) => s.me);
  const [text, setText] = useState(me?.customStatus ?? "");
  const { busy, error, run } = useBusy();
  const save = (v: string) =>
    void run(async () => {
      await api.patch("users/me", { customStatus: v });
      close();
    });
  return (
    <Modal
      onClose={close}
      title="Set a custom status"
      foot={
        <>
          {me?.customStatus && (
            <button className="btn ghost left" onClick={() => save("")}>
              Clear status
            </button>
          )}
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn" disabled={busy} onClick={() => save(text.trim())}>
            Save
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="cs">What’s up?</label>
          <input id="cs" className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="studying, on vacation, grinding ranked…" autoFocus onKeyDown={(e) => e.key === "Enter" && save(text.trim())} />
          <span className="hint">{80 - text.length} characters left</span>
          {error && <span className="error-text">{error}</span>}
        </div>
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string[]][] = [
  ["Quick switcher (find channels, DMs, servers)", ["Ctrl", "K"]],
  ["Keyboard shortcuts", ["Ctrl", "/"]],
  ["Open settings", ["Ctrl", ","]],
  ["Toggle mute", ["Ctrl", "Shift", "M"]],
  ["Toggle deafen", ["Ctrl", "Shift", "D"]],
  ["Send message", ["Enter"]],
  ["New line", ["Shift", "Enter"]],
  ["Edit your last message", ["↑"]],
  ["Cancel reply / edit, close popups", ["Esc"]],
  ["Delete without asking", ["Shift", "Click 🗑"]],
];

function Shortcuts() {
  return (
    <Modal onClose={close} title="Keyboard shortcuts" size="wide">
      <div className="modal-body">
        {SHORTCUTS.map(([l, keys]) => (
          <div key={l} className="kbs-row">
            <span>{l}</span>
            <span className="keys">
              {keys.map((k) => (
                <kbd key={k} className="kbd">
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>On a Mac, use ⌘ instead of Ctrl.</p>
      </div>
    </Modal>
  );
}

export function ModalHost() {
  const m = useStore((s) => s.modal);
  const key = useMemo(() => (m ? `${m.kind}-${JSON.stringify({ ...m, onConfirm: undefined })}` : ""), [m]);
  if (!m) return null;
  switch (m.kind) {
    case "create-server":
      return <CreateServer key={key} />;
    case "create-channel":
      return <CreateChannel key={key} m={m} />;
    case "create-category":
      return <CategoryModal key={key} serverId={m.serverId} />;
    case "edit-category":
      return <CategoryModal key={key} categoryId={m.categoryId} />;
    case "edit-channel":
      return <EditChannel key={key} id={m.channelId} />;
    case "invite":
      return <Invite key={key} serverId={m.serverId} channelId={m.channelId} />;
    case "create-group":
      return <CreateGroup key={key} channelId={m.channelId} />;
    case "group-details":
      return <GroupDetails key={key} channelId={m.channelId} />;
    case "confirm":
      return <Confirm key={key} m={m} />;
    case "nickname":
      return <Nickname key={key} serverId={m.serverId} userId={m.userId} />;
    case "ban":
      return <Ban key={key} serverId={m.serverId} userId={m.userId} />;
    case "custom-status":
      return <CustomStatus key={key} />;
    case "shortcuts":
      return <Shortcuts key={key} />;
  }
}

