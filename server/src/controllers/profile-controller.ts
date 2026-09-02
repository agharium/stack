import type { Response } from "express";
import { isDatabaseAvailable } from "../lib/prisma.js";
import { AUTH_ERRORS } from "../services/auth-service.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { profileService } from "../services/profile-service.js";

function sendError(response: Response, status: number, message: string): void {
  response.status(status).json({ error: message });
}

export async function getProfile(
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> {
  if (!(await isDatabaseAvailable())) {
    sendError(response, 503, AUTH_ERRORS.dbUnavailable);
    return;
  }
  const profile = await profileService.getProfile(request.authUser!.id);
  if (!profile) {
    sendError(response, 401, AUTH_ERRORS.sessionExpired);
    return;
  }
  response.json({ user: profile });
}

export async function updateProfile(
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> {
  if (!(await isDatabaseAvailable())) {
    sendError(response, 503, AUTH_ERRORS.dbUnavailable);
    return;
  }
  try {
    const user = await profileService.updateProfile(
      request.authUser!.id,
      request.body,
    );
    if (request.session) {
      request.session.userName = user.name;
    }
    response.json({ user, message: "Perfil atualizado com sucesso." });
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : AUTH_ERRORS.dbUnavailable,
    );
  }
}

export async function changePassword(
  request: AuthenticatedRequest,
  response: Response,
): Promise<void> {
  if (!(await isDatabaseAvailable())) {
    sendError(response, 503, AUTH_ERRORS.dbUnavailable);
    return;
  }
  try {
    await profileService.changePassword(request.authUser!.id, request.body);
    response.json({ message: "Senha alterada com sucesso." });
  } catch (error) {
    sendError(
      response,
      400,
      error instanceof Error ? error.message : AUTH_ERRORS.dbUnavailable,
    );
  }
}
