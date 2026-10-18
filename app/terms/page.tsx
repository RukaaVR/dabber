import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms · Dabber" };
export const dynamic = "force-dynamic";

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="October 2026">
      <p>Dabber is open software you run yourself. Whoever hosts an instance is responsible for it and for the people who use it.</p>
      <h2>Your account</h2>
      <p>Keep your password safe. You’re responsible for what happens under your account. You can delete it from Settings → My Account at any time.</p>
      <h2>Your content</h2>
      <p>You own what you post. You let the instance store and show it to the people you share it with, so the app can work.</p>
      <h2>Acceptable use</h2>
      <p>Follow the Community Guidelines. The host can remove content or accounts that break them.</p>
      <h2>No warranty</h2>
      <p>Dabber is provided as is, without warranties of any kind.</p>
    </LegalPage>
  );
}
