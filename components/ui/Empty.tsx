import type { ReactNode } from "react";

export type Art = "friends" | "mentions" | "pins" | "chat" | "voice" | "search" | "lost" | "error" | "server";

export function Empty({
  art,
  title,
  children,
  compact,
  action,
}: {
  art?: Art;
  title: string;
  children?: ReactNode;
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={`empty${compact ? " compact" : ""}`}>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {art && <img className="empty-art" src={`/illustrations/${art}.png`} alt="" draggable={false} />}
        <h3>{title}</h3>
        {children && <p>{children}</p>}
        {action && <div style={{ marginTop: 16 }}>{action}</div>}
      </div>
    </div>
  );
}
