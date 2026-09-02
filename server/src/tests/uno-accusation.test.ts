import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { Game } from "../game/game.js";
import { ERRORS } from "../messages.js";
import { bootstrapSpy, setSpy } from "./test-helpers.js";

let serial = 60_000;
const number = (color: CardColor, value: number): Card => ({
  id: `u-${++serial}`,
  kind: "number",
  color,
  value,
});
const wild = (kind: "wild" | "wild-draw-four"): Card => ({
  id: `u-${++serial}`,
  kind,
  color: null,
});

function setup(): Game {
  const ids = ["P1", "P2", "P3", "P4"];
  const game = new Game(
    ids.map((nickname) => ({ id: nickname, nickname })),
    () => 0.35,
  );
  game.phase = "playing";
  game.matchPlayerOrder = [...ids];
  bootstrapSpy(game, ids);
  game.currentPlayerIndex = 0;
  game.activeColor = "green";
  game.discardPile = [number("green", 9)];
  game.drawPile = Array.from({ length: 50 }, (_, index) =>
    number("blue", index % 9),
  );
  return game;
}

function give(game: Game, playerId: string, ...cards: Card[]): void {
  game.getPlayer(playerId).hand = cards;
}

describe("acusação de UNO a qualquer momento", () => {
  it("permite acusar quando não é a vez do acusador", () => {
    const game = setup();
    game.currentPlayerIndex = 0;
    give(game, "P3", number("red", 1));
    give(game, "P2", number("green", 4), number("blue", 2));
    setSpy(game, "P2");

    expect(game.currentPlayer.id).toBe("P1");
    game.accuseUno("P2", "P3");
    expect(game.getPlayer("P3").hand).toHaveLength(3);
    expect(game.currentPlayer.id).toBe("P1");
  });

  it("permite acusar enquanto a vez de um terceiro jogador está ativa", () => {
    const game = setup();
    game.currentPlayerIndex = 3;
    give(game, "P2", number("red", 1));

    expect(game.currentPlayer.id).toBe("P4");
    game.accuseUno("P1", "P2");
    expect(game.currentPlayer.id).toBe("P4");
  });

  it("acusação correta faz o alvo comprar 2 sem mudar o turno", () => {
    const game = setup();
    game.currentPlayerIndex = 2;
    give(game, "P1", number("red", 1));
    const turn = game.currentPlayerIndex;
    setSpy(game, "P4");

    game.accuseUno("P4", "P1");
    expect(game.getPlayer("P1").hand).toHaveLength(3);
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
    expect(game.currentPlayerIndex).toBe(turn);
    expect(game.drawChain).toBeNull();
  });

  it("acusação inválida com alvo fora de vulnerabilidade não pune ninguém", () => {
    const game = setup();
    game.currentPlayerIndex = 0;
    give(game, "P1", number("green", 3));
    give(game, "P2", number("red", 2), number("blue", 3));
    const turn = game.currentPlayerIndex;

    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );
    expect(game.getPlayer("P1").hand).toHaveLength(1);
    expect(game.getPlayer("P2").hand).toHaveLength(2);
    expect(game.currentPlayerIndex).toBe(turn);
    expect(game.drawChain).toBeNull();
  });

  it("acusação correta durante corrente não altera valor nem alvo da corrente", () => {
    const game = setup();
    game.currentPlayerIndex = 2;
    game.drawChain = { type: "DRAW_TWO", amount: 6, activeColor: "yellow" };
    give(game, "P1", number("red", 1));
    const chain = { ...game.drawChain };
    setSpy(game, "P4");

    game.accuseUno("P4", "P1");
    expect(game.drawChain).toEqual(chain);
    expect(game.currentPlayer.id).toBe("P3");
  });

  it("acusação correta não cancela a escolha de cor de um coringa pendente", () => {
    const game = setup();
    const wildCard = wild("wild");
    give(game, "P1", wildCard, number("blue", 1));
    give(game, "P2", number("red", 1));
    game.currentPlayerIndex = 0;
    setSpy(game, "P3");

    game.accuseUno("P3", "P2");
    expect(game.currentPlayer.id).toBe("P1");
    game.playCard("P1", wildCard.id, "blue");
    expect(game.activeColor).toBe("blue");
    expect(game.phase).toBe("playing");
  });

  it("acusação correta não limpa pendingDrawPlay", () => {
    const game = setup();
    const drawn = number("green", 2);
    give(game, "P1", number("blue", 8));
    give(game, "P2", number("red", 1));
    game.drawPile = [...game.drawPile, drawn];
    game.drawOneCard("P1");
    const pending = { ...game.pendingDrawPlay! };
    setSpy(game, "P3");

    game.accuseUno("P3", "P2");
    expect(game.pendingDrawPlay).toEqual(pending);
    expect(game.currentPlayer.id).toBe("P1");
  });

  it("a primeira acusação válida pune o alvo; a segunda de não-espião é rejeitada", () => {
    const game = setup();
    give(game, "P1", number("red", 1));
    give(game, "P2", number("green", 3));
    give(game, "P3", number("blue", 4));
    game.currentPlayerIndex = 3;
    setSpy(game, "P2");

    game.accuseUno("P2", "P1");
    expect(game.getPlayer("P1").hand).toHaveLength(3);
    expect(() => game.accuseUno("P3", "P1")).toThrow(ERRORS.spyOnlyAccuse);
    expect(game.getPlayer("P1").hand).toHaveLength(3);
    expect(game.getPlayer("P3").hand).toHaveLength(1);
    expect(game.currentPlayer.id).toBe("P4");
  });

  it("declaração processada antes bloqueia acusação tardia sem punir espião", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P2").hand).toHaveLength(1);
    expect(game.getPlayer("P1").hand).toHaveLength(0);
  });

  it("acusação processada antes invalida a declaração posterior", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.accuseUno("P1", "P2");
    expect(game.getPlayer("P2").hand).toHaveLength(3);
    expect(() => game.declareUno("P2")).toThrow(ERRORS.noLongerAtUnoCount);
  });

  it("não permite acusar a si mesmo e não aplica penalidade", () => {
    const game = setup();
    give(game, "P1", number("red", 1));
    expect(() => game.accuseUno("P1", "P1")).toThrow(ERRORS.catchSelf);
    expect(game.getPlayer("P1").hand).toHaveLength(1);
  });

  it("jogador com 0 cartas não pode ser acusado após a vitória", () => {
    const game = setup();
    const final = number("green", 4);
    give(game, "P1", final);
    give(game, "P2", number("red", 1));
    game.playCard("P1", final.id);
    expect(game.getPlayer("P1").hand).toHaveLength(0);
    setSpy(game, "P2");
    expect(() => game.accuseUno("P2", "P1")).toThrow(ERRORS.gameFinished);
  });

  it("jogador com 2+ cartas não pode ser acusado", () => {
    const game = setup();
    give(game, "P2", number("red", 1), number("blue", 2));
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );
  });

  it("jogador com UNO declarado não pode ser acusado", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.declareUno("P2");
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P2").hand).toHaveLength(1);
  });

  it("estado público marca UNO sem expor contagem para não-espiões", () => {
    const game = setup();
    game.currentPlayerIndex = 2;
    give(game, "P4", number("red", 1));
    const spyView = game.toPlayerView("ABCD", "P1", "P1");
    const outsiderView = game.toPlayerView("ABCD", "P1", "P2");
    const targetSpy = spyView.players.find((player) => player.id === "P4");
    const targetOutsider = outsiderView.players.find(
      (player) => player.id === "P4",
    );

    expect(spyView.currentPlayerId).toBe("P3");
    expect(targetSpy?.cardCount).toBe(1);
    expect(targetSpy?.canAccuseUno).toBe(true);
    expect(targetSpy?.isAtUnoCount).toBe(true);
    expect(targetOutsider?.cardCount).toBeNull();
    expect(targetOutsider?.canAccuseUno).toBeUndefined();
    expect(targetOutsider?.isAtUnoCount).toBe(true);
  });
});
