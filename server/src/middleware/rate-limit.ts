import type { Request, RequestHandler, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { normalizeUsername } from "../lib/validation.js";

export const RATE_LIMIT_MESSAGES = {
  register:
    "Muitas tentativas de cadastro. Tente novamente mais tarde.",
  login: "Muitas tentativas de login. Tente novamente mais tarde.",
} as const;

export type AuthRateLimiters = {
  registerShort: RequestHandler;
  registerDaily: RequestHandler;
  loginFailed: RequestHandler;
};

export type AuthRateLimitOptions = {
  registerShortLimit?: number;
  registerShortWindowMs?: number;
  registerDailyLimit?: number;
  registerDailyWindowMs?: number;
  loginFailedLimit?: number;
  loginFailedWindowMs?: number;
};

function clientIpKey(request: Request): string {
  return ipKeyGenerator(request.ip ?? "unknown");
}

function loginAttemptKey(request: Request): string {
  const rawUsername =
    typeof request.body?.username === "string" ? request.body.username : "";
  const username = normalizeUsername(rawUsername) || "unknown";
  return `${clientIpKey(request)}:${username}`;
}

function withSuccessfulLoginReset(
  limiter: RequestHandler & { resetKey: (key: string) => void },
): RequestHandler {
  return (request, response, next) => {
    const originalJson = response.json.bind(response);
    response.json = ((body: unknown) => {
      if (response.statusCode < 400) {
        limiter.resetKey(loginAttemptKey(request));
      }
      return originalJson(body as Response);
    }) as typeof response.json;

    return limiter(request, response, next);
  };
}

export function createAuthRateLimiters(
  options: AuthRateLimitOptions = {},
): AuthRateLimiters {
  const registerShort = rateLimit({
    windowMs: options.registerShortWindowMs ?? 10 * 60 * 1000,
    limit: options.registerShortLimit ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIpKey,
    message: { error: RATE_LIMIT_MESSAGES.register },
  });

  const registerDaily = rateLimit({
    windowMs: options.registerDailyWindowMs ?? 24 * 60 * 60 * 1000,
    limit: options.registerDailyLimit ?? 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIpKey,
    message: { error: RATE_LIMIT_MESSAGES.register },
  });

  const loginLimiter = rateLimit({
    windowMs: options.loginFailedWindowMs ?? 10 * 60 * 1000,
    limit: options.loginFailedLimit ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: loginAttemptKey,
    message: { error: RATE_LIMIT_MESSAGES.login },
  });

  return {
    registerShort,
    registerDaily,
    loginFailed: withSuccessfulLoginReset(loginLimiter),
  };
}

export const authRateLimiters = createAuthRateLimiters();
