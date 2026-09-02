import type { Response } from "express";
import { isDatabaseAvailable } from "../lib/prisma.js";
import { AUTH_ERRORS } from "../services/auth-service.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { rankingService } from "../services/ranking-service.js";

export async function getRanking(
  _request: AuthenticatedRequest,
  response: Response,
): Promise<void> {
  if (!(await isDatabaseAvailable())) {
    response.status(503).json({ error: AUTH_ERRORS.dbUnavailable, ranking: [] });
    return;
  }
  try {
    const ranking = await rankingService.getLeaderboard();
    response.json({ ranking });
  } catch {
    response.status(503).json({
      error: AUTH_ERRORS.dbUnavailable,
      ranking: [],
    });
  }
}
