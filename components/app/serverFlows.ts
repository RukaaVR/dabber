"use client";

import { api, errMsg } from "@/lib/client/api";
import { get, removeServer, set, toast } from "@/lib/client/store";
import { channelLabel, displayName } from "@/lib/client/selectors";

function confirm(title: string, body: string, confirmLabel: string, onConfirm: () => Promise<void>, danger = true) {
  set({ modal: { kind: "confirm", title, body, confirm: confirmLabel, danger, onConfirm } });
}

export function leaveServerFlow(serverId: string) {
  const s = get().servers[serverId];
  if (!s) return;
  confirm(`Leave ${s.name}?`, `You won’t be able to rejoin ${s.name} unless you’re invited again.`, "Leave server", async () => {
    await api.post(`servers/${serverId}/leave`);
    removeServer(serverId);
    window.dispatchEvent(new CustomEvent("dabber:server-gone", { detail: serverId }));
    toast(`You left ${s.name}.`);
  });
}

export function deleteChannelFlow(channelId: string) {
  const c = get().channels[channelId];
  if (!c) return;
  confirm(
    "Delete channel",
    `Delete ${c.type === "voice" ? "" : "#"}${c.name}? All of its messages go with it. This can’t be undone.`,
    "Delete channel",
    async () => {
      await api.del(`channels/${channelId}`);
      toast("Channel deleted.");
    },
  );
}

export function deleteCategoryFlow(categoryId: string) {
  const c = get().categories[categoryId];
  if (!c) return;
  confirm(
    "Remove this category?",
    `“${c.name}” goes away. Its channels stay; they move back to the top of the list.`,
    "Remove category",
    async () => {
      await api.del(`categories/${categoryId}`);
    },
  );
}

export function kickFlow(serverId: string, userId: string) {
  const name = displayName(get(), userId, serverId);
  confirm(`Kick ${name}?`, `${name} gets removed from the server. They can come back with an invite.`, "Kick", async () => {
    await api.del(`servers/${serverId}/members/${userId}`);
    toast(`${name} was kicked.`);
  });
}

export function leaveGroupFlow(channelId: string) {
  const c = get().channels[channelId];
  if (!c) return;
  confirm(
    `Leave ${channelLabel(get(), c)}?`,
    "You won’t get its messages anymore, and you’ll need someone to add you back.",
    "Leave group",
    async () => {
      await api.post(`dms/${channelId}/leave`);
    },
  );
}

export function removeFriendFlow(userId: string) {
  const name = displayName(get(), userId);
  confirm(`Remove ${name}?`, `Are you sure you want to remove ${name} from your friends?`, "Remove friend", async () => {
    await api.del(`friends/${userId}`);
  });
}

export function blockFlow(userId: string) {
  const name = displayName(get(), userId);
  confirm(
    `Block ${name}?`,
    `They won’t be able to message you or send friend requests, and you’ll stop seeing their messages. You’ll also stop being friends.`,
    "Block",
    async () => {
      await api.put(`blocks/${userId}`);
      toast(`${name} is blocked.`);
    },
  );
}

export async function unblock(userId: string) {
  try {
    await api.del(`blocks/${userId}`);
  } catch (e) {
    toast(errMsg(e), "error");
  }
}

export async function sendFriendRequest(userId: string) {
  try {
    const r = await api.post<{ accepted: boolean }>("friends", { userId });
    toast(r.accepted ? "You’re friends now!" : "Friend request sent.", "success");
  } catch (e) {
    toast(errMsg(e), "error");
  }
}
