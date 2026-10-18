import Link from "next/link";
import { Logo } from "./ui/Logo";

export const FOOT_LINKS = [
  { href: "/guidelines", label: "Guidelines" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteTop({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="hp-top">
      <Logo size={36} />
      <nav className="hp-nav" aria-label="Main">
        <Link href="/guidelines" className="hide-sm">
          Guidelines
        </Link>
        <Link href="/#features" className="hide-sm">
          Features
        </Link>
        {loggedIn ? (
          <Link href="/app" className="btn small" style={{ color: "var(--on-accent)" }}>
            Open Dabber
          </Link>
        ) : (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn small" style={{ color: "var(--on-accent)" }}>
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function SiteFoot() {
  return (
    <footer className="hp-foot">
      <Logo size={24} />
      <nav aria-label="Footer">
        {FOOT_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
        <span style={{ color: "var(--text-faint)", fontSize: 14 }}>Runs on your own machine.</span>
      </nav>
    </footer>
  );
}
