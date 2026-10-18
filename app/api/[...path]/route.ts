import { api } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }> };

async function handle(req: Request, { params }: Params) {
  const { path } = await params;
  return api.handle(req, path);
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
