import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userIdFromToken } from "@/lib/server/auth";
import { AppRoot } from "@/components/app/AppRoot";

export const metadata: Metadata = { title: "Dabber" };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!userIdFromToken(token)) redirect("/login?next=/app");
  return (
    <>
      <AppRoot />
      {children}
    </>
  );
}
