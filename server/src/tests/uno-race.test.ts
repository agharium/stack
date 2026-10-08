import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import {
  Game,
  UNO_ACCUSE_BLOCK_MS,
  UNO_ACCUSE_GRACE_MS,
  UNO_ACCUSE_SPAM_COUNT,
} from "../game/game.js";
import { ERRORS } from "../messages.js";

let serial = 90_000;
const number = (color: CardColor, value: number): Card => ({
  id: `r-${++serial}`,
  kind: "number",
  color,
  value,
});

function setup(): Game {
  const ids = ["P1", "P2", "P3"];
  const game = new Game(
    ids.map((id) => ({ id, nickname: id })),
    () => 0.35,
  );
  game.phase = "playing";
  game.matchPlayerOrder = [...ids];
  game.currentPlayerIndex = 0;
  game.activeColor = "red";
  game.discardPile = [number("red", 5)];
  game.drawPile = Array.from({ length: 50 }, (_, index) =>
    number("blue", index % 9),
  );
  return game;
}

function give(game: Game, playerId: string, ...cards: Card[]): void {
  const player = game.getPlayer(playerId);
  player.hand = cards;
  player.unoVulnerableAt =
    cards.length === 1 && !player.unoDeclared ? 0 : null;
}

function view(game: Game, viewerId = "P2") {
  return game.toPlayerView("ABCD", "P1", viewerId);
}

