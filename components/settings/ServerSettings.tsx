"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X, Search, Crown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { get, removeServer, set, toast, upsertUsers, useStore, type State } from "@/lib/client/store";
import { api, errMsg, uploadImage } from "@/lib/client/api";
import { copy, loadMembers } from "@/lib/client/actions";
import { displayName, sortedRoles } from "@/lib/client/selectors";
import { Perm, PERM_INFO, hasPerm, type PublicUser, type Role } from "@/lib/types";
import { ServerIcon, UserAvatar } from "../ui/Avatar";
import { Switch } from "../ui/Switch";
import { Modal } from "../ui/Modal";
import { Tip } from "../ui/Tip";
import { kickFlow } from "../app/serverFlows";

const ROLE_COLORS = ["#99aab5", "#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#e91e63", "#f1c40f", "#e67e22", "#e74c3c", "#7b61ff", "#ff5fa2", "#14a3b8"];

function close() {
  set({ serverSettings: null });
}

function Overview({ serverId }: { serverId: string }) {
  const s = useStore((st) => st.servers[serverId])!;
  const [draft, setDraft] = useState({ name: s.name, description: s.description, icon: s.icon, isPublic: s.isPublic, bannerColor: s.bannerColor });
  const [busy, setBusy] = useState(false);
  const canEdit = hasPerm(s.myPermissions, Perm.MANAGE_SERVER);
  const dirty = draft.name !== s.name || draft.description !== s.description || draft.icon !== s.icon || draft.isPublic !== s.isPublic || draft.bannerColor !== s.bannerColor;
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`servers/${serverId}`, draft);
      toast("Server saved.", "success");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1>Server Overview</h1>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ textAlign: "center" }}>
          <ServerIcon name={draft.name || s.name} icon={draft.icon} size={100} radius="50%" seed={s.id} />
          {canEdit && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              <label className="btn small secondary" style={{ cursor: "pointer" }}>
                Upload Image
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      const url = await uploadImage(f);
                      setDraft((d) => ({ ...d, icon: url }));
                    } catch (err) {
                      toast(errMsg(err), "error");
                    }
                  }}
                />
              </label>
              {draft.icon && (
                <button className="btn link" style={{ fontSize: 13 }} onClick={() => setDraft({ ...draft, icon: null })}>
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="field">
            <label htmlFor="s-name">Server name</label>
            <input id="s-name" className="input" value={draft.name} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={64} />
          </div>
          <div className="field">
            <label htmlFor="s-desc">Description</label>
            <textarea id="s-desc" className="textarea" value={draft.description} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} placeholder="What is it about? Shown in Discover and on invites." />
          </div>
          <div className="field">
            <label>Banner color</label>
            <div className="swatches">
              <button className="swatch" disabled={!canEdit} aria-pressed={!draft.bannerColor} aria-label="Default" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }} onClick={() => setDraft({ ...draft, bannerColor: null })} />
              {ROLE_COLORS.slice(1).map((c) => (
                <button key={c} className="swatch" disabled={!canEdit} aria-pressed={draft.bannerColor === c} aria-label={c} style={{ background: c }} onClick={() => setDraft({ ...draft, bannerColor: c })} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="toggle-row" style={{ marginTop: 12 }}>
        <div>
          <div className="t-title">Show in Discover</div>
          <div className="t-desc">Anyone on Dabber can find and join this server without an invite.</div>
        </div>
        <Switch checked={draft.isPublic} disabled={!canEdit} onChange={(v) => setDraft({ ...draft, isPublic: v })} label="Show in Discover" />
      </div>
      <div className="toggle-row">
        <div>
          <div className="t-title">Server ID</div>
          <div className="t-desc" style={{ fontFamily: "var(--mono)" }}>{s.id}</div>
        </div>
        <button className="btn small secondary" onClick={() => copy(s.id, "Server ID copied")}>
          Copy
        </button>
      </div>
      {dirty && (
        <div className="save-bar">
          <span className="grow">Careful — you have unsaved changes!</span>
          <button className="btn small ghost" onClick={() => setDraft({ name: s.name, description: s.description, icon: s.icon, isPublic: s.isPublic, bannerColor: s.bannerColor })}>
            Reset
          </button>
          <button className="btn small success" disabled={busy || !draft.name.trim()} onClick={() => void save()}>
            Save Changes
          </button>
        </div>
      )}
    </>
  );
}

function RoleEditor({ role, serverId, canEdit }: { role: Role; serverId: string; canEdit: boolean }) {
  const [draft, setDraft] = useState({ name: role.name, color: role.color, hoist: role.hoist, permissions: role.permissions });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = draft.name !== role.name || draft.color !== role.color || draft.hoist !== role.hoist || draft.permissions !== role.permissions;
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`servers/${serverId}/roles/${role.id}`, role.isDefault ? { permissions: draft.permissions } : draft);
      toast("Role saved.", "success");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const groups = [...new Set(PERM_INFO.map((p) => p.group))];
  return (
    <div>
      {!role.isDefault && (
        <>
          <div className="field">
            <label htmlFor="r-name">Role name</label>
            <input id="r-name" className="input" value={draft.name} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={32} />
          </div>
          <div className="field">
            <label>Role color</label>
            <div className="swatches">
              {ROLE_COLORS.map((c) => (
                <button key={c} className="swatch" disabled={!canEdit} aria-pressed={draft.color === c} aria-label={c} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })} />
              ))}
              <label className="swatch" style={{ background: draft.color ?? "#99aab5", cursor: canEdit ? "pointer" : "default" }} aria-label="Custom color">
                <input type="color" disabled={!canEdit} value={draft.color ?? "#99aab5"} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ opacity: 0, width: "100%", height: "100%" }} />
              </label>
            </div>
          </div>
          <div className="toggle-row">
            <div>
              <div className="t-title">Show members separately</div>
              <div className="t-desc">People with this role get their own group in the member list.</div>
            </div>
            <Switch checked={draft.hoist} disabled={!canEdit} onChange={(v) => setDraft({ ...draft, hoist: v })} label="Hoist role" />
          </div>
        </>
      )}
      {role.isDefault && <p style={{ color: "var(--text-muted)", marginTop: 0 }}>@everyone applies to every member. Turn things off here to restrict the whole server.</p>}
      <div className="prefixed-input" style={{ margin: "16px 0 4px" }}>
        <span>
          <Search size={15} />
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions" aria-label="Search permissions" />
      </div>
      {groups.map((g) => {
        const list = PERM_INFO.filter((p) => p.group === g && `${p.label} ${p.desc}`.toLowerCase().includes(q.toLowerCase()));
        if (!list.length) return null;
        return (
          <div key={g}>
            <div className="section-label">{g} permissions</div>
            {list.map((p) => {
              const bit = Perm[p.key];
              const on = (draft.permissions & bit) === bit;
              return (
                <div key={p.key} className="perm-row">
                  <div>
                    <div className="p-title">{p.label}</div>
                    <div className="p-desc">{p.desc}</div>
                  </div>
                  <Switch checked={on} disabled={!canEdit} label={p.label} onChange={(v) => setDraft({ ...draft, permissions: v ? draft.permissions | bit : draft.permissions & ~bit })} />
                </div>
              );
            })}
          </div>
        );
      })}
      {dirty && (
        <div className="save-bar">
          <span className="grow">Careful — you have unsaved changes!</span>
          <button className="btn small ghost" onClick={() => setDraft({ name: role.name, color: role.color, hoist: role.hoist, permissions: role.permissions })}>
            Reset
          </button>
          <button className="btn small success" disabled={busy || !draft.name.trim()} onClick={() => void save()}>
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

function Roles({ serverId }: { serverId: string }) {
  const roles = useStore(useShallow((s: State) => sortedRoles(s, serverId)));
  const canEdit = useStore((s) => hasPerm(s.servers[serverId]?.myPermissions ?? 0, Perm.MANAGE_ROLES));
  const [sel, setSel] = useState<string | null>(null);
  const current = roles.find((r) => r.id === sel) ?? roles.find((r) => !r.isDefault) ?? roles[0];
  const create = async () => {
    try {
      const r = await api.post<{ role: Role }>(`servers/${serverId}/roles`, { name: "new role" });
      set((s) => ({ roles: { ...s.roles, [r.role.id]: r.role } }));
      setSel(r.role.id);
    } catch (e) {
      toast(errMsg(e), "error");
    }
  };
  return (
    <>
      <h1>Roles</h1>
      <p style={{ color: "var(--text-muted)", marginTop: -8 }}>Use roles to group members and decide what they can do. Higher roles win; you can only edit roles below your own.</p>
      <div className="roles-layout">
        <div className="roles-list">
          {canEdit && (
            <button onClick={() => void create()} style={{ color: "var(--accent-text)", fontWeight: 600 }}>
              <Plus size={16} /> Create Role
            </button>
          )}
          {roles.map((r) => (
            <button key={r.id} aria-current={current?.id === r.id} onClick={() => setSel(r.id)}>
              <span className="status-pip" style={{ background: r.color ?? "var(--text-faint)" }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              {canEdit && !r.isDefault && (
                <Tip label="Delete role">
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete ${r.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      set({
                        modal: {
                          kind: "confirm",
                          title: `Delete “${r.name}”?`,
                          body: "Everyone who has it loses it. This can’t be undone.",
                          confirm: "Delete role",
                          danger: true,
                          onConfirm: async () => {
                            await api.del(`servers/${serverId}/roles/${r.id}`);
                            setSel(null);
                          },
                        },
                      });
                    }}
                    style={{ display: "grid", opacity: 0.7 }}
                  >
                    <Trash2 size={14} />
                  </span>
                </Tip>
              )}
            </button>
          ))}
        </div>
        {current && <RoleEditor key={`${current.id}-${current.permissions}-${current.name}-${current.color}-${current.hoist}`} role={current} serverId={serverId} canEdit={canEdit} />}
      </div>
    </>
  );
}

function Members({ serverId }: { serverId: string }) {
  const ids = useStore(useShallow((s: State) => Object.keys(s.members[serverId] ?? {})));
  const ownerId = useStore((s) => s.servers[serverId]?.ownerId);
  const perms = useStore((s) => s.servers[serverId]?.myPermissions ?? 0);
  const me = useStore((s) => s.me?.id);
  const [q, setQ] = useState("");
  useEffect(() => void loadMembers(serverId, true), [serverId]);
  const s = get();
  const list = ids
    .filter((id) => `${displayName(s, id, serverId)} ${s.users[id]?.username}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => displayName(s, a, serverId).localeCompare(displayName(s, b, serverId)));
  return (
    <>
      <h1>Members — {ids.length}</h1>
      <div className="prefixed-input" style={{ marginBottom: 10 }}>
        <span>
          <Search size={15} />
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" aria-label="Search members" />
      </div>
      {list.map((id) => (
        <div key={id} className="member-admin-row">
          <UserAvatar userId={id} size={36} status />
          <div className="ma-main">
            <div style={{ fontWeight: 650, display: "flex", gap: 4, alignItems: "center" }}>
              {displayName(s, id, serverId)} {id === ownerId && <Crown size={13} style={{ color: "var(--warning)" }} aria-label="Owner" />}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>@{s.users[id]?.username}</div>
          </div>
          {id !== ownerId && id !== me && (
            <div style={{ display: "flex", gap: 6 }}>
              {hasPerm(perms, Perm.MANAGE_NICKNAMES) && (
                <button className="btn tiny secondary" onClick={() => set({ modal: { kind: "nickname", serverId, userId: id } })}>
                  Nickname
                </button>
              )}
              {hasPerm(perms, Perm.KICK) && (
                <button className="btn tiny secondary" onClick={() => kickFlow(serverId, id)}>
                  Kick
                </button>
              )}
              {hasPerm(perms, Perm.BAN) && (
                <button className="btn tiny danger" onClick={() => set({ modal: { kind: "ban", serverId, userId: id } })}>
                  Ban
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {list.length === 0 && <div className="table-empty">Nothing matches.</div>}
    </>
  );
}

function Invites({ serverId }: { serverId: string }) {
  const [data, setData] = useState<{ invites: { code: string; creatorId: string | null; uses: number; createdAt: number }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api
      .get<{ invites: { code: string; creatorId: string | null; uses: number; createdAt: number }[]; users: PublicUser[] }>(`servers/${serverId}/invites`)
      .then((r) => {
        upsertUsers(r.users);
        setData(r);
      })
      .catch((e) => setErr(errMsg(e)));
  }, [serverId]);
  useEffect(load, [load]);
  const users = useStore((s) => s.users);
  return (
    <>
      <h1>Invites</h1>
      {err && <p className="error-text">{err}</p>}
      {!data ? (
        <div className="spinner" />
      ) : data.invites.length === 0 ? (
        <div className="table-empty">No invites yet. Make one from the server menu → Invite people.</div>
      ) : (
        data.invites.map((i) => (
          <div key={i.code} className="member-admin-row">
            <UserAvatar userId={i.creatorId} size={32} />
            <div className="ma-main">
              <div style={{ fontWeight: 650, fontFamily: "var(--mono)" }}>{i.code}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                by {i.creatorId ? (users[i.creatorId]?.displayName ?? "someone") : "deleted user"} · {i.uses} use{i.uses === 1 ? "" : "s"} · never expires
              </div>
            </div>
            <button className="btn tiny secondary" onClick={() => copy(`${location.origin}/invite/${i.code}`, "Invite link copied")}>
              Copy
            </button>
            <Tip label="Revoke invite">
              <button
                className="icon-btn"
                aria-label={`Revoke ${i.code}`}
                onClick={async () => {
                  try {
                    await api.del(`invites/${i.code}`);
                    load();
                  } catch (e) {
                    toast(errMsg(e), "error");
                  }
                }}
              >
                <X size={16} />
              </button>
            </Tip>
          </div>
        ))
      )}
    </>
  );
}

function Bans({ serverId }: { serverId: string }) {
  const [bans, setBans] = useState<{ userId: string; reason: string; createdAt: number }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api
      .get<{ bans: { userId: string; reason: string; createdAt: number }[]; users: PublicUser[] }>(`servers/${serverId}/bans`)
      .then((r) => {
        upsertUsers(r.users);
        setBans(r.bans);
      })
      .catch((e) => setErr(errMsg(e)));
  }, [serverId]);
  useEffect(load, [load]);
  const users = useStore((s) => s.users);
  return (
    <>
      <h1>Bans</h1>
      {err && <p className="error-text">{err}</p>}
      {!bans ? (
        <div className="spinner" />
      ) : bans.length === 0 ? (
        <div className="table-empty">Nobody’s banned. Peaceful.</div>
      ) : (
        bans.map((b) => (
          <div key={b.userId} className="member-admin-row">
            <UserAvatar userId={b.userId} size={32} />
            <div className="ma-main">
              <div style={{ fontWeight: 650 }}>{users[b.userId]?.displayName ?? "Unknown user"}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{b.reason || "No reason given"}</div>
            </div>
            <button
              className="btn tiny secondary"
              onClick={async () => {
                try {
                  await api.del(`servers/${serverId}/bans/${b.userId}`);
                  toast("Unbanned.", "success");
                  load();
                } catch (e) {
                  toast(errMsg(e), "error");
                }
              }}
            >
              Unban
            </button>
          </div>
        ))
      )}
    </>
  );
}

function DeleteServer({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const s = useStore((st) => st.servers[serverId]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!s) return null;
  return (
    <Modal
      onClose={onClose}
      title={`Delete “${s.name}”`}
      sub="Are you sure? All channels and messages go with it. This can’t be undone."
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn danger"
            disabled={name !== s.name || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.del(`servers/${serverId}`);
                removeServer(serverId);
                window.dispatchEvent(new CustomEvent("dabber:server-gone", { detail: serverId }));
                toast(`${s.name} was deleted.`);
              } catch (e) {
                toast(errMsg(e), "error");
                setBusy(false);
              }
            }}
          >
            Delete Server
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="del-name">Type the server name to confirm</label>
          <input id="del-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={s.name} autoFocus />
        </div>
      </div>
    </Modal>
  );
}

export function ServerSettings({ serverId }: { serverId: string }) {
  const server = useStore((s) => s.servers[serverId]);
  const tab = useStore((s) => s.serverSettings?.tab ?? "overview");
  const me = useStore((s) => s.me?.id);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".overlay, .ctx-menu")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!server) return null;
  const p = server.myPermissions;
  const tabs = [
    { key: "overview", label: "Overview", show: true },
    { key: "roles", label: "Roles", show: hasPerm(p, Perm.MANAGE_ROLES) },
    { key: "members", label: "Members", show: hasPerm(p, Perm.KICK) || hasPerm(p, Perm.BAN) || hasPerm(p, Perm.MANAGE_ROLES) || hasPerm(p, Perm.MANAGE_NICKNAMES) },
    { key: "invites", label: "Invites", show: hasPerm(p, Perm.CREATE_INVITE) },
    { key: "bans", label: "Bans", show: hasPerm(p, Perm.BAN) },
  ].filter((t) => t.show);
  const go = (k: string) => set({ serverSettings: { serverId, tab: k } });
  return (
    <div className="settings" role="dialog" aria-modal="true" aria-label="Server settings">
      <nav className="settings-nav" aria-label="Server settings sections">
        <div className="sn-inner">
          <div className="settings-nav-group" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {server.name}
          </div>
          {tabs.map((t) => (
            <button key={t.key} aria-current={tab === t.key ? "page" : undefined} onClick={() => go(t.key)}>
              {t.label}
            </button>
          ))}
          {server.ownerId === me && (
            <>
              <div className="sn-sep" />
              <button className="danger" onClick={() => setDeleting(true)}>
                Delete Server
              </button>
            </>
          )}
        </div>
      </nav>
      <main className="settings-main">
        <div className="sm-inner">
          {tab === "overview" && <Overview key={`${server.name}-${server.icon}-${server.isPublic}-${server.description}-${server.bannerColor}`} serverId={serverId} />}
          {tab === "roles" && <Roles serverId={serverId} />}
          {tab === "members" && <Members serverId={serverId} />}
          {tab === "invites" && <Invites serverId={serverId} />}
          {tab === "bans" && <Bans serverId={serverId} />}
        </div>
      </main>
      <button className="settings-close" onClick={close} aria-label="Close server settings">
        <span className="circle">
          <X size={18} />
        </span>
        <span className="label-text">ESC</span>
      </button>
      {deleting && <DeleteServer serverId={serverId} onClose={() => setDeleting(false)} />}
    </div>
  );
}
