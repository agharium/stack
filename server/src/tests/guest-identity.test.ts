import { describe, expect, it } from "vitest";
import { Game } from "../game/game.js";
import { RoomManager } from "../rooms/room-manager.js";
import type { Card, CardColor } from "../../../shared/types.js";

let serial = 90_000;
const number = (color: CardColor, value: number): Card => ({
  id: `g-${++serial}`,
  kind: "number",
  color,
  value,
});

describe("convidados", () => {
  const manager = new RoomManager();

  it("podem criar e entrar em sala sem conta", () => {
    const { room, player } = manager.createRoom("socket-1", null, "João");
    expect(player.userId).toBeNull();
    expect(room.players).toHaveLength(1);
  });

  it("podem completar partida e vencer sem registro no banco", () => {
    const game = new Game(
      [
        { id: "p1", nickname: "Convidado" },
        { id: "p2", nickname: "Maria" },
      ],
      () => 0,
    );
    game.phase = "playing";
    game.matchPlayerOrder = ["p1", "p2"];
    game.currentPlayerIndex = 0;
    game.activeColor = "red";
    game.discardPile = [number("red", 5)];
    game.drawPile = [number("blue", 1)];
    game.getPlayer("p1").hand = [number("red", 3)];
    game.playCard("p1", game.getPlayer("p1").hand[0]!.id);
    expect(game.phase).toBe("finished");
    expect(game.result?.winnerId).toBe("p1");
    expect(game.result?.standings[0]?.userId).toBeNull();
  });
});

describe("identidade no jogo", () => {
  const manager = new RoomManager();

  it("usa o nome da conta para jogador autenticado", () => {
    const { player } = manager.createRoom("socket-auth", {
      userId: "user-1",
      name: "José",
    });
    expect(player.nickname).toBe("José");
    expect(player.userId).toBe("user-1");
  });

  it("ignora nickname enviado pelo autenticado ao criar sala", () => {
    const { player } = manager.createRoom(
      "socket-auth-2",
      { userId: "user-2", name: "Maria" },
      "Nome Forjado",
    );
    expect(player.nickname).toBe("Maria");
  });

  it("não permite o mesmo usuário autenticado duas vezes na sala", () => {
    const { room } = manager.createRoom("socket-a", {
      userId: "user-1",
      name: "José",
    });
    expect(() =>
      manager.joinRoom(room.code, "socket-b", {
        userId: "user-1",
        name: "José",
      }),
    ).toThrow("Você já está nesta sala em outra sessão.");
  });

  it("permite convidado e autenticado na mesma sala", () => {
    const { room } = manager.createRoom("socket-host", {
      userId: "user-1",
      name: "José",
    });
    const { player } = manager.joinRoom(room.code, "socket-guest", null, "Ana");
    expect(player.userId).toBeNull();
    expect(room.players).toHaveLength(2);
  });

  it("ignora nickname enviado pelo autenticado ao entrar na sala", () => {
    const { room } = manager.createRoom("socket-host-2", {
      userId: "user-1",
      name: "José",
    });
    const { player } = manager.joinRoom(
      room.code,
      "socket-auth-join",
      { userId: "user-3", name: "Clara" },
      "Outro Nome",
    );
    expect(player.nickname).toBe("Clara");
  });

  it("não expõe username no estado público da sala", () => {
    const { room } = manager.createRoom("socket-host", {
      userId: "user-1",
      name: "José",
    });
    manager.joinRoom(room.code, "socket-guest", null, "Ana");
    const view = room.game.toPlayerView(
      room.code,
      room.hostId,
      room.players[0]!.id,
      room.players.map((player) => player.id),
    );
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("username");
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("passwordHash");
  });
});
