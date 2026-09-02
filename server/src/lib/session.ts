import session from "express-session";
import type { RequestHandler } from "express";

const SESSION_COOKIE = "stack.sid";

export function createSessionMiddleware(isProduction: boolean): RequestHandler {
  const secret = process.env.SESSION_SECRET;
  if (isProduction && !secret) {
    console.warn(
      "SESSION_SECRET is not set. Set it in production for secure sessions.",
    );
  }

  return session({
    name: SESSION_COOKIE,
    secret: secret ?? "stack-dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

export { SESSION_COOKIE };
