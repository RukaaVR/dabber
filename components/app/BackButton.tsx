"use client";

import { ArrowLeft } from "lucide-react";
import { href, useNav, useRoute } from "@/lib/client/route";

/** Mobile-only back arrow in the main header: returns to the sidebar list. */
export function BackButton() {
  const nav = useNav();
  const route = useRoute();
  const to = route.kind === "server" ? href.server(route.serverId) : href.home();
  return (
    <button className="icon-btn back" aria-label="Back" onClick={() => nav(to)}>
      <ArrowLeft size={20} />
    </button>
  );
}
