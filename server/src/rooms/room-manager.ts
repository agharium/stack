import { randomInt, randomUUID } from "node:crypto";
import { Game } from "../game/game.js";
import { ERRORS } from "../messages.js";
import { validateGuestNickname } from "../lib/validation.js";

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type AuthIdentity = {
  userId: string;
  name: string;
};

export type RoomPlayer = {
  id: string;
  userId: string | null;
  nickname: string;
  socketId: string;
  connected: boolean;
};

export type Room = {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  game: Game;
  matchPersisted: boolean;
};

function resolveDisplayName(
  auth: AuthIdentity | null,
  nicknameValue?: string,
): string {
  if (auth) return auth.name;
  if (!nicknameValue) throw new Error(ERRORS.nicknameRequired);
  return validateGuestNickname(nicknameValue);
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  createRoom(
    socketId: string,
    auth: AuthIdentity | null,
    nicknameValue?: string,
  ): { room: Room; player: RoomPlayer } {
    const nickname = resolveDisplayName(auth, nicknameValue);
    let code = "";
    do {
      code = Array.from(
        { length: 4 },
        () => ROOM_CHARS[randomInt(ROOM_CHARS.length)],
      ).join("");
    } while (this.rooms.has(code));

    const player: RoomPlayer = {
      id: randomUUID(),
      userId: auth?.userId ?? null,
      nickname,
      socketId,
      connected: true,
    };
    const game = new Game([player]);
    const room: Room = {
      code,
      hostId: player.id,
      players: [player],
      game,
      matchPersisted: false,
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  joinRoom(
    codeValue: string,
    socketId: string,
    auth: AuthIdentity | null,
    nicknameValue?: string,
    requestedPlayerId?: string,
  ): { room: Room; player: RoomPlayer; reconnected: boolean } {
    const code = codeValue.trim().toUpperCase();
    if (!/^[A-Z2-9]{4}$/.test(code)) throw new Error(ERRORS.invalidRoomCode);
    const room = this.rooms.get(code);
    if (!room) throw new Error(ERRORS.roomNotFound);
    const nickname = resolveDisplayName(auth, nicknameValue);

    if (auth?.userId) {
      const connectedSameUser = room.players.find(
        (player) => player.userId === auth.userId && player.connected,
      );
      if (connectedSameUser) {
        throw new Error(ERRORS.alreadyInRoom);
      }
    }

    if (requestedPlayerId) {
      const existing = room.players.find((player) => {
        if (player.id !== requestedPlayerId || player.connected) return false;
        if (auth?.userId) return player.userId === auth.userId;
        // Guest reconnect by stable playerId; keep host-assigned room nickname.
        return player.userId === null;
      });
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        if (auth) {
          existing.userId = auth.userId;
          const gamePlayer = room.game.players.find(
            (candidate) => candidate.id === existing.id,
          );
          if (gamePlayer) {
            gamePlayer.userId = auth.userId;
          }
        }
        room.game.setConnected(existing.id, true);
        return { room, player: existing, reconnected: true };
      }
    }

    if (auth?.userId) {
      const disconnectedSameUser = room.players.find(
        (player) => player.userId === auth.userId && !player.connected,
      );
      if (disconnectedSameUser) {
        disconnectedSameUser.socketId = socketId;
        disconnectedSameUser.connected = true;
        const gamePlayer = room.game.players.find(
          (candidate) => candidate.id === disconnectedSameUser.id,
        );
        if (gamePlayer) {
          gamePlayer.userId = auth.userId;
        }
        room.game.setConnected(disconnectedSameUser.id, true);
        return { room, player: disconnectedSameUser, reconnected: true };
      }
    }

    if (room.game.phase !== "lobby") {
      throw new Error(ERRORS.matchStarted);
    }
    if (room.players.length >= 12) throw new Error(ERRORS.roomFull);
    if (
      !auth &&
      room.players.some(
        (player) =>
          player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase(),
      )
    ) {
      throw new Error(ERRORS.nicknameTaken);
    }

    const player: RoomPlayer = {
      id: randomUUID(),
      userId: auth?.userId ?? null,
      nickname,
      socketId,
      connected: true,
    };
    room.players.push(player);
    room.game.players.push({
      id: player.id,
      userId: player.userId,
      nickname,
      connected: true,
      hand: [],
      unoDeclared: false,
    });
    return { room, player, reconnected: false };
  }

  requireRoomAndPlayer(codeValue: string, playerId: string): {
    room: Room;
    player: RoomPlayer;
  } {
    const room = this.rooms.get(codeValue.toUpperCase());
    if (!room) throw new Error(ERRORS.roomNotFound);
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error(ERRORS.notInRoom);
    return { room, player };
  }

  renamePlayer(
    roomCode: string,
    hostPlayerId: string,
    targetPlayerId: string,
    nicknameValue: string,
  ): Room {
    const { room, player: host } = this.requireRoomAndPlayer(
      roomCode,
      hostPlayerId,
    );
    if (room.hostId !== host.id) {
      throw new Error(ERRORS.hostRenameOnly);
    }
    if (typeof nicknameValue !== "string" || !nicknameValue.trim()) {
      throw new Error(ERRORS.nicknameEmpty);
    }
    const nickname = validateGuestNickname(nicknameValue);
    const target = room.players.find((player) => player.id === targetPlayerId);
    if (!target) throw new Error(ERRORS.playerNotFound);

    const taken = room.players.some(
      (player) =>
        player.id !== targetPlayerId &&
        player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase(),
    );
    if (taken) throw new Error(ERRORS.nicknameTaken);

    target.nickname = nickname;
    const gamePlayer = room.game.players.find(
      (candidate) => candidate.id === targetPlayerId,
    );
    if (gamePlayer) {
      gamePlayer.nickname = nickname;
    }
    return room;
  }

  disconnect(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      const player = room.players.find(
        (candidate) => candidate.socketId === socketId,
      );
      if (!player) continue;
      player.connected = false;
      room.game.setConnected(player.id, false);

      if (room.game.phase === "lobby") {
        room.players = room.players.filter(
          (candidate) => candidate.id !== player.id,
        );
        room.game.players = room.game.players.filter(
          (candidate) => candidate.id !== player.id,
        );
      }

      const connected = room.players.filter((candidate) => candidate.connected);
      if (connected.length === 0) {
        this.rooms.delete(room.code);
        return null;
      }
      if (
        !room.players.some(
          (candidate) => candidate.id === room.hostId && candidate.connected,
        )
      ) {
        room.hostId = connected[0]!.id;
      }
      return room;
    }
    return null;
  }

  leave(code: string, playerId: string): Room | null {
    const { room, player } = this.requireRoomAndPlayer(code, playerId);
    return this.disconnect(player.socketId);
  }
}
