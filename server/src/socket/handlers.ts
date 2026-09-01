import type { Server, Socket } from "socket.io";
import type {
  Ack,
  ClientToServerEvents,
  PlayerView,
  ServerToClientEvents,
} from "../../../shared/types.js";
import { RoomManager, type Room } from "../rooms/room-manager.js";
import { ERRORS } from "../messages.js";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const success = (): Ack => ({ ok: true });
const failure = <T = undefined>(error: unknown): Ack<T> =>
  ({
    ok: false,
    error: error instanceof Error ? error.message : ERRORS.unexpected,
  }) as Ack<T>;

export function registerSocketHandlers(
  io: GameServer,
  manager: RoomManager,
): void {
  const emitState = (room: Room): void => {
    for (const player of room.players) {
      if (!player.connected) continue;
      const state: PlayerView = room.game.toPlayerView(
        room.code,
        room.hostId,
        player.id,
      );
      io.to(player.socketId).emit("state-update", state);
    }
  };

  const authorize = (
    socket: GameSocket,
    roomCode: string,
    playerId: string,
  ): Room => {
    const { room, player } = manager.requireRoomAndPlayer(roomCode, playerId);
    if (!player.connected || player.socketId !== socket.id) {
      throw new Error(ERRORS.inactiveSession);
    }
    return room;
  };

  io.on("connection", (socket) => {
    socket.on("create-room", (payload, ack) => {
      try {
        const { room, player } = manager.createRoom(
          payload.nickname,
          socket.id,
        );
        void socket.join(room.code);
        emitState(room);
        ack({
          ok: true,
          data: { roomCode: room.code, playerId: player.id },
        });
      } catch (error) {
        ack(failure<{ roomCode: string; playerId: string }>(error));
      }
    });

    socket.on("join-room", (payload, ack) => {
      try {
        const { room, player } = manager.joinRoom(
          payload.roomCode,
          payload.nickname,
          socket.id,
          payload.playerId,
        );
        void socket.join(room.code);
        emitState(room);
        ack({
          ok: true,
          data: { roomCode: room.code, playerId: player.id },
        });
      } catch (error) {
        ack(failure<{ roomCode: string; playerId: string }>(error));
      }
    });

    socket.on("start-game", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        if (room.hostId !== payload.playerId) {
          throw new Error(ERRORS.hostStartOnly);
        }
        room.game.start();
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("play-cards", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        room.game.playCards(
          payload.playerId,
          payload.cardIds,
          payload.chosenColor,
        );
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("draw-card", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        room.game.drawOneCard(payload.playerId);
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("play-drawn-cards", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        room.game.playDrawnCards(
          payload.playerId,
          payload.cardIds,
          payload.chosenColor,
        );
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("keep-drawn-card", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        room.game.keepDrawnCard(payload.playerId);
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("accept-draw-chain", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        room.game.acceptDrawPenalty(payload.playerId);
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("call-uno", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        room.game.declareUno(payload.playerId);
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("accuse-uno", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        room.game.accuseUno(payload.playerId, payload.targetPlayerId);
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("restart-game", (payload, ack) => {
      try {
        const room = authorize(socket, payload.roomCode, payload.playerId);
        if (room.hostId !== payload.playerId) {
          throw new Error(ERRORS.hostRestartOnly);
        }
        if (room.game.phase !== "finished") {
          throw new Error(ERRORS.gameNotOver);
        }
        room.game.restart();
        emitState(room);
        ack(success());
      } catch (error) {
        ack(failure(error));
      }
    });

    socket.on("leave-room", (payload) => {
      try {
        authorize(socket, payload.roomCode, payload.playerId);
        const room = manager.leave(payload.roomCode, payload.playerId);
        void socket.leave(payload.roomCode);
        if (room) emitState(room);
      } catch {
        // Leaving an already removed room is intentionally idempotent.
      }
    });

    socket.on("disconnect", () => {
      const room = manager.disconnect(socket.id);
      if (room) emitState(room);
    });
  });
}
