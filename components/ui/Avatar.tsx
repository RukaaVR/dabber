"use client";

import { useStore } from "@/lib/client/store";
import { colorFor, initials } from "@/lib/client/theme";
import type { PublicUser } from "@/lib/types";

const DOT: Record<number, number> = { 16: 8, 20: 9, 24: 10, 32: 12, 36: 13, 40: 14, 48: 16, 80: 22, 96: 26, 120: 30 };

export function defaultAvatar(seed: number) {
  return `/avatars/default-${((seed % 6) + 6) % 6}.png`;
}

export function avatarSrc(u: Pick<PublicUser, "avatar" | "avatarSeed"> | undefined | null) {
  if (!u) return defaultAvatar(0);
  return u.avatar ?? defaultAvatar(u.avatarSeed);
}

export function UserAvatar({
  userId,
  size = 40,
  status,
  speaking,
  user: given,
}: {
  userId: string | null;
  size?: number;
  status?: boolean;
  speaking?: boolean;
  user?: PublicUser;
}) {
  const stored = useStore((s) => (userId ? s.users[userId] : undefined));
  const u = given ?? stored;
  const st = u?.status ?? "offline";
  const dot = DOT[size] ?? Math.max(8, Math.round(size * 0.3));
  return (
    <span className={`avatar${speaking ? " speaking" : ""}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="av-img" src={avatarSrc(u)} alt="" width={size} height={size} loading="lazy" draggable={false} />
      {status && (
        <span
          className={`status-dot ${st}`}
          style={{ width: dot, height: dot, borderWidth: Math.max(2, Math.round(dot / 4)) }}
          aria-label={st}
        />
      )}
    </span>
  );
}

export function ServerIcon({
  name,
  icon,
  size = 48,
  radius,
  seed,
}: {
  name: string;
  icon: string | null;
  size?: number;
  radius?: number | string;
  seed?: string;
}) {
  return (
    <span
      className="srv-icon"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size / 3,
        background: icon ? "var(--bg-elev)" : colorFor(seed ?? name),
        fontSize: Math.max(11, Math.round(size / (initials(name).length > 2 ? 3.4 : 2.6))),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon ? <img src={icon} alt="" draggable={false} /> : initials(name)}
    </span>
  );
}
