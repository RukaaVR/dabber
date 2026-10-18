"use client";

import { useEffect, useState } from "react";
import { Compass, Search, Users } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { joinPublic } from "@/lib/client/actions";
import { toast } from "@/lib/client/store";
import { href, useNav } from "@/lib/client/route";
import { colorFor } from "@/lib/client/theme";
import type { DiscoverServer } from "@/lib/types";
import { ServerIcon } from "../ui/Avatar";
import { Empty } from "../ui/Empty";
import { BackButton } from "./BackButton";
import { Img } from "../ui/Img";

export function DiscoverView() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popular" | "new" | "az">("popular");
  const [list, setList] = useState<DiscoverServer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const nav = useNav();

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api
        .get<DiscoverServer[]>(`discover?q=${encodeURIComponent(q.trim())}&sort=${sort}`)
        .then((r) => {
          if (alive) {
            setList(r);
            setError(null);
          }
        })
        .catch((e) => alive && setError(errMsg(e)));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, sort, retry]);

  const open = async (s: DiscoverServer) => {
    if (s.joined) return nav(href.server(s.id));
    setBusy(s.id);
    try {
      const r = await joinPublic(s.id);
      toast(`Welcome to ${s.name}!`, "success");
      nav(href.server(s.id, r.firstChannelId));
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <header className="main-head">
        <BackButton />
        <div className="title">
          <Compass size={20} style={{ color: "var(--text-muted)" }} />
          <h1 className="t" style={{ fontSize: 16, margin: 0 }}>
            Discover
          </h1>
        </div>
      </header>
      <div className="discover">
        <section className="discovery-hero">
          <Img className="dh-art" src="/illustrations/discover-hero.png" />
          <div>
            <h1>Find your people</h1>
            <p>Public servers on Dabber. Search by name or topic, then hop right in.</p>
            <label className="dh-search">
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search servers…" aria-label="Search servers" />
            </label>
          </div>
        </section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{q.trim() ? `Results for “${q.trim()}”` : "Public servers"}</h2>
          <div className="seg" role="group" aria-label="Sort">
            {(
              [
                ["popular", "Most active"],
                ["new", "Newest"],
                ["az", "A to Z"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <Empty art="error" title="Couldn’t load servers" action={<button className="btn" onClick={() => setRetry((x) => x + 1)}>Try again</button>}>
            {error}
          </Empty>
        ) : !list ? (
          <div className="discover-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton" style={{ height: 230, borderRadius: 14 }} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty art="search" title={q.trim() ? "Nothing matches" : "No public servers yet"}>
            {q.trim()
              ? "Try a different word."
              : "Server owners can list theirs in Server Settings → Overview → Show in Discover."}
          </Empty>
        ) : (
          <div className="discover-grid">
            {list.map((s) => (
              <button key={s.id} className="discovery-card" onClick={() => void open(s)} disabled={busy === s.id}>
                <div className="dc-banner" style={{ background: s.bannerColor ?? `linear-gradient(135deg, ${colorFor(s.id)}, var(--accent-2))` }} />
                <div className="dc-icon">
                  <ServerIcon name={s.name} icon={s.icon} size={48} radius={12} seed={s.id} />
                </div>
                <div className="dc-body">
                  <h3>{s.name}</h3>
                  <p>{s.description || "A cozy corner of Dabber."}</p>
                  <div className="dc-stats">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span className="status-pip" style={{ background: "var(--success)" }} /> {s.onlineCount} online
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Users size={13} /> {s.memberCount} member{s.memberCount === 1 ? "" : "s"}
                    </span>
                    {s.joined && <span style={{ marginLeft: "auto", color: "var(--success)", fontWeight: 700 }}>Joined</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
