import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { buildMatchPlayerOrder, Game } from "../game/game.js";
import { ERRORS } from "../messages.js";
import { bootstrapSpy } from "./test-helpers.js";

let serial = 70_000;
const number = (color: CardColor, value: number): Card => ({
  id: `m-${++serial}`,
  kind: "number",
  color,
  value,
});
const action = (
  color: CardColor,
  kind: "skip" | "reverse" | "draw-two",
): Card => ({ id: `m-${++serial}`, kind, color });

function players(ids: string[]) {
  return ids.map((id) => ({ id, nickname: id }));
}

function playingGame(
  ids: string[],
  matchOrder: string[],
  random: () => number = () => 0.42,
): Game {
  const game = new Game(players(ids), random);
  game.phase = "playing";
  game.matchPlayerOrder = [...matchOrder];
  bootstrapSpy(game, matchOrder);
  game.currentPlayerIndex = 0;
  game.direction = 1;
  game.discardPile = [number("red", 5)];
  game.activeColor = "red";
  game.drawPile = Array.from({ length: 80 }, (_, index) =>
    number("blue", index % 10),
  );
  return game;
}

function give(game: Game, playerId: string, ...cards: Card[]): void {
  game.getPlayer(playerId).hand = cards;
}

describe("ordem da partida", () => {
  it("cria uma ordem de partida com cada jogador elegível exatamente uma vez", () => {
    const game = new Game(players(["a", "b", "c", "d"]), () => 0.5);
    game.start();

    expect(game.matchPlayerOrder).toHaveLength(4);
    expect(new Set(game.matchPlayerOrder)).toEqual(
      new Set(["a", "b", "c", "d"]),
    );
  });

  it("sorteia uma ordem independente da ordem de entrada na sala", () => {
    const joinOrder = ["host", "maria", "joao", "pedro", "ana"];
    const game = new Game(players(joinOrder), () => 0);
    game.start();

    expect(game.matchPlayerOrder).not.toEqual(joinOrder);
    expect(new Set(game.matchPlayerOrder)).toEqual(new Set(joinOrder));
  });

  it("não duplica nem perde jogadores após o sorteio", () => {
    const ids = ["P1", "P2", "P3", "P4", "P5"];
    const game = new Game(players(ids), () => 0.25);
    game.start();

    expect(game.matchPlayerOrder.sort()).toEqual([...ids].sort());
  });

  it("dá a primeira jogada ao primeiro jogador da ordem sorteada", () => {
    const game = new Game(players(["a", "b", "c"]), () => 0);
    game.start();

    expect(game.currentPlayer.id).toBe(game.matchPlayerOrder[0]);
    expect(game.currentPlayerIndex).toBe(0);
  });

  it("exibe o placar público na ordem da partida durante o jogo", () => {
    const lobbyOrder = ["P1", "P2", "P3", "P4"];
    const game = playingGame(lobbyOrder, ["P3", "P1", "P4", "P2"]);

    const view = game.toPlayerView("ABCD", "P1", "P1", lobbyOrder);

    expect(view.players.map((player) => player.id)).toEqual([
      "P3",
      "P1",
      "P4",
      "P2",
    ]);
  });

  it("mantém a ordem do lobby na fase de lobby", () => {
    const lobbyOrder = ["host", "maria", "joao"];
    const game = new Game(players(lobbyOrder), () => 0);
    game.matchPlayerOrder = ["joao", "host", "maria"];

    const view = game.toPlayerView("ABCD", "host", "host", lobbyOrder);

    expect(view.players.map((player) => player.id)).toEqual(lobbyOrder);
  });

  it("usa a ordem sorteada corretamente com Reverse", () => {
    const game = playingGame(["P1", "P2", "P3"], ["P2", "P3", "P1"]);
    give(game, "P2", action("red", "reverse"), number("green", 1));

    game.playCard("P2", game.getPlayer("P2").hand[0]!.id);

    expect(game.currentPlayer.id).toBe("P1");
  });

  it("usa a ordem sorteada corretamente com Skip", () => {
    const game = playingGame(["P1", "P2", "P3", "P4"], ["P3", "P1", "P4", "P2"]);
    give(game, "P3", action("red", "skip"), number("green", 1));

    game.playCard("P3", game.getPlayer("P3").hand[0]!.id);

    expect(game.currentPlayer.id).toBe("P4");
  });

  it("usa a ordem sorteada corretamente na corrente de compra", () => {
    const game = playingGame(["P1", "P2", "P3"], ["P2", "P3", "P1"]);
    give(game, "P2", action("red", "draw-two"), number("green", 1));
    give(game, "P3", number("green", 2));

    game.playCard("P2", game.getPlayer("P2").hand[0]!.id);

    expect(game.currentPlayer.id).toBe("P3");
    expect(game.drawChain?.amount).toBe(2);
  });

  it("sorteia novamente em cada rematch", () => {
    let seed = 0;
    const game = new Game(players(["P1", "P2", "P3", "P4"]), () => seed);
    game.start();
    const firstOrder = [...game.matchPlayerOrder];

    seed = 0.99;
    game.phase = "finished";
    game.restart();
    const secondOrder = [...game.matchPlayerOrder];

    expect(secondOrder).toHaveLength(4);
    expect(new Set(secondOrder).size).toBe(4);
    expect(secondOrder).not.toEqual(firstOrder);
  });

  it("não reordena jogadores no meio de uma partida ativa", () => {
    const game = playingGame(["P1", "P2", "P3"], ["P3", "P1", "P2"]);
    const redFive = number("red", 5);
    give(game, "P3", redFive, number("green", 1));
    const orderBefore = [...game.matchPlayerOrder];

    game.playCard("P3", redFive.id);
    game.setConnected("P1", false);

    expect(game.matchPlayerOrder).toEqual(orderBefore);
  });

  it("permite injetar a fonte aleatória para testes determinísticos", () => {
    const ids = ["a", "b", "c"];
    const first = buildMatchPlayerOrder(
      ids.map((id) => ({ id, connected: true })),
      () => 0,
    );
    const second = buildMatchPlayerOrder(
      ids.map((id) => ({ id, connected: true })),
      () => 0,
    );

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
  });

  it("marca atual, anterior e próximo no placar público", () => {
    const game = playingGame(["P1", "P2", "P3", "P4"], [
      "P2",
      "P3",
      "P4",
      "P1",
    ]);
    game.currentPlayerIndex = 1;
    game.lastPlayerId = "P2";

    const view = game.toPlayerView("ABCD", "P1", "P1");
    const byId = Object.fromEntries(
      view.players.map((player) => [player.id, player]),
    );

    expect(byId.P3?.isCurrentTurn).toBe(true);
    expect(byId.P2?.isPreviousTurn).toBe(true);
    expect(byId.P4?.isNextTurn).toBe(true);
    expect(byId.P1?.isCurrentTurn).toBe(false);
    expect(byId.P1?.isPreviousTurn).toBe(false);
    expect(byId.P1?.isNextTurn).toBe(false);
  });

  it("não marca anterior no início da partida", () => {
    const game = new Game(players(["P1", "P2", "P3"]), () => 0);
    game.start();

    const view = game.toPlayerView("ABCD", "P1", "P1");

    expect(view.players.some((player) => player.isPreviousTurn)).toBe(false);
    expect(view.players.filter((player) => player.isCurrentTurn)).toHaveLength(
      1,
    );
    expect(view.players.filter((player) => player.isNextTurn)).toHaveLength(1);
  });
});
