import express from "express";
import { createSessionMiddleware } from "../lib/session.js";
import { configureTrustProxy } from "../lib/trust-proxy.js";
import {
  createAuthRateLimiters,
  type AuthRateLimitOptions,
} from "../middleware/rate-limit.js";
import { createApiRouter } from "../routes/api.js";

export function createTestApp(
  rateLimitOptions?: AuthRateLimitOptions,
): express.Express {
  const app = express();
  configureTrustProxy(app);
  app.use(express.json());
  app.use(createSessionMiddleware(false));
  app.use(
    "/api",
    createApiRouter(
      rateLimitOptions
        ? createAuthRateLimiters(rateLimitOptions)
        : createAuthRateLimiters(),
    ),
  );
  return app;
}
