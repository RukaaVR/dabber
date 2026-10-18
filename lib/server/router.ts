import { HttpError } from "./repo";
import { userIdFromCookieHeader } from "./auth";

export interface Ctx {
  req: Request;
  url: URL;
  params: Record<string, string>;
  userId: string | null;
  /** The signed-in user id; throws 401 when signed out. */
  uid(): string;
  json<T = Record<string, unknown>>(): Promise<T>;
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler) {
    this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler });
    return this;
  }
  get = (p: string, h: Handler) => this.add("GET", p, h);
  post = (p: string, h: Handler) => this.add("POST", p, h);
  patch = (p: string, h: Handler) => this.add("PATCH", p, h);
  put = (p: string, h: Handler) => this.add("PUT", p, h);
  delete = (p: string, h: Handler) => this.add("DELETE", p, h);

  private match(method: string, segs: string[]) {
    let methodMismatch = false;
    for (const r of this.routes) {
      if (r.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        const p = r.parts[i];
        if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(segs[i]);
        else if (p !== segs[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (r.method !== method) {
        methodMismatch = true;
        continue;
      }
      return { route: r, params };
    }
    return methodMismatch ? "405" : null;
  }

  async handle(req: Request, segs: string[]): Promise<Response> {
    const m = this.match(req.method, segs);
    if (m === null) return Response.json({ error: "Not found" }, { status: 404 });
    if (m === "405") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const userId = userIdFromCookieHeader(req.headers.get("cookie"));
    let bodyCache: unknown;
    const ctx: Ctx = {
      req,
      url: new URL(req.url),
      params: m.params,
      userId,
      uid() {
        if (!userId) throw new HttpError(401, "You need to log in first.");
        return userId;
      },
      async json<T>() {
        if (bodyCache === undefined) {
          try {
            bodyCache = await req.json();
          } catch {
            throw new HttpError(400, "Bad request body");
          }
          if (typeof bodyCache !== "object" || bodyCache === null) throw new HttpError(400, "Bad request body");
        }
        return bodyCache as T;
      },
    };
    try {
      const out = await m.route.handler(ctx);
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error("[api]", req.method, segs.join("/"), e);
      return Response.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  }
}

export function str(v: unknown, field: string, opts: { min?: number; max: number; optional?: boolean }): string {
  if (v === undefined || v === null) {
    if (opts.optional) return "";
    throw new HttpError(400, `${field} is required`);
  }
  if (typeof v !== "string") throw new HttpError(400, `${field} must be text`);
  const s = v.trim();
  if (s.length < (opts.min ?? 0)) throw new HttpError(400, `${field} is too short`);
  if (s.length > opts.max) throw new HttpError(400, `${field} can be at most ${opts.max} characters`);
  return s;
}
