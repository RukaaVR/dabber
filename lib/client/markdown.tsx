"use client";

import { Fragment, useState, type ReactNode } from "react";

// A small, safe markdown subset rendered to React elements (never innerHTML):
// ```code```, `code`, **bold**, *italic*, _italic_, __underline__, ~~strike~~,
// ||spoiler||, > quotes, autolinks, <@user> mentions and @everyone / @here.

export interface MdContext {
  mentionName: (id: string) => string;
  onMention?: (id: string, el: HTMLElement) => void;
}

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className={`spoiler${shown ? " shown" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={shown ? undefined : "Spoiler, click to reveal"}
      onClick={() => setShown(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setShown(true);
      }}
    >
      {children}
    </span>
  );
}

const INLINE =
  /(`[^`\n]+`)|(\*\*[\s\S]+?\*\*)|(__[\s\S]+?__)|(~~[\s\S]+?~~)|(\|\|[\s\S]+?\|\|)|(\*[^*\s][^*]*?\*)|(\b_[^_\s][^_]*?_\b)|(<@[a-z0-9]{16}>)|(@everyone|@here)|(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

function inline(text: string, ctx: MdContext, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(tok.slice(2, -2), ctx, k)}</strong>);
    else if (m[3]) out.push(<u key={k}>{inline(tok.slice(2, -2), ctx, k)}</u>);
    else if (m[4]) out.push(<s key={k}>{inline(tok.slice(2, -2), ctx, k)}</s>);
    else if (m[5]) out.push(<Spoiler key={k}>{inline(tok.slice(2, -2), ctx, k)}</Spoiler>);
    else if (m[6] || m[7]) out.push(<em key={k}>{inline(tok.slice(1, -1), ctx, k)}</em>);
    else if (m[8]) {
      const id = tok.slice(2, -1);
      out.push(
        <span
          key={k}
          className="mention"
          role="button"
          tabIndex={0}
          onClick={(e) => ctx.onMention?.(id, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ctx.onMention?.(id, e.currentTarget);
          }}
        >
          @{ctx.mentionName(id)}
        </span>,
      );
    } else if (m[9]) out.push(<span key={k} className="mention">{tok}</span>);
    else if (m[10])
      out.push(
        <a key={k} href={tok} target="_blank" rel="noreferrer noopener">
          {tok}
        </a>,
      );
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function blocks(text: string, ctx: MdContext): ReactNode[] {
  const out: ReactNode[] = [];
  const parts = text.split(/(```[\s\S]*?```)/g);
  parts.forEach((part, pi) => {
    if (!part) return;
    if (part.startsWith("```") && part.endsWith("```") && part.length >= 6) {
      let body = part.slice(3, -3);
      const nl = body.indexOf("\n");
      if (nl >= 0 && /^[\w+-]{1,20}$/.test(body.slice(0, nl).trim())) body = body.slice(nl + 1);
      out.push(
        <pre key={`c${pi}`}>
          <code>{body.replace(/^\n|\n$/g, "")}</code>
        </pre>,
      );
      return;
    }
    // group consecutive "> " lines into blockquotes
    const lines = part.split("\n");
    let quote: string[] = [];
    let plain: string[] = [];
    const flushPlain = (k: string) => {
      if (!plain.length) return;
      out.push(<Fragment key={k}>{inline(plain.join("\n"), ctx, k)}</Fragment>);
      plain = [];
    };
    const flushQuote = (k: string) => {
      if (!quote.length) return;
      out.push(<blockquote key={k}>{inline(quote.join("\n"), ctx, k)}</blockquote>);
      quote = [];
    };
    lines.forEach((line, li) => {
      const isQuote = /^> /.test(line) || line === ">";
      if (isQuote) {
        if (plain.length) {
          // keep the newline that separated plain text from the quote out of the output
          flushPlain(`p${pi}-${li}`);
        }
        quote.push(line.replace(/^> ?/, ""));
      } else {
        flushQuote(`q${pi}-${li}`);
        plain.push(line);
      }
    });
    flushQuote(`q${pi}-end`);
    flushPlain(`p${pi}-end`);
  });
  return out;
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*\s*){1,6}$/u;

export function isJumbo(text: string) {
  const t = text.trim();
  return t.length > 0 && EMOJI_ONLY.test(t);
}

export function Markdown({ text, ctx }: { text: string; ctx: MdContext }) {
  return <>{blocks(text, ctx)}</>;
}

/** Plain-text version (for previews, notifications, reply bars). */
export function plainText(text: string, mentionName: (id: string) => string) {
  return text
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/<@([a-z0-9]{16})>/g, (_, id) => `@${mentionName(id)}`)
    .replace(/\|\|[\s\S]+?\|\|/g, "▒▒▒")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
