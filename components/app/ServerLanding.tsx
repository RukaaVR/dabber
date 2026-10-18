"use client";

import { useEffect } from "react";
import { Hash } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { set, useStore, type State } from "@/lib/client/store";
import { href, useNav } from "@/lib/client/route";
import { useCan } from "@/lib/client/selectors";
import { Perm } from "@/lib/types";
import { Empty } from "../ui/Empty";
import { BackButton } from "./BackButton";

/** /app/s/:id with no channel: jump to the last or first text channel. */
export function ServerLanding({ serverId }: { serverId: string }) {
  const exists = useStore((s) => !!s.servers[serverId]);
  const textIds = useStore(
    useShallow((s: State) =>
      Object.values(s.channels)
        .filter((c) => c.serverId === serverId && c.type === "text")
        .sort((a, b) => a.position - b.position)
        .map((c) => c.id),
    ),
  );
  const last = useStore((s) => s.prefs.lastChannel[serverId]);
  const canManage = useCan(serverId, Perm.MANAGE_CHANNELS);
  const nav = useNav();

  useEffect(() => {
    if (!window.matchMedia("(min-width: 761px)").matches) return;
    const target = last && textIds.includes(last) ? last : textIds[0];
    if (target) nav(href.server(serverId, target), true);
  }, [serverId, textIds, last, nav]);

  if (!exists)
    return (
      <Empty art="lost" title="Server not found" action={<button className="btn" onClick={() => nav(href.home())}>Go home</button>}>
        You might have left it, or it was deleted.
      </Empty>
    );
  if (textIds.length) return null;
  return (
    <>
      <header className="main-head">
        <BackButton />
      </header>
      <div className="empty">
        <div>
          <div className="chat-start" style={{ display: "grid", placeItems: "center", padding: 0 }}>
            <div className="hash-hero">
              <Hash size={40} />
            </div>
          </div>
          <h3>No text channels</h3>
          <p>Pick a channel on the left, or make one with the + button.</p>
          {canManage && (
            <button className="btn" style={{ marginTop: 16 }} onClick={() => set({ modal: { kind: "create-channel", serverId, categoryId: null } })}>
              Create channel
            </button>
          )}
        </div>
      </div>
    </>
  );
}
