"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export type Route =
  | { kind: "home"; friends: boolean }
  | { kind: "dm"; channelId: string }
  | { kind: "server"; serverId: string; channelId: string | null }
  | { kind: "discover" };

export function parseRoute(path: string): Route {
  const p = path.split("/").filter(Boolean); // ["app", ...]
  if (p[1] === "dm" && p[2]) return { kind: "dm", channelId: p[2] };
  if (p[1] === "s" && p[2]) return { kind: "server", serverId: p[2], channelId: p[3] ?? null };
  if (p[1] === "discover") return { kind: "discover" };
  return { kind: "home", friends: p[1] === "friends" };
}

export const href = {
  home: () => "/app",
  friends: () => "/app/friends",
  dm: (id: string) => `/app/dm/${id}`,
  server: (sid: string, cid?: string | null) => (cid ? `/app/s/${sid}/${cid}` : `/app/s/${sid}`),
  discover: () => "/app/discover",
};

export function useRoute(): Route {
  return parseRoute(usePathname() ?? "/app");
}

export function useNav() {
  const router = useRouter();
  return useCallback((to: string, replace = false) => (replace ? router.replace(to) : router.push(to)), [router]);
}
