"use client";

import { useEffect, useState } from "react";
import { api, errMsg } from "@/lib/client/api";
import { joinInvite } from "@/lib/client/actions";
import { toast, useStore } from "@/lib/client/store";
import { href, useNav } from "@/lib/client/route";
import type { InviteInfo } from "@/lib/types";
import { ServerIcon } from "../ui/Avatar";

const cache = new Map<string, Promise<InviteInfo | null>>();

function fetchInvite(code: string) {
  let p = cache.get(code);
  if (!p) {
    p = api.get<InviteInfo>(`invites/${encodeURIComponent(code)}`).catch(() => null);
    cache.set(code, p);
  }
  return p;
}

/** Codes of invite links to this Dabber instance found in a message. */
export function inviteCodes(text: string): string[] {
  if (typeof window === "undefined") return [];
  const host = window.location.host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`https?://${host}/invite/([A-Za-z0-9]{4,16})`, "g");
  return [...new Set([...text.matchAll(re)].map((m) => m[1]))].slice(0, 3);
}

export function InviteEmbed({ code }: { code: string }) {
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const joined = useStore((s) => (info ? !!s.servers[info.server.id] : false));
  const nav = useNav();
  useEffect(() => {
    let alive = true;
    void fetchInvite(code).then((r) => alive && setInfo(r));
    return () => {
      alive = false;
    };
  }, [code]);

  if (info === undefined)
    return (
      <div className="invite-embed" aria-busy="true">
        <div className="ie-label">You’ve been invited to join a server</div>
        <div className="ie-row">
          <div className="skeleton" style={{ width: 50, height: 50, borderRadius: 16 }} />
          <div className="skeleton" style={{ width: 140, height: 14 }} />
        </div>
      </div>
    );
  if (info === null)
    return (
      <div className="invite-embed">
        <div className="ie-label">Invite invalid</div>
        <div className="ie-row" style={{ color: "var(--text-muted)", fontSize: 14 }}>
          This invite may have expired, or the server is gone.
        </div>
      </div>
    );
  return (
    <div className="invite-embed">
      <div className="ie-label">You’ve been invited to join a server</div>
      <div className="ie-row">
        <ServerIcon name={info.server.name} icon={info.server.icon} size={50} radius={16} seed={info.server.id} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ie-name">{info.server.name}</div>
          <div className="ie-counts">
            <span>
              <span className="status-pip" style={{ background: "var(--success)", width: 8, height: 8 }} /> {info.onlineCount} Online
            </span>
            <span>
              <span className="status-pip" style={{ background: "var(--offline)", width: 8, height: 8 }} /> {info.memberCount} Member{info.memberCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {joined ? (
          <button className="btn small secondary" onClick={() => nav(href.server(info.server.id))}>
            Joined
          </button>
        ) : (
          <button
            className="btn small success"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await joinInvite(code);
                nav(href.server(r.server.id, r.firstChannelId));
              } catch (e) {
                toast(errMsg(e), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Join
          </button>
        )}
      </div>
    </div>
  );
}
