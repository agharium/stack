import { describe, expect, it } from "vitest";
import { ERRORS } from "../messages.js";
import { RoomManager } from "../rooms/room-manager.js";

describe("renomear jogador (anfitrião)", () => {
  it("anfitrião pode renomear outro jogador", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", null, "Host");
    const { player: guest } = manager.joinRoom(
      room.code,
      "s2",
      null,
      "Maria",
    );

    manager.renamePlayer(room.code, host.id, guest.id, "Mariana");

    expect(guest.nickname).toBe("Mariana");
    expect(
      room.game.players.find((player) => player.id === guest.id)?.nickname,
    ).toBe("Mariana");
  });

  it("anfitrião pode renomear a si mesmo", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", null, "Host");
    manager.joinRoom(room.code, "s2", null, "Maria");

    manager.renamePlayer(room.code, host.id, host.id, "Anfitrião");

    expect(host.nickname).toBe("Anfitrião");
    expect(
      room.game.players.find((player) => player.id === host.id)?.nickname,
    ).toBe("Anfitrião");
  });

  it("não-anfitrião não pode renomear ninguém", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", null, "Host");
    const { player: guest } = manager.joinRoom(
      room.code,
      "s2",
      null,
      "Maria",
    );

    expect(() =>
      manager.renamePlayer(room.code, guest.id, host.id, "Hack"),
    ).toThrow(ERRORS.hostRenameOnly);
    expect(host.nickname).toBe("Host");
  });

  it("rejeita nome vazio ou inválido", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", null, "Host");
    const { player: guest } = manager.joinRoom(
      room.code,
      "s2",
      null,
      "Maria",
    );

    expect(() =>
      manager.renamePlayer(room.code, host.id, guest.id, "   "),
    ).toThrow(ERRORS.nicknameEmpty);
    expect(() =>
      manager.renamePlayer(room.code, host.id, guest.id, "A"),
    ).toThrow(ERRORS.nicknameLength);
    expect(guest.nickname).toBe("Maria");
  });

  it("rejeita nome já usado por outro jogador na sala", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", null, "Host");
    const { player: guest } = manager.joinRoom(
      room.code,
      "s2",
      null,
      "Maria",
    );

    expect(() =>
      manager.renamePlayer(room.code, host.id, guest.id, "host"),
    ).toThrow(ERRORS.nicknameTaken);
  });

  it("propaga o nickname atualizado no estado público", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", null, "Host");
    const { player: guest } = manager.joinRoom(
      room.code,
      "s2",
      null,
      "Maria",
    );

    manager.renamePlayer(room.code, host.id, guest.id, "Mariana");

    const hostView = room.game.toPlayerView(
      room.code,
      room.hostId,
      host.id,
      room.players.map((player) => player.id),
    );
    const guestView = room.game.toPlayerView(
      room.code,
      room.hostId,
      guest.id,
      room.players.map((player) => player.id),
    );

    expect(hostView.players.find((player) => player.id === guest.id)?.nickname).toBe(
      "Mariana",
    );
    expect(guestView.players.find((player) => player.id === guest.id)?.nickname).toBe(
      "Mariana",
    );
  });

  it("não altera identidade autenticada persistida (userId)", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", {
      userId: "user-host",
      name: "José",
    });
    const { player: authGuest } = manager.joinRoom(room.code, "s2", {
      userId: "user-maria",
      name: "Maria",
    });

    manager.renamePlayer(room.code, host.id, authGuest.id, "Apelido Sala");

    expect(authGuest.nickname).toBe("Apelido Sala");
    expect(authGuest.userId).toBe("user-maria");
  });

  it("preserva apelido da sala após reconexão autenticada", () => {
    const manager = new RoomManager();
    const { room, player: host } = manager.createRoom("s1", {
      userId: "user-host",
      name: "José",
    });
    const { player: authGuest } = manager.joinRoom(room.code, "s2", {
      userId: "user-maria",
      name: "Maria",
    });

    room.game.phase = "playing";
    manager.renamePlayer(room.code, host.id, authGuest.id, "Apelido Sala");
    manager.disconnect("s2");

    const { player: reconnected, reconnected: wasReconnect } = manager.joinRoom(
      room.code,
      "s3",
      { userId: "user-maria", name: "Maria Conta" },
      undefined,
      authGuest.id,
    );

    expect(wasReconnect).toBe(true);
    expect(reconnected.id).toBe(authGuest.id);
    expect(reconnected.nickname).toBe("Apelido Sala");
    expect(reconnected.userId).toBe("user-maria");
    expect(
      room.game.players.find((player) => player.id === authGuest.id)?.nickname,
    ).toBe("Apelido Sala");
  });
});
