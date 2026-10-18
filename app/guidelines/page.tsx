import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Community Guidelines · Dabber" };
export const dynamic = "force-dynamic";

export default function Guidelines() {
  return (
    <LegalPage title="Community Guidelines" updated="October 2026">
      <p>Dabber works when people feel safe hanging out. These rules apply everywhere: servers, DMs, groups, voice and profiles.</p>
      <h2>Be decent</h2>
      <ul>
        <li>No harassment, threats, hate speech or bullying.</li>
        <li>Respect “no”. If someone blocks you or asks you to stop, stop.</li>
        <li>Don’t share other people’s private information.</li>
      </ul>
      <h2>Keep it legal and safe</h2>
      <ul>
        <li>No illegal content, scams, malware or phishing links.</li>
        <li>No sexual content involving minors, ever.</li>
        <li>No spam, mass mentions or raid coordination.</li>
      </ul>
      <h2>Server owners</h2>
      <p>You’re responsible for what happens in your server. Use roles, private channels, kicks and bans to keep it a good place.</p>
      <h2>Tools you have</h2>
      <p>Block anyone from their profile card. Server moderators can delete messages, kick and ban. Owners can delete the whole server.</p>
    </LegalPage>
  );
}
