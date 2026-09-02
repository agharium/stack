import express from "express";
import { createSessionMiddleware } from "../lib/session.js";
import { createApiRouter } from "../routes/api.js";

export function createTestApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(createSessionMiddleware(false));
  app.use("/api", createApiRouter());
  return app;
}
