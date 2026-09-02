import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth-service.js";
import type { PrivateAccountDto } from "../types/auth.js";

export type AuthenticatedRequest = Request & {
  authUser?: PrivateAccountDto;
};

export async function optionalAuth(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  const userId = request.session?.userId;
  if (!userId) {
    next();
    return;
  }
  const user = await authService.getAccount(userId);
  if (user) {
    request.authUser = user;
    if (request.session) {
      request.session.userName = user.name;
    }
  } else if (request.session) {
    delete request.session.userId;
  }
  next();
}

export function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  if (!request.authUser) {
    response.status(401).json({
      error: "Sua sessão expirou. Entre novamente.",
    });
    return;
  }
  next();
}
