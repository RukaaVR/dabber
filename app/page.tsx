import Link from "next/link";
import { cookies } from "next/headers";
import { Hash, Volume2 } from "lucide-react";
import { SESSION_COOKIE, userIdFromToken } from "@/lib/server/auth";
import { LiveCount } from "@/components/LiveCount";
import { SiteFoot, SiteTop } from "@/components/SiteChrome";
import { Img } from "@/components/ui/Img";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "/illustrations/feature-free.png",
    title: "The good stuff, free",
    text: "Animated avatars, big uploads, themes and accent colors, as many servers as you like. No subscription, no catch.",
  },
  {
    icon: "/illustrations/feature-servers.png",
    title: "Servers for every crew",
    text: "Make a space for your friends, your class or your whole community. Channels, categories, roles and invite links included.",
  },
  {
    icon: "/illustrations/feature-voice.png",
    title: "Hop in voice, share your screen",
    text: "Drop into a voice channel when you’re free, call friends from DMs, and stream your screen to show what you’re up to.",
  },
  {
    icon: "/illustrations/feature-safety.png",
    title: "You’re in control",
    text: "Block anyone, keep channels private to certain roles, and moderate with kicks, bans and message cleanup.",
  },
  {
    icon: "/illustrations/feature-themes.png",
    title: "Make it yours",
    text: "Dark or light, twelve accent tints, banners and a bio. Your profile card says hi before you do.",
  },
  {
    icon: "/illustrations/feature-selfhost.png",
    title: "Runs anywhere",
    text: "One command and it’s up on your own machine. Your messages live in a single file you control.",
  },
];

const MOCK = [
  { name: "mika", color: "#9b5cf6", text: "anyone up for a match tonight?" },
  { name: "jules", color: "#3d8bff", text: "yes!! already in the Lounge" },
  { name: "rae", color: "#1fbf8f", text: "streaming my screen, come watch me lose 😭" },
  { name: "mika", color: "#9b5cf6", text: "made us a server banner. took 2 seconds", reaction: "🔥 4" },
];

function Mock() {
  return (
    <div className="hp-mock-wrap" aria-hidden="true">
      <Img className="hp-mascot" src="/brand/mascot.png" />
      <div className="hp-mock">
      <div className="hp-mock-rail">
        <span style={{ background: "var(--accent)" }} />
        <span style={{ background: "#ff5fa2", borderRadius: 17 }} />
        <span style={{ background: "#1fbf8f", borderRadius: 17 }} />
        <span style={{ background: "#e8a10c", borderRadius: 17 }} />
      </div>
      <div className="hp-mock-side">
        <div className="hp-mock-server">Game Night</div>
        <div className="hp-mock-ch on">
          <Hash size={14} /> general
        </div>
        <div className="hp-mock-ch">
          <Hash size={14} /> memes
        </div>
        <div className="hp-mock-ch">
          <Hash size={14} /> clips
        </div>
        <div className="hp-mock-ch">
          <Volume2 size={14} /> Lounge
        </div>
        <div className="hp-mock-voice">
          <span className="hp-av sm" style={{ background: "#3d8bff" }}>
            J
          </span>{" "}
          jules
        </div>
        <div className="hp-mock-voice">
          <span className="hp-av sm" style={{ background: "#1fbf8f" }}>
            R
          </span>{" "}
          rae <span className="live-chip">LIVE</span>
        </div>
      </div>
      <div className="hp-mock-chat">
        <div className="hp-mock-head">
          <Hash size={16} /> general
        </div>
        <div className="hp-mock-msgs">
          {MOCK.map((m, i) => (
            <div key={i} className="hp-mock-msg">
              <span className="hp-av" style={{ background: m.color }}>
                {m.name[0].toUpperCase()}
              </span>
              <div>
                <b style={{ color: m.color }}>{m.name}</b>
                <div>{m.text}</div>
                {m.reaction && <span className="r">{m.reaction}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="hp-mock-input">Message #general</div>
      </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const loggedIn = !!userIdFromToken(token);
  return (
    <div className="hp">
      <div className="hp-wrap">
        <SiteTop loggedIn={loggedIn} />
        <main>
          <section className="hp-hero">
            <div>
              <h1>
                Your group chat, with <span className="grad">room to hang out.</span>
              </h1>
              <p className="hp-sub">
                Dabber is where your friends and communities talk, call and share their screens. Servers, DMs, voice and roles — all of it free.
              </p>
              <div className="hp-ctas">
                <Link href={loggedIn ? "/app" : "/signup"} className="btn hp-btn" style={{ color: "var(--on-accent)" }}>
                  {loggedIn ? "Open Dabber" : "Get started — it’s free"}
                </Link>
                {!loggedIn && (
                  <Link href="/login" className="btn hp-btn secondary">
                    I have an account
                  </Link>
                )}
              </div>
            </div>
            <Mock />
          </section>
          <LiveCount />
          <section className="hp-features" id="features" aria-label="Features">
            {FEATURES.map((f) => (
              <article key={f.title} className="hp-feature">
                <Img src={f.icon} width={64} height={64} />
                <h2>{f.title}</h2>
                <p>{f.text}</p>
              </article>
            ))}
          </section>
          <section className="hp-end">
            <Img src="/brand/mascot.png" />
            <h2>Come dab with us.</h2>
            <p>Making an account takes a minute. No card, no trial, no catch.</p>
            <Link href={loggedIn ? "/app" : "/signup"} className="btn hp-btn" style={{ color: "var(--on-accent)" }}>
              {loggedIn ? "Open Dabber" : "Open Dabber in your browser"}
            </Link>
          </section>
        </main>
        <SiteFoot />
      </div>
    </div>
  );
}
