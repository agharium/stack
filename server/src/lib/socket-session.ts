import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ExtendedError, Socket } from "socket.io";

type SocketRequest = Request & {
  res?: Response;
};

/**
 * Apply Express session middleware to a Socket.IO connection handshake.
 * Engine.IO does not always provide a full Express response; a no-op shim is enough
 * to let express-session read the session cookie from the handshake request.
 */
export function createSocketSessionMiddleware(
  sessionMiddleware: RequestHandler,
): (socket: Socket, next: (err?: ExtendedError) => void) => void {
  return (socket, next) => {
    const request = socket.request as SocketRequest;
    const response = (request.res ?? {
      getHeader() {
        return undefined;
      },
      setHeader() {
        return undefined;
      },
      removeHeader() {
        return undefined;
      },
      end() {
        return undefined;
      },
      writeHead() {
        return undefined;
      },
    }) as Response;

    sessionMiddleware(request, response, ((error?: unknown) => {
      if (error) {
        next(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      next();
    }) as NextFunction);
  };
}
