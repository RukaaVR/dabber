"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client/api";
import { colorFor } from "@/lib/client/theme";
import type { InviteInfo } from "@/lib/types";
import { ServerIcon } from "./ui/Avatar";
import { Empty } from "./ui/Empty";

export function InviteView({ code }: { code: string }) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    api
      .get<InviteInfo>(`invites/${encodeURIComponent(code)}`)
      .then(setInfo)
      .catch((e) => setError(errMsg(e)));
    api
      .get<{ signedIn: boolean }>("auth/session")
      .then((r) => setMe(r.signedIn))
      .catch(() => setMe(false));
  }, [code]);

  const join = async () => {
    if (!info) return;
    if (!me) {
      router.push(`/signup?next=${encodeURIComponent(`/invite/${code}`)}`);
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<{ firstChannelId: string | null }>(`invites/${encodeURIComponent(code)}`);
      window.location.href = r.firstChannelId ? `/app/s/${info.server.id}/${r.firstChannelId}` : `/app/s/${info.server.id}`;
    } catch (e) {
      setJoinErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      {error ? (
        <div className="invite-card" style={{ padding: "8px 8px 24px" }}>
          <Empty art="lost" title="Invite invalid" action={<Link className="btn" href="/app" style={{ color: "var(--on-accent)" }}>Continue to Dabber</Link>}>
            This invite may have expired, or the server is gone.
          </Empty>
        </div>
      ) : !info ? (
        <div className="invite-card" style={{ padding: 40 }} aria-busy="true">
          <div className="skeleton" style={{ width: 80, height: 80, borderRadius: 22, margin: "0 auto 16px" }} />
          <div className="skeleton" style={{ width: 180, height: 16, margin: "0 auto 10px" }} />
          <div className="skeleton" style={{ width: 120, height: 12, margin: "0 auto" }} />
        </div>
      ) : (
        <div className="invite-card">
          <div className="ic-banner" style={{ background: info.server.bannerColor ?? `linear-gradient(135deg, ${colorFor(info.server.id)}, var(--accent-2))` }} />
          <div className="ic-icon">
            <ServerIcon name={info.server.name} icon={info.server.icon} size={80} radius={20} seed={info.server.id} />
          </div>
          <div className="ic-body">
            <p style={{ color: "var(--text-muted)", margin: "6px 0 0", fontSize: 14 }}>
              {info.inviter ? `${info.inviter.displayName} invited you to join` : "You’ve been invited to join"}
            </p>
            <h1>{info.server.name}</h1>
            {info.server.description && <p style={{ color: "var(--text-muted)", margin: "0 0 4px", fontSize: 14 }}>{info.server.description}</p>}
            <div className="ic-counts">
              <span>
                <span className="status-pip" style={{ background: "var(--success)" }} /> {info.onlineCount} Online
              </span>
              <span>
                <span className="status-pip" style={{ background: "var(--offline)" }} /> {info.memberCount} Member{info.memberCount === 1 ? "" : "s"}
              </span>
            </div>
            {joinErr && (
              <div className="form-error" style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 }} role="alert">
                {joinErr}
              </div>
            )}
            {info.joined ? (
              <Link className="btn block" href={`/app/s/${info.server.id}`} style={{ height: 44, color: "var(--on-accent)" }}>
                Go to Server
              </Link>
            ) : (
              <button className="btn block" style={{ height: 44 }} onClick={() => void join()} disabled={busy || me === null}>
                {busy ? "Joining…" : me === false ? "Sign up to join" : "Accept Invite"}
              </button>
            )}
            {me === false && (
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 12 }}>
                Have an account? <Link href={`/login?next=${encodeURIComponent(`/invite/${code}`)}`}>Log in</Link>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