describe("corrida UNO sem espião", () => {
  it("jogador com exatamente 1 carta fica vulnerável ao UNO", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.getPlayer("P2").unoDeclared = true;

    const played = number("red", 4);
    give(game, "P1", played, number("green", 1));
    game.playCard("P1", played.id);

    expect(game.getPlayer("P1").hand).toHaveLength(1);
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
  });

  it("qualquer oponente recebe canAccuseUno quando alvo está vulnerável", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    const target = view(game, "P1").players.find((player) => player.id === "P2");
    const targetFromOtherOpponent = view(game, "P3").players.find(
      (player) => player.id === "P2",
    );

    expect(target?.canAccuseUno).toBe(true);
    expect(targetFromOtherOpponent?.canAccuseUno).toBe(true);
    expect(target?.isAtUnoCount).toBe(true);
  });

  it("jogador não recebe canAccuseUno sobre si mesmo", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    const target = view(game, "P2").players.find((player) => player.id === "P2");

    expect(target?.canAccuseUno).toBeUndefined();
    expect(target?.isAtUnoCount).toBe(true);
  });

  it("declaração de UNO remove imediatamente a acusação para todos os oponentes", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.declareUno("P2");

    const targetP1 = view(game, "P1").players.find((player) => player.id === "P2");
    const targetP3 = view(game, "P3").players.find((player) => player.id === "P2");
    expect(targetP1?.canAccuseUno).toBe(false);
    expect(targetP3?.canAccuseUno).toBe(false);
    expect(game.getPlayer("P2").unoDeclared).toBe(true);
  });

  it("oponente não pode acusar após declaração de UNO", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");

    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P2").hand).toHaveLength(1);
    expect(game.getPlayer("P1").hand).toHaveLength(0);
  });

  it("acusação obsoleta após UNO não pune o acusador", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");

    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P1").hand).toHaveLength(0);
  });

  it("oponente acusa antes da declaração e alvo compra 2", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.accuseUno("P1", "P2");

    expect(game.getPlayer("P2").hand).toHaveLength(3);
    expect(game.getPlayer("P2").unoDeclared).toBe(false);
  });

  it("acusação bem-sucedida remove vulnerabilidade UNO para todos", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.accuseUno("P1", "P2");

    const targetP1 = view(game, "P1").players.find((player) => player.id === "P2");
    const targetP3 = view(game, "P3").players.find((player) => player.id === "P2");
    expect(targetP1?.canAccuseUno).toBe(false);
    expect(targetP3?.canAccuseUno).toBe(false);
    expect(targetP1?.isAtUnoCount).toBe(false);
  });

  it("declaração após acusação bem-sucedida é rejeitada sem efeito", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.accuseUno("P1", "P2");

    expect(() => game.declareUno("P2")).toThrow(ERRORS.noLongerAtUnoCount);
    expect(game.getPlayer("P2").unoDeclared).toBe(false);
  });

  it("acusação não altera turno nem corrente", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.drawChain = { type: "DRAW_TWO", amount: 4, activeColor: "red" };
    game.currentPlayerIndex = 2;
    const turn = game.currentPlayerIndex;
    const chain = { ...game.drawChain };

    game.accuseUno("P1", "P2");

    expect(game.currentPlayerIndex).toBe(turn);
    expect(game.drawChain).toEqual(chain);
  });

  it("declaração não altera turno nem corrente", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.drawChain = { type: "DRAW_TWO", amount: 4, activeColor: "red" };
    game.currentPlayerIndex = 2;
    const turn = game.currentPlayerIndex;
    const chain = { ...game.drawChain };

    game.declareUno("P2");

    expect(game.currentPlayerIndex).toBe(turn);
    expect(game.drawChain).toEqual(chain);
  });

  it("acusação não depende da vez atual", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.currentPlayerIndex = 1;
    expect(game.currentPlayer.id).toBe("P2");
    game.accuseUno("P3", "P2");
    expect(game.getPlayer("P2").hand).toHaveLength(3);
  });

  it("não vaza unoDeclared na serialização", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");

    const serialized = JSON.stringify(view(game, "P1"));
    expect(serialized).not.toContain("unoDeclared");
  });

  it("serialização dos oponentes atualiza após declaração", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(true);

    game.declareUno("P2");

    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(false);
  });

  it("serialização dos oponentes atualiza após acusação", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.accuseUno("P1", "P2");

    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(false);
    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.cardCount,
    ).toBeNull();
  });

  it("duas acusações simultâneas não punem o alvo duas vezes", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.accuseUno("P1", "P2");
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );
    expect(game.getPlayer("P2").hand).toHaveLength(3);
  });

  it("corrida: declaração processada antes bloqueia acusação tardia", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.declareUno("P2");
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
  });

  it("corrida: acusação processada antes bloqueia declaração tardia", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.accuseUno("P1", "P2");
    expect(() => game.declareUno("P2")).toThrow(ERRORS.noLongerAtUnoCount);
  });

  it("acusação com alvo fora de vulnerabilidade não pune ninguém", () => {
    const game = setup();
    give(game, "P2", number("red", 1), number("blue", 2));

    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );
    expect(game.getPlayer("P1").hand).toHaveLength(0);
    expect(game.getPlayer("P2").hand).toHaveLength(2);
  });

  it("atrasa canAccuseUno e acusação por 1s após chegar a uma carta", () => {
    let now = 1_000_000;
    const ids = ["P1", "P2", "P3"];
    const game = new Game(
      ids.map((id) => ({ id, nickname: id })),
      () => 0.35,
      () => now,
    );
    game.phase = "playing";
    game.matchPlayerOrder = [...ids];
    game.currentPlayerIndex = 1;
    game.activeColor = "red";
    game.discardPile = [number("red", 5)];
    game.drawPile = Array.from({ length: 50 }, (_, index) =>
      number("blue", index % 9),
    );

    const played = number("red", 4);
    give(game, "P2", played, number("yellow", 2));
    game.playCard("P2", played.id);

    expect(game.getPlayer("P2").hand).toHaveLength(1);
    expect(game.getPlayer("P2").unoVulnerableAt).toBe(now);
    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(false);
    expect(() => game.accuseUno("P1", "P2")).toThrow(ERRORS.unoAccuseTooSoon);
    expect(game.msUntilUnoAccuseReveal()).toBe(UNO_ACCUSE_GRACE_MS);

    now += UNO_ACCUSE_GRACE_MS;
    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(true);
    expect(game.msUntilUnoAccuseReveal()).toBeNull();
    game.accuseUno("P1", "P2");
    expect(game.getPlayer("P2").hand).toHaveLength(3);
  });

  it("permite declarar UNO durante a janela de graça", () => {
    let now = 1_000_000;
    const ids = ["P1", "P2", "P3"];
    const game = new Game(
      ids.map((id) => ({ id, nickname: id })),
      () => 0.35,
      () => now,
    );
    game.phase = "playing";
    game.matchPlayerOrder = [...ids];
    game.currentPlayerIndex = 1;
    game.activeColor = "red";
    game.discardPile = [number("red", 5)];
    game.drawPile = Array.from({ length: 50 }, (_, index) =>
      number("blue", index % 9),
    );

    const played = number("red", 4);
    give(game, "P2", played, number("yellow", 2));
    game.playCard("P2", played.id);
    game.declareUno("P2");

    now += UNO_ACCUSE_GRACE_MS;
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P2").hand).toHaveLength(1);
  });

  it("bloqueia acusador por 1 minuto após 5 cliques seguidos", () => {
    let now = 5_000_000;
    const ids = ["P1", "P2", "P3"];
    const game = new Game(
      ids.map((id) => ({ id, nickname: id })),
      () => 0.35,
      () => now,
    );
    game.phase = "playing";
    game.matchPlayerOrder = [...ids];
    game.currentPlayerIndex = 0;
    game.activeColor = "red";
    game.discardPile = [number("red", 5)];
    game.drawPile = Array.from({ length: 50 }, (_, index) =>
      number("blue", index % 9),
    );
    give(game, "P2", number("red", 1));

    for (let index = 0; index < UNO_ACCUSE_SPAM_COUNT - 1; index += 1) {
      now += 10;
      expect(() => game.accuseUno("P1", "P3")).toThrow(
        ERRORS.targetNoLongerAtUnoCount,
      );
    }
    now += 10;
    expect(() => game.accuseUno("P1", "P3")).toThrow(
      ERRORS.unoAccuseSpamBlocked,
    );
    expect(game.getPlayer("P1").accuseBlockedUntil).toBe(
      now + UNO_ACCUSE_BLOCK_MS,
    );
    expect(game.events.at(-1)?.text).toBe(
      "P1 foi bloqueado de acusar por 1 minuto (zé cliquinho).",
    );
    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(false);

    const eventCount = game.events.length;
    now += 10;
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAccuseSpamBlocked,
    );
    expect(game.events).toHaveLength(eventCount);
    expect(game.getPlayer("P2").hand).toHaveLength(1);

    now += UNO_ACCUSE_BLOCK_MS;
    expect(
      view(game, "P1").players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(true);
    game.accuseUno("P1", "P2");
    expect(game.getPlayer("P2").hand).toHaveLength(3);
  });

  it("não bloqueia acusador com cliques espaçados", () => {
    let now = 6_000_000;
    const ids = ["P1", "P2", "P3"];
    const game = new Game(
      ids.map((id) => ({ id, nickname: id })),
      () => 0.35,
      () => now,
    );
    game.phase = "playing";
    game.matchPlayerOrder = [...ids];
    game.currentPlayerIndex = 0;
    game.activeColor = "red";
    game.discardPile = [number("red", 5)];
    game.drawPile = Array.from({ length: 50 }, (_, index) =>
      number("blue", index % 9),
    );

    for (let index = 0; index < UNO_ACCUSE_SPAM_COUNT; index += 1) {
      now += 2_100;
      expect(() => game.accuseUno("P1", "P3")).toThrow(
        ERRORS.targetNoLongerAtUnoCount,
      );
    }
    expect(game.getPlayer("P1").accuseBlockedUntil).toBeNull();
  });
});
