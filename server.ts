import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { attachSocket } from "./lib/server/socket";
import { getDb } from "./lib/server/db";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

async function main() {
  getDb(); // create the database + schema up front
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => handle(req, res));
  const io = new IOServer(server, {
    path: "/socket.io",
    serveClient: false,
    destroyUpgrade: false,
    maxHttpBufferSize: 1e6,
  });
  attachSocket(io);

  const upgrade = app.getUpgradeHandler();
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/socket.io")) return; // handled by socket.io
    upgrade(req, socket, head);
  });

  server.listen(port, hostname, () => {
    console.log(`\n  ● Dabber is running at http://localhost:${port} (${dev ? "dev" : "production"})\n`);
  });

  const shutdown = () => {
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
