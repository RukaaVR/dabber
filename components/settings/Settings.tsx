"use client";

import { useEffect, useState } from "react";
import { X, Camera } from "lucide-react";
import { set, setPrefs, toast, useStore } from "@/lib/client/store";
import { api, errMsg, uploadImage } from "@/lib/client/api";
import { logout, copy } from "@/lib/client/actions";
import { ACCENTS, colorFor } from "@/lib/client/theme";
import { play } from "@/lib/client/sounds";
import { Switch } from "../ui/Switch";
import { UserAvatar, defaultAvatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";

const SECTIONS = [
  { group: "User settings", items: [
    { key: "account", label: "My Account" },
    { key: "profile", label: "Profile" },
  ] },
  { group: "App settings", items: [
    { key: "appearance", label: "Appearance" },
    { key: "notifications", label: "Notifications" },
    { key: "voice", label: "Voice & Audio" },
    { key: "keybinds", label: "Keybinds" },
  ] },
];

const BANNERS = ["#7b61ff", "#ff5fa2", "#1fbf8f", "#e8a10c", "#3d8bff", "#ff6f59", "#2b2c33", "#9b5cf6", "#14a3b8"];

function closeSettings() {
  set({ settingsOpen: null });
}

function useEsc(fn: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".overlay, .ctx-menu, .emoji-picker")) return;
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fn]);
}

function Account() {
  const me = useStore((s) => s.me)!;
  const [editing, setEditing] = useState<null | "username" | "password" | "delete">(null);
  return (
    <>
      <h1>My Account</h1>
      <div className="me-preview">
        <div className="mp-banner" style={{ background: me.bannerColor ?? `linear-gradient(135deg, ${colorFor(me.avatarSeed)}, var(--accent-2))` }} />
        <div className="mp-row">
          <UserAvatar userId={me.id} size={80} status user={{ ...me, status: me.statusPref === "invisible" ? "offline" : me.statusPref }} />
          <div style={{ paddingBottom: 6, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{me.displayName}</div>
          </div>
          <button className="btn small" style={{ marginBottom: 10 }} onClick={() => set({ settingsOpen: "profile" })}>
            Edit User Profile
          </button>
        </div>
        <div className="mp-info">
          <div className="mp-field">
            <div>
              <div className="k">Display name</div>
              <div>{me.displayName}</div>
            </div>
            <button className="btn small secondary" onClick={() => set({ settingsOpen: "profile" })}>
              Edit
            </button>
          </div>
          <div className="mp-field">
            <div>
              <div className="k">Username</div>
              <div>{me.username}</div>
            </div>
            <button className="btn small secondary" onClick={() => setEditing("username")}>
              Edit
            </button>
          </div>
          <div className="mp-field">
            <div>
              <div className="k">User ID</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{me.id}</div>
            </div>
            <button className="btn small secondary" onClick={() => copy(me.id, "User ID copied")}>
              Copy
            </button>
          </div>
        </div>
      </div>
      <div className="section-label" style={{ marginTop: 28 }}>
        Password and security
      </div>
      <button className="btn" onClick={() => setEditing("password")}>
        Change Password
      </button>
      <div className="danger-zone">
        <h3>Delete account</h3>
        <p>Everything goes: your messages, servers you own and your friends list. This can’t be undone.</p>
        <button className="btn danger" onClick={() => setEditing("delete")}>
          Delete Account
        </button>
      </div>
      {editing === "username" && <UsernameModal current={me.username} onClose={() => setEditing(null)} />}
      {editing === "password" && <PasswordModal onClose={() => setEditing(null)} />}
      {editing === "delete" && <DeleteModal onClose={() => setEditing(null)} />}
    </>
  );
}

function UsernameModal({ current, onClose }: { current: string; onClose: () => void }) {
  const [u, setU] = useState(current);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch("users/me", { username: u.trim().toLowerCase() });
      toast("Username changed.", "success");
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      onClose={onClose}
      title="Change your username"
      sub="Friends add you with this. Letters, numbers, _ and . only."
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy || !u.trim()} onClick={() => void save()}>
            Done
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="un">Username</label>
          <input id="un" className={`input${err ? " invalid" : ""}`} value={u} onChange={(e) => { setU(e.target.value); setErr(null); }} maxLength={32} autoFocus />
          {err && <span className="error-text">{err}</span>}
        </div>
      </div>
    </Modal>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (next !== confirm) return setErr("The new passwords don’t match.");
    setBusy(true);
    try {
      await api.post("users/me/password", { current: cur, next });
      toast("Password changed. Other devices were logged out.", "success");
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      onClose={onClose}
      title="Update your password"
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy || !cur || next.length < 6} onClick={() => void save()}>
            Done
          </button>
        </>
      }
    >
      <form className="modal-body" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="field">
          <label htmlFor="pw-cur">Current password</label>
          <input id="pw-cur" type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} />
          <span className="hint">At least 6 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">Confirm new password</label>
          <input id="pw-confirm" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        {err && <p className="error-text">{err}</p>}
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}

function DeleteModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      onClose={onClose}
      title="Delete account"
      sub="Are you sure? Your account and everything in it will be gone for good."
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn danger"
            disabled={busy || !pw}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post("users/me/delete", { password: pw });
                window.location.href = "/";
              } catch (e) {
                setErr(errMsg(e));
                setBusy(false);
              }
            }}
          >
            Delete Account
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="field">
          <label htmlFor="del-pw">Password</label>
          <input id="del-pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          {err && <span className="error-text">{err}</span>}
        </div>
      </div>
    </Modal>
  );
}

function Profile() {
  const me = useStore((s) => s.me)!;
  const [draft, setDraft] = useState({
    displayName: me.displayName,
    pronouns: me.pronouns,
    about: me.about,
    bannerColor: me.bannerColor,
    avatar: me.avatar,
    avatarSeed: me.avatarSeed,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dirty =
    draft.displayName !== me.displayName ||
    draft.pronouns !== me.pronouns ||
    draft.about !== me.about ||
    draft.bannerColor !== me.bannerColor ||
    draft.avatar !== me.avatar ||
    draft.avatarSeed !== me.avatarSeed;
  const reset = () => setDraft({ displayName: me.displayName, pronouns: me.pronouns, about: me.about, bannerColor: me.bannerColor, avatar: me.avatar, avatarSeed: me.avatarSeed });
  const save = async () => {
    if (!draft.displayName.trim()) return toast("Display name can’t be empty.", "error");
    setBusy(true);
    try {
      await api.patch("users/me", { ...draft, displayName: draft.displayName.trim() });
      toast("Profile saved.", "success");
      play("success");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const preview = { ...me, ...draft, status: me.statusPref === "invisible" ? ("offline" as const) : me.statusPref };
  return (
    <>
      <h1>Profile</h1>
      <div className="profile-editor-grid">
        <div>
          <div className="field">
            <label htmlFor="p-dn">Display name</label>
            <input id="p-dn" className="input" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} maxLength={32} />
          </div>
          <div className="field">
            <label htmlFor="p-pr">Pronouns</label>
            <input id="p-pr" className="input" value={draft.pronouns} onChange={(e) => setDraft({ ...draft, pronouns: e.target.value })} maxLength={40} placeholder="Add your pronouns" />
          </div>
          <div className="field">
            <label>Avatar</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label className="btn small" style={{ cursor: "pointer" }}>
                <Camera size={15} /> {uploading ? "Uploading…" : "Change Avatar"}
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setUploading(true);
                    try {
                      const url = await uploadImage(f);
                      setDraft((d) => ({ ...d, avatar: url }));
                    } catch (err) {
                      toast(errMsg(err), "error");
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              {draft.avatar && (
                <button className="btn small ghost" onClick={() => setDraft({ ...draft, avatar: null })}>
                  Remove Avatar
                </button>
              )}
            </div>
            <span className="hint" style={{ marginTop: 6 }}>Or pick a Dab:</span>
            <div className="swatches">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  className="swatch"
                  style={{ width: 44, height: 44, borderRadius: "50%", padding: 0, overflow: "hidden" }}
                  aria-pressed={!draft.avatar && draft.avatarSeed === i}
                  aria-label={`Default avatar ${i + 1}`}
                  onClick={() => setDraft({ ...draft, avatar: null, avatarSeed: i })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={defaultAvatar(i)} alt="" width={44} height={44} />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Banner color</label>
            <div className="swatches">
              <button className="swatch" aria-pressed={!draft.bannerColor} aria-label="Default color" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }} onClick={() => setDraft({ ...draft, bannerColor: null })} />
              {BANNERS.map((c) => (
                <button key={c} className="swatch" aria-pressed={draft.bannerColor === c} aria-label={`Banner ${c}`} style={{ background: c }} onClick={() => setDraft({ ...draft, bannerColor: c })} />
              ))}
              <label className="swatch" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)", cursor: "pointer" }} aria-label="Custom color">
                <input type="color" value={draft.bannerColor ?? "#7b61ff"} onChange={(e) => setDraft({ ...draft, bannerColor: e.target.value })} style={{ opacity: 0, width: "100%", height: "100%" }} />
              </label>
            </div>
          </div>
          <div className="field">
            <label htmlFor="p-about">About me</label>
            <textarea id="p-about" className="textarea" value={draft.about} onChange={(e) => setDraft({ ...draft, about: e.target.value })} maxLength={190} placeholder="Tell people a little about yourself" />
            <span className="hint">{190 - draft.about.length} characters left</span>
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>
            Preview
          </div>
          <div className="profile-card" style={{ position: "static", width: "100%", animation: "none" }}>
            <div className="pc-banner" style={{ background: draft.bannerColor ?? `linear-gradient(135deg, ${colorFor(draft.avatarSeed)}, var(--accent-2))` }} />
            <div className="pc-avatar">
              <UserAvatar userId={me.id} size={80} status user={preview} />
            </div>
            <div className="pc-body">
              <div className="pc-name">{draft.displayName || me.username}</div>
              <div className="pc-uname">
                {me.username}
                {draft.pronouns && ` · ${draft.pronouns}`}
              </div>
              {draft.about && (
                <div className="pc-section">
                  <h4>About me</h4>
                  <div className="pc-about">{draft.about}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {dirty && (
        <div className="save-bar" role="region" aria-label="Unsaved changes">
          <span className="grow">Careful — you have unsaved changes!</span>
          <button className="btn small ghost" onClick={reset}>
            Reset
          </button>
          <button className="btn small success" disabled={busy} onClick={() => void save()}>
            Save Changes
          </button>
        </div>
      )}
    </>
  );
}

function Appearance() {
  const prefs = useStore((s) => s.prefs);
  return (
    <>
      <h1>Appearance</h1>
      <div className="section-label">Theme</div>
      <div className="theme-tiles">
        {(
          [
            ["dark", "Dark", "#121318", "#202128", "#2a2b33"],
            ["light", "Light", "#e4e5ea", "#ffffff", "#ebecf0"],
          ] as const
        ).map(([k, l, a, b, c]) => (
          <button key={k} className="theme-tile" aria-pressed={prefs.theme === k} onClick={() => setPrefs({ theme: k })}>
            <div className="tt-prev" style={{ background: a }}>
              <span style={{ width: 16, borderRadius: 4, background: c }} />
              <span style={{ flex: 1, borderRadius: 4, background: b }} />
            </div>
            <div className="tt-label">{l}</div>
          </button>
        ))}
      </div>
      <div className="section-label" style={{ marginTop: 28 }}>
        Accent color
      </div>
      <div className="tint-grid">
        {Object.entries(ACCENTS).map(([k, a]) => (
          <button key={k} className="tint-tile" aria-pressed={prefs.accent === k} onClick={() => setPrefs({ accent: k })}>
            <div className="tint-swatch" style={{ background: `linear-gradient(135deg, ${a.a}, ${a.b})` }} />
            {a.label}
          </button>
        ))}
      </div>
      <div className="section-label" style={{ marginTop: 28 }}>
        Text size
      </div>
      <div className="seg" role="group" aria-label="Text size">
        {(
          [
            [0.9, "Small"],
            [1, "Default"],
            [1.1, "Large"],
          ] as const
        ).map(([v, l]) => (
          <button key={l} aria-pressed={prefs.fontScale === v} onClick={() => setPrefs({ fontScale: v })}>
            {l}
          </button>
        ))}
      </div>
    </>
  );
}

function Notifications() {
  const prefs = useStore((s) => s.prefs);
  const [perm, setPerm] = useState<string>(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  return (
    <>
      <h1>Notifications</h1>
      <div className="toggle-row">
        <div>
          <div className="t-title">Desktop notifications</div>
          <div className="t-desc">
            Pop up a notification for DMs and mentions when Dabber isn’t focused.
            {perm === "denied" && " Your browser blocked notifications for this site; allow them in its site settings."}
            {perm === "unsupported" && " Your browser doesn’t support notifications."}
          </div>
        </div>
        <Switch
          checked={prefs.desktopNotifs && perm === "granted"}
          disabled={perm === "denied" || perm === "unsupported"}
          label="Desktop notifications"
          onChange={async (v) => {
            if (v && typeof Notification !== "undefined" && Notification.permission !== "granted") {
              const r = await Notification.requestPermission();
              setPerm(r);
              if (r !== "granted") return;
            }
            setPrefs({ desktopNotifs: v });
          }}
        />
      </div>
      <div className="toggle-row">
        <div>
          <div className="t-title">Sounds</div>
          <div className="t-desc">Message, mention, call and voice sounds. You can also mute them from the speaker button anywhere.</div>
        </div>
        <Switch checked={prefs.sounds} label="Sounds" onChange={(v) => { setPrefs({ sounds: v }); if (v) play("success"); }} />
      </div>
      <div className="section-label" style={{ marginTop: 24 }}>
        Preview sounds
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["send", "receive", "mention", "success", "error", "voice-join", "voice-leave", "mute", "unmute"] as const).map((n) => (
          <button key={n} className="btn small secondary" onClick={() => play(n)} disabled={!prefs.sounds}>
            ▶ {n.replace("-", " ")}
          </button>
        ))}
      </div>
    </>
  );
}

function VoiceSettings() {
  const prefs = useStore((s) => s.prefs);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((d) => setDevices(d.filter((x) => x.kind === "audioinput")))
      .catch(() => {});
  }, [level]);
  const test = async () => {
    if (level !== null) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: prefs.micId ? { deviceId: { ideal: prefs.micId } } : true });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const end = Date.now() + 6000;
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5));
        if (Date.now() < end) requestAnimationFrame(tick);
        else {
          s.getTracks().forEach((t) => t.stop());
          void ctx.close();
          setLevel(null);
        }
      };
      tick();
    } catch {
      toast("Couldn’t open your microphone. Check browser permissions.", "error");
    }
  };
  return (
    <>
      <h1>Voice & Audio</h1>
      <div className="field">
        <label htmlFor="mic">Input device</label>
        <select id="mic" className="select" value={prefs.micId} onChange={(e) => setPrefs({ micId: e.target.value })}>
          <option value="">Default</option>
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `Microphone ${i + 1}`}
            </option>
          ))}
        </select>
        <span className="hint">Used the next time you join voice. Names show after you allow mic access once.</span>
      </div>
      <div className="section-label">Mic test</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn small" onClick={() => void test()} disabled={level !== null}>
          {level !== null ? "Listening…" : "Let’s Check"}
        </button>
        <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--bg-elev)", overflow: "hidden" }} aria-label="Mic level" role="meter" aria-valuenow={Math.round((level ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ height: "100%", width: `${(level ?? 0) * 100}%`, background: "var(--success)", transition: "width .08s" }} />
        </div>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 20 }}>
        Voice uses peer-to-peer WebRTC with echo cancellation and noise suppression. On a LAN it works out of the box; across the internet, set
        <code style={{ margin: "0 4px" }}>NEXT_PUBLIC_ICE_SERVERS</code>to your STUN/TURN servers.
      </p>
    </>
  );
}

