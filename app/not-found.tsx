import Link from "next/link";
import { Empty } from "@/components/ui/Empty";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ padding: 8 }}>
        <Empty art="lost" title="Page not found" action={<Link href="/" className="btn" style={{ color: "var(--on-accent)" }}>Take me home</Link>}>
          We looked everywhere, even under the couch. This page doesn’t exist.
        </Empty>
      </div>
    </div>
  );
}
