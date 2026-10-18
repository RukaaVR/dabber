import { cookies } from "next/headers";
import { SESSION_COOKIE, userIdFromToken } from "@/lib/server/auth";
import { SiteFoot, SiteTop } from "./SiteChrome";

export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return (
    <div className="hp">
      <div className="hp-wrap">
        <SiteTop loggedIn={!!userIdFromToken(token)} />
        <article className="legal">
          <h1>{title}</h1>
          <p style={{ color: "var(--text-faint)" }}>Last updated {updated}</p>
          {children}
        </article>
        <SiteFoot />
      </div>
    </div>
  );
}
