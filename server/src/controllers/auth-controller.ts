import type { Response } from "express";
import { isDatabaseAvailable } from "../lib/prisma.js";
import { AUTH_ERRORS } from "../services/auth-service.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { authService } from "../services/auth-service.js";

function sendError(response: Response, status: number, message: string): void {
  response.status(status).json({ error: message });
}

export async function register(
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> {
  if (!(await isDatabaseAvailable())) {
    sendError(response, 503, AUTH_ERRORS.dbUnavailable);
    return;
  }
  try {
    const user = await authService.register(request.body);
    request.session.userId = user.id;
    request.session.userName = user.name;
    response.status(201).json({ user });
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : AUTH_ERRORS.dbUnavailable,
    );
  }
}

export async function login(
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> {
  if (!(await isDatabaseAvailable())) {
    sendError(response, 503, AUTH_ERRORS.dbUnavailable);
    return;
  }
  try {
    const user = await authService.login(request.body);
    request.session.userId = user.id;
    request.session.userName = user.name;
    response.json({ user });
  } catch (error) {
    sendError(
      response,
      401,
      error instanceof Error ? error.message : AUTH_ERRORS.invalidCredentials,
    );
  }
}

export function logout(
  request: AuthenticatedRequest,
  response: Response,
): void {
  request.session?.destroy(() => {
    response.clearCookie("stack.sid");
    response.json({ ok: true });
  });
}

export async function me(
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> {
  if (!request.authUser) {
    response.json({ authenticated: false, user: null });
    return;
  }
  response.json({ authenticated: true, user: request.authUser });
}
