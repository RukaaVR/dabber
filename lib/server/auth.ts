import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { getDb, now } from "./db";

export const SESSION_COOKIE = "dabber_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function userIdFromToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const row = getDb().prepare("SELECT user_id, created_at FROM sessions WHERE token = ?").get(token) as
    | { user_id: string; created_at: number }
    | undefined;
  if (!row) return null;
  if (now() - row.created_at > SESSION_MAX_AGE * 1000) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return row.user_id;
}

export function userIdFromCookieHeader(header: string | null | undefined): string | null {
  return userIdFromToken(parseCookies(header)[SESSION_COOKIE]);
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  getDb().prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, userId, now());
  return token;
}

export function destroySession(token: string) {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
