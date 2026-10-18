import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, newId } from "./db";
import { fail } from "./repo";

const SAFE_INLINE = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm|ogg)|audio\/(mpeg|ogg|wav|webm|mp4))$/;

export function cleanFilename(name: string): string {
  const base = path.basename(name || "file").replace(/[^\w.\- ]+/g, "_").trim().slice(-80);
  return base || "file";
}

export async function saveUpload(file: File, opts: { maxBytes: number; imageOnly?: boolean }) {
  if (file.size > opts.maxBytes) fail(413, `That file is too big. The limit is ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`);
  if (file.size === 0) fail(400, "That file is empty.");
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (opts.imageOnly && !/^image\/(png|jpeg|gif|webp|avif)$/.test(mime)) fail(415, "Pick a PNG, JPG, GIF or WebP picture.");
  const filename = cleanFilename(file.name);
  const stored = `${newId()}-${filename.replace(/\s+/g, "_")}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
  return { url: `/api/files/${encodeURIComponent(stored)}`, filename, mime, size: file.size };
}

const EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

export async function serveUpload(name: string): Promise<Response> {
  const safe = path.basename(name);
  if (safe !== name || safe.startsWith(".")) return new Response("Not found", { status: 404 });
  const full = path.join(UPLOAD_DIR, safe);
  let data: Buffer;
  try {
    data = await fs.readFile(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const mime = EXT_MIME[path.extname(safe).toLowerCase()] ?? "application/octet-stream";
  const inline = SAFE_INLINE.test(mime);
  const original = safe.replace(/^[a-z0-9]{16}-/, "");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": inline ? mime : mime === "text/plain" ? "text/plain; charset=utf-8" : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${original.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