function Keybinds() {
  return (
    <>
      <h1>Keybinds</h1>
      {[
        ["Quick switcher", "Ctrl + K"],
        ["Show all shortcuts", "Ctrl + /"],
        ["Open settings", "Ctrl + ,"],
        ["Toggle mute", "Ctrl + Shift + M"],
        ["Toggle deafen", "Ctrl + Shift + D"],
        ["Edit last message", "↑ in an empty box"],
        ["New line", "Shift + Enter"],
        ["Close anything", "Esc"],
      ].map(([a, b]) => (
        <div key={a} className="kbs-row">
          <span>{a}</span>
          <kbd className="kbd">{b}</kbd>
        </div>
      ))}
    </>
  );
}

export function SettingsScreen() {
  const section = useStore((s) => s.settingsOpen) ?? "account";
  const [confirmLogout, setConfirmLogout] = useState(false);
  useEsc(closeSettings);
  return (
    <div className="settings" role="dialog" aria-modal="true" aria-label="User settings">
      <nav className="settings-nav" aria-label="Settings sections">
        <div className="sn-inner">
          {SECTIONS.map((g) => (
            <div key={g.group}>
              <div className="settings-nav-group">{g.group}</div>
              {g.items.map((it) => (
                <button key={it.key} aria-current={section === it.key ? "page" : undefined} onClick={() => set({ settingsOpen: it.key })}>
                  {it.label}
                </button>
              ))}
              <div className="sn-sep" />
            </div>
          ))}
          <button className="danger" onClick={() => setConfirmLogout(true)}>
            Log Out
          </button>
        </div>
      </nav>
      <main className="settings-main">
        <div className="sm-inner">
          {section === "account" && <Account />}
          {section === "profile" && <Profile />}
          {section === "appearance" && <Appearance />}
          {section === "notifications" && <Notifications />}
          {section === "voice" && <VoiceSettings />}
          {section === "keybinds" && <Keybinds />}
        </div>
      </main>
      <button className="settings-close" onClick={closeSettings} aria-label="Close settings">
        <span className="circle">
          <X size={18} />
        </span>
        <span className="label-text">ESC</span>
      </button>
      {confirmLogout && (
        <Modal
          onClose={() => setConfirmLogout(false)}
          title="Log Out"
          foot={
            <>
              <button className="btn ghost" onClick={() => setConfirmLogout(false)}>
                Cancel
              </button>
              <button className="btn danger" onClick={() => void logout()}>
                Log Out
              </button>
            </>
          }
        >
          <div className="modal-body">
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Are you sure you want to log out?</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
