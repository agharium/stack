import { randomInt, randomUUID } from "node:crypto";
import { Game } from "../game/game.js";
import { ERRORS } from "../messages.js";

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RoomPlayer = {
  id: string;
  nickname: string;
  socketId: string;
  connected: boolean;
};

export type Room = {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  game: Game;
};

function cleanNickname(value: string): string {
  const nickname = value.trim().replace(/\s+/g, " ");
  if (nickname.length < 2 || nickname.length > 20) {
    throw new Error(ERRORS.nicknameLength);
  }
  return nickname;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  createRoom(nicknameValue: string, socketId: string): {
    room: Room;
    player: RoomPlayer;
  } {
    const nickname = cleanNickname(nicknameValue);
    let code = "";
    do {
      code = Array.from(
        { length: 4 },
        () => ROOM_CHARS[randomInt(ROOM_CHARS.length)],
      ).join("");
    } while (this.rooms.has(code));

    const player: RoomPlayer = {
      id: randomUUID(),
      nickname,
      socketId,
      connected: true,
    };
    const game = new Game([player]);
    const room = { code, hostId: player.id, players: [player], game };
    this.rooms.set(code, room);
    return { room, player };
  }

  joinRoom(
    codeValue: string,
    nicknameValue: string,
    socketId: string,
    requestedPlayerId?: string,
  ): { room: Room; player: RoomPlayer; reconnected: boolean } {
    const code = codeValue.trim().toUpperCase();
    if (!/^[A-Z2-9]{4}$/.test(code)) throw new Error(ERRORS.invalidRoomCode);
    const room = this.rooms.get(code);
    if (!room) throw new Error(ERRORS.roomNotFound);
    const nickname = cleanNickname(nicknameValue);

    if (requestedPlayerId) {
      const existing = room.players.find(
        (player) =>
          player.id === requestedPlayerId &&
          !player.connected &&
          player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase(),
      );
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        room.game.setConnected(existing.id, true);
        return { room, player: existing, reconnected: true };
      }
    }

    if (room.game.phase !== "lobby") {
      throw new Error(ERRORS.matchStarted);
    }
    if (room.players.length >= 12) throw new Error(ERRORS.roomFull);
    if (
      room.players.some(
        (player) =>
          player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase(),
      )
    ) {
      throw new Error(ERRORS.nicknameTaken);
    }

    const player: RoomPlayer = {
      id: randomUUID(),
      nickname,
      socketId,
      connected: true,
    };
    room.players.push(player);
    room.game.players.push({
      id: player.id,
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
      if (!room.players.some((candidate) => candidate.id === room.hostId && candidate.connected)) {
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
