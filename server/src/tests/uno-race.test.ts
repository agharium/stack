import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { Game } from "../game/game.js";
import { ERRORS } from "../messages.js";
import { bootstrapSpy, setSpy } from "./test-helpers.js";

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
  bootstrapSpy(game, ids, "P1");
  game.currentPlayerIndex = 0;
  game.activeColor = "red";
  game.discardPile = [number("red", 5)];
  game.drawPile = Array.from({ length: 50 }, (_, index) =>
    number("blue", index % 9),
  );
  return game;
}

function give(game: Game, playerId: string, ...cards: Card[]): void {
  game.getPlayer(playerId).hand = cards;
}

function spyView(game: Game) {
  return game.toPlayerView("ABCD", "P1", "P1");
}

function outsiderView(game: Game, viewerId = "P2") {
  return game.toPlayerView("ABCD", "P1", viewerId);
}

describe("corrida UNO vs espião", () => {
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

  it("espião recebe canAccuseUno quando alvo está vulnerável", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    const view = spyView(game);
    const target = view.players.find((player) => player.id === "P2");

    expect(target?.canAccuseUno).toBe(true);
    expect(target?.isAtUnoCount).toBe(true);
  });

  it("não-espiões não recebem canAccuseUno", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    const view = outsiderView(game);
    const target = view.players.find((player) => player.id === "P2");

    expect(target?.canAccuseUno).toBeUndefined();
    expect(target?.isAtUnoCount).toBe(true);
  });

  it("declaração de UNO remove imediatamente a acusação do espião", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.declareUno("P2");

    const target = spyView(game).players.find((player) => player.id === "P2");
    expect(target?.canAccuseUno).toBe(false);
    expect(game.getPlayer("P2").unoDeclared).toBe(true);
  });

  it("espião não pode acusar após declaração de UNO", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");

    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P2").hand).toHaveLength(1);
    expect(game.getPlayer("P1").hand).toHaveLength(0);
  });

  it("acusação obsoleta após UNO não pune o espião", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");

    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P1").hand).toHaveLength(0);
  });

  it("espião acusa antes da declaração e alvo compra 2", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.accuseUno("P1", "P2");

    expect(game.getPlayer("P2").hand).toHaveLength(3);
    expect(game.getPlayer("P2").unoDeclared).toBe(false);
  });

  it("acusação bem-sucedida remove vulnerabilidade UNO", () => {
    const game = setup();
    give(game, "P2", number("red", 1));

    game.accuseUno("P1", "P2");

    const target = spyView(game).players.find((player) => player.id === "P2");
    expect(target?.canAccuseUno).toBe(false);
    expect(target?.isAtUnoCount).toBe(false);
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

  it("apenas o espião atual pode acusar", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    setSpy(game, "P3");

    expect(() => game.accuseUno("P1", "P2")).toThrow(ERRORS.spyOnlyAccuse);
  });

  it("não vaza unoDeclared na serialização", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");

    const serialized = JSON.stringify(spyView(game));
    expect(serialized).not.toContain("unoDeclared");
  });

  it("serialização do espião atualiza após declaração", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    expect(
      spyView(game).players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(true);

    game.declareUno("P2");

    expect(
      spyView(game).players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(false);
  });

  it("serialização do espião atualiza após acusação", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.accuseUno("P1", "P2");

    expect(
      spyView(game).players.find((player) => player.id === "P2")?.canAccuseUno,
    ).toBe(false);
    expect(
      spyView(game).players.find((player) => player.id === "P2")?.cardCount,
    ).toBe(3);
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
});
