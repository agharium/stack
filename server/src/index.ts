import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request } from "express";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";
import { createSessionMiddleware } from "./lib/session.js";
import { configureTrustProxy } from "./lib/trust-proxy.js";
import { createApiRouter } from "./routes/api.js";
import { RoomManager } from "./rooms/room-manager.js";
import { registerSocketHandlers } from "./socket/handlers.js";
import { authService } from "./services/auth-service.js";

const isProduction = process.env.NODE_ENV === "production";
const app = express();
configureTrustProxy(app);
const httpServer = createServer(app);
const sessionMiddleware = createSessionMiddleware(isProduction);

app.use(express.json());
app.use(sessionMiddleware);

app.get("/health", (_request, response) => {
  response.status(200).send("ok");
});

app.get("/api/health", (_request, response) => {
  response.status(200).json({ ok: true });
});

app.use("/api", createApiRouter());

function findClientDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../../../client/dist"),
    resolve(process.cwd(), "client/dist"),
    resolve(process.cwd(), "../client/dist"),
  ];
  return (
    candidates.find((directory) =>
      existsSync(resolve(directory, "index.html")),
    ) ?? null
  );
}

const clientDist = findClientDist();
if (clientDist) {
  app.use(express.static(clientDist));
  app.use((request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      next();
      return;
    }
    const path = request.path;
    if (
      path.startsWith("/socket.io") ||
      path.startsWith("/api") ||
      path === "/health"
    ) {
      next();
      return;
    }
    response.sendFile(resolve(clientDist, "index.html"));
  });
} else if (isProduction) {
  console.error("Client build not found. Run `npm run build` before start.");
}

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: isProduction
    ? undefined
    : { origin: ["http://localhost:3000", "http://localhost:5173"] },
});

io.engine.use(sessionMiddleware);

io.use(async (socket, next) => {
  try {
    const session = (socket.request as Request).session;
    if (session?.userId && !session.userName) {
      const account = await authService.getAccount(session.userId);
      if (account) {
        session.userName = account.name;
      }
    }
    next();
  } catch {
    next();
  }
});

const roomManager = new RoomManager();
registerSocketHandlers(io, roomManager);

const port = Number(process.env.PORT) || 3001;
const host = "0.0.0.0";
httpServer.listen(port, host, () => {
  console.log(`STACK! server listening on ${host}:${port}`);
});
