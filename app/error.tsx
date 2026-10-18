"use client";

import { useEffect } from "react";
import { Empty } from "@/components/ui/Empty";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ padding: 8 }}>
        <Empty art="error" title="Something broke" action={<button className="btn" onClick={reset}>Try again</button>}>
          Dabber hit a snag drawing this page. Your messages are safe.
        </Empty>
      </div>
    </div>
  );
}
