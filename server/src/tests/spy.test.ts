import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { Game } from "../game/game.js";
import { ERRORS } from "../messages.js";
import { bootstrapSpy, setSpy } from "./test-helpers.js";

let serial = 80_000;
const number = (color: CardColor, value: number): Card => ({
  id: `s-${++serial}`,
  kind: "number",
  color,
  value,
});
const action = (
  color: CardColor,
  kind: "skip" | "reverse" | "draw-two",
): Card => ({ id: `s-${++serial}`, kind, color });

function players(ids: string[]) {
  return ids.map((id) => ({ id, nickname: id }));
}

function give(game: Game, playerId: string, ...cards: Card[]): void {
  game.getPlayer(playerId).hand = cards;
}

function playingGame(ids: string[], random = () => 0.42): Game {
  const game = new Game(players(ids), random);
  game.phase = "playing";
  game.matchPlayerOrder = [...ids];
  game.currentPlayerIndex = 0;
  game.direction = 1;
  game.discardPile = [number("red", 5)];
  game.activeColor = "red";
  game.drawPile = Array.from({ length: 80 }, (_, index) =>
    number("blue", index % 10),
  );
  return game;
}

describe("mecânica do espião", () => {
  it("seleciona exatamente um espião ao iniciar a partida", () => {
    const game = new Game(players(["A", "B", "C", "D", "E"]), () => 0);
    game.start();
    expect(game.spy.currentPlayerId).toBeTruthy();
    expect(["A", "B", "C", "D", "E"]).toContain(game.spy.currentPlayerId);
  });

  it("duração do espião iguala o número de jogadores ativos", () => {
    const game = new Game(players(["P1", "P2", "P3", "P4", "P5"]), () => 0);
    game.start();
    expect(game.spy.remainingTurns).toBe(5);
  });

  it("seleção do espião usa fila independente da ordem de turno", () => {
    const game = new Game(players(["P1", "P2", "P3", "P4"]), () => 0.42);
    game.start();
    expect(game.matchPlayerOrder).toHaveLength(4);
    expect(game.spy.currentPlayerId).toBeTruthy();
    expect(game.spy.selectionQueue).not.toEqual(
      game.matchPlayerOrder.slice(1),
    );
  });

  it("rotaciona o espião após turnos resolvidos", () => {
    const game = playingGame(["P1", "P2", "P3"]);
    bootstrapSpy(game, ["P1", "P2", "P3"], "P1");
    const p1Card = number("red", 5);
    const p2Card = number("red", 3);
    const p3Card = number("red", 4);
    give(game, "P1", p1Card, number("green", 1));
    give(game, "P2", p2Card, number("green", 2));
    give(game, "P3", p3Card, number("green", 3));

    game.playCard("P1", p1Card.id);
    expect(game.spy.remainingTurns).toBe(2);
    game.playCard("P2", p2Card.id);
    expect(game.spy.remainingTurns).toBe(1);
    game.playCard("P3", p3Card.id);
    expect(game.spy.currentPlayerId).toBe("P2");
    expect(game.spy.remainingTurns).toBe(3);
  });

  it("declarar UNO não consome duração do espião", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"]);
    give(game, "P1", number("red", 1));
    const before = game.spy.remainingTurns;
    game.declareUno("P1");
    expect(game.spy.remainingTurns).toBe(before);
  });

  it("acusar UNO não consome duração do espião", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"]);
    give(game, "P2", number("red", 1));
    const before = game.spy.remainingTurns;
    game.accuseUno("P1", "P2");
    expect(game.spy.remainingTurns).toBe(before);
  });

  it("skip múltiplo consome apenas um turno de espião", () => {
    const game = playingGame(["P1", "P2", "P3", "P4"]);
    bootstrapSpy(game, ["P1", "P2", "P3", "P4"]);
    const skips = [action("red", "skip"), action("red", "skip")];
    give(game, "P1", ...skips, number("green", 1));
    const before = game.spy.remainingTurns;
    game.playCards(
      "P1",
      skips.map((card) => card.id),
    );
    expect(game.spy.remainingTurns).toBe(before - 1);
  });

  it("não repete espião antes de todos servirem", () => {
    const game = new Game(players(["P1", "P2", "P3", "P4", "P5"]), () => 0);
    game.start();
    const assigned: string[] = [];
    for (let round = 0; round < 5; round += 1) {
      assigned.push(game.spy.currentPlayerId!);
      game.spy.remainingTurns = 1;
      const current = game.currentPlayer.id;
      const card = number("red", 5);
      give(game, current, card, number("green", 1));
      game.playCard(current, card.id);
    }
    expect(new Set(assigned).size).toBe(5);
  });

  it("reinício cria um novo ciclo de espião", () => {
    const game = new Game(players(["P1", "P2", "P3"]), () => 0);
    game.start();
    const firstSpy = game.spy.currentPlayerId;
    const win = number("red", 1);
    give(game, game.currentPlayer.id, win);
    game.playCard(game.currentPlayer.id, win.id);
    expect(game.phase).toBe("finished");
    game.restart();
    expect(game.spy.currentPlayerId).toBeTruthy();
    expect(game.spy.selectionQueue.length).toBeGreaterThan(0);
    expect(game.phase).toBe("playing");
    expect(firstSpy).toBeTruthy();
  });

  it("espião vê contagens exatas e não-espião recebe null", () => {
    const game = playingGame(["P1", "P2", "P3"]);
    bootstrapSpy(game, ["P1", "P2", "P3"], "P1");
    give(
      game,
      "P2",
      number("red", 1),
      number("red", 2),
      number("red", 3),
      number("red", 4),
      number("red", 5),
      number("red", 6),
    );
    give(
      game,
      "P3",
      number("blue", 1),
      number("blue", 2),
      number("blue", 3),
      number("blue", 4),
      number("blue", 5),
      number("blue", 6),
      number("blue", 7),
      number("blue", 8),
      number("blue", 9),
    );

    const spyView = game.toPlayerView("ABCD", "P1", "P1");
    const outsiderView = game.toPlayerView("ABCD", "P1", "P2");

    expect(spyView.players.find((p) => p.id === "P2")?.cardCount).toBe(6);
    expect(spyView.players.find((p) => p.id === "P3")?.cardCount).toBe(9);
    expect(outsiderView.players.find((p) => p.id === "P3")?.cardCount).toBeNull();
    expect(outsiderView.players.find((p) => p.id === "P2")?.cardCount).toBe(6);
  });

  it("não vaza contagem em outros campos serializados", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"], "P1");
    give(game, "P2", number("red", 6));
    const serialized = JSON.stringify(game.toPlayerView("ABCD", "P1", "P2"));
    expect(serialized).not.toContain('"cardCount":6');
    expect(serialized).not.toContain("unoDeclared");
    expect(serialized).not.toContain("selectionQueue");
  });

  it("expõe isAtUnoCount sem expor unoDeclared", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"]);
    give(game, "P2", number("red", 1));
    game.getPlayer("P2").unoDeclared = true;
    const view = game.toPlayerView("ABCD", "P1", "P1");
    const target = view.players.find((player) => player.id === "P2");
    expect(target?.isAtUnoCount).toBe(true);
    expect(JSON.stringify(view)).not.toContain("unoDeclared");
  });

  it("rejeita acusação de não-espião", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"], "P1");
    give(game, "P2", number("red", 1));
    expect(() => game.accuseUno("P2", "P1")).toThrow(ERRORS.spyOnlyAccuse);
  });

  it("troca espião imediatamente quando o atual desconecta", () => {
    const game = playingGame(["P1", "P2", "P3"]);
    bootstrapSpy(game, ["P1", "P2", "P3"], "P1");
    game.currentPlayerIndex = 1;
    const turnBefore = game.currentPlayer.id;
    const chainBefore = game.drawChain;
    game.setConnected("P1", false);
    expect(game.spy.currentPlayerId).not.toBe("P1");
    expect(game.spy.remainingTurns).toBe(2);
    expect(game.currentPlayer.id).toBe(turnBefore);
    expect(game.drawChain).toBe(chainBefore);
  });

  it("para rotação do espião ao terminar a partida", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"]);
    const final = number("red", 4);
    give(game, "P1", final);
    game.playCard("P1", final.id);
    const spyAtEnd = game.spy.currentPlayerId;
    expect(game.phase).toBe("finished");
    expect(spyAtEnd).toBeTruthy();
  });

  it("placar final revela todas as contagens", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"], "P2");
    const final = number("red", 4);
    give(game, "P1", final);
    game.playCard("P1", final.id);
    const view = game.toPlayerView("ABCD", "P1", "P2");
    expect(view.players.every((player) => player.cardCount !== null)).toBe(true);
  });

  it("serializa identidade do espião para todos", () => {
    const game = playingGame(["P1", "P2", "P3"]);
    bootstrapSpy(game, ["P1", "P2", "P3"], "P2");
    const view = game.toPlayerView("ABCD", "P1", "P1");
    expect(view.currentSpyPlayerId).toBe("P2");
    expect(view.players.find((p) => p.id === "P2")?.isSpy).toBe(true);
    expect(view.spyRemainingTurns).toBeNull();
  });

  it("mostra turnos restantes apenas para o espião", () => {
    const game = playingGame(["P1", "P2"]);
    bootstrapSpy(game, ["P1", "P2"], "P1");
    const spyView = game.toPlayerView("ABCD", "P1", "P1");
    const outsiderView = game.toPlayerView("ABCD", "P1", "P2");
    expect(spyView.spyRemainingTurns).toBe(2);
    expect(outsiderView.spyRemainingTurns).toBeNull();
  });
});

describe("UI do botão UNO local", () => {
  it("mantém o botão UNO ao lado da contagem da mão", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../client/src/App.tsx"),
      "utf8",
    );
    expect(source).toContain("Sua mão");
    expect(source).toContain("Tô de UNO!");
    expect(source).toContain("UNO declarado ✓");
    expect(source).not.toMatch(
      /justify-between[\s\S]{0,200}uno-button/,
    );
  });
});

describe("UI do placar com espião", () => {
  it("exibe marcador e botão de acusação desabilitado para não-espiões", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../client/src/components/PlayerBoard.tsx"),
      "utf8",
    );
    expect(source).toContain("🕵️");
    expect(source).toContain("? cartas");
    expect(source).toContain("canAccuseUno");
  });
});
