import type { Metadata } from "next";
import { InviteView } from "@/components/InviteView";

export const metadata: Metadata = { title: "You’re invited · Dabber" };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <InviteView code={code} />;
}
