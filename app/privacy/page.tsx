import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy · Dabber" };
export const dynamic = "force-dynamic";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <h2>What’s stored</h2>
      <p>Your username, display name, a hashed password, your profile, the servers you’re in, your messages and the files you upload. That’s it.</p>
      <h2>Where it lives</h2>
      <p>In one SQLite database and an uploads folder on the machine running this Dabber instance. Nothing is sent to third parties.</p>
      <h2>Voice and screen sharing</h2>
      <p>Calls go peer to peer between browsers over WebRTC. The server only passes connection setup messages; it never records audio or video.</p>
      <h2>Cookies</h2>
      <p>One HttpOnly session cookie keeps you logged in. Your theme and sound settings stay in your browser’s local storage.</p>
      <h2>Deleting your data</h2>
      <p>Settings → My Account → Delete Account removes your account, your messages and the servers you own.</p>
    </LegalPage>
  );
}
