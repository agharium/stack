import type { Express } from "express";

/**
 * Trust only the first reverse-proxy hop (Railway / load balancer).
 * This lets Express derive req.ip from X-Forwarded-For safely
 * without blindly trusting arbitrary client-supplied proxy chains.
 */
export function configureTrustProxy(app: Express): void {
  app.set("trust proxy", 1);
}
