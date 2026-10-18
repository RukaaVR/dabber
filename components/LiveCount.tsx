"use client";

import { useEffect, useState } from "react";

export function LiveCount() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d: { online: number }) => alive && setN(d.online))
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <section className="hp-live" aria-live="polite">
      <span className="hp-live-dot" aria-hidden="true" />
      {n === null ? (
        <p>Checking who’s around…</p>
      ) : n === 0 ? (
        <p>
          <b>Be the first</b> one online right now
        </p>
      ) : (
        <p>
          <b>{n.toLocaleString("en-US")}</b> {n === 1 ? "person" : "people"} online now
        </p>
      )}
    </section>
  );
}
