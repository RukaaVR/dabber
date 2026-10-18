"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { Logo } from "./ui/Logo";

const COPY = {
  login: { title: "Welcome back!", sub: "Good to see you dabbing again.", button: "Log In" },
  signup: { title: "Create an account", sub: "It’s free. Like, actually free.", button: "Continue" },
};

function safeNext(raw: string | null) {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/app";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avail, setAvail] = useState<null | { available: boolean; valid: boolean }>(null);
  const [next, setNext] = useState("/app");
  const c = COPY[mode];

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  useEffect(() => {
    if (mode !== "signup" || username.length < 2) return setAvail(null);
    const t = setTimeout(() => {
      api
        .get<{ available: boolean; valid: boolean }>(`auth/username-available?u=${encodeURIComponent(username.toLowerCase())}`)
        .then(setAvail)
        .catch(() => setAvail(null));
    }, 300);
    return () => clearTimeout(t);
  }, [username, mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await api.post("auth/signup", { username: username.trim().toLowerCase(), displayName: displayName.trim(), password });
      else await api.post("auth/login", { username: username.trim(), password });
      window.location.href = next;
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const qs = next !== "/app" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-logo">
          <Logo size={44} text={false} />
        </div>
        <h1>{c.title}</h1>
        <p className="auth-sub">{c.sub}</p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={32}
            autoFocus
          />
          {mode === "signup" && username.length >= 2 && avail && (
            <span className={avail.valid && avail.available ? "hint" : "error-text"} style={avail.valid && avail.available ? { color: "var(--success)" } : undefined}>
              {!avail.valid ? "Use a–z, 0–9, _ and . only." : avail.available ? "Nice, that one’s free." : "That username is taken."}
            </span>
          )}
        </div>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input id="displayName" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={username || "What people see"} maxLength={32} autoComplete="nickname" />
            <span className="hint">You can change this any time. Emoji welcome.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="prefixed-input" style={{ paddingRight: 4 }}>
            <input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              style={{ paddingLeft: 12 }}
            />
            <button type="button" className="icon-btn sm" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mode === "signup" && <span className="hint">At least 6 characters.</span>}
          {mode === "login" && (
            <button type="button" className="btn link" style={{ alignSelf: "flex-start", fontSize: 13 }} onClick={() => setForgot((v) => !v)}>
              Forgot your password?
            </button>
          )}
          {forgot && (
            <span className="hint" role="note">
              Dabber runs on your own machine, so there’s no reset email. Whoever runs this server can set a new one with{" "}
              <code>npm run reset-password -- {username || "yourname"} newpassword</code>.
            </span>
          )}
        </div>
        <button className="btn block" style={{ height: 44, marginTop: 6 }} disabled={busy || !username || password.length < (mode === "signup" ? 6 : 1)}>
          {busy ? <span className="spinner" style={{ width: 18, height: 18, borderTopColor: "#fff" }} /> : c.button}
        </button>
        {mode === "login" ? (
          <p className="auth-switch">
            Need an account? <Link href={`/signup${qs}`}>Register</Link>
          </p>
        ) : (
          <p className="auth-switch">
            <Link href={`/login${qs}`}>Already have an account?</Link>
            <br />
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              By signing up you agree to the <Link href="/terms">Terms</Link> and <Link href="/guidelines">Community Guidelines</Link>.
            </span>
          </p>
        )}
      </form>
    </div>
  );
}
