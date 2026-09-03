import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { Game } from "../game/game.js";

let serial = 50_000;
const number = (color: CardColor, value: number): Card => ({
  id: `r-${++serial}`,
  kind: "number",
  color,
  value,
});

function setup(): Game {
  const game = new Game(
    ["P1", "P2", "P3", "P4"].map((nickname) => ({
      id: nickname,
      nickname,
    })),
    () => 0.3,
  );
  game.phase = "playing";
  game.matchPlayerOrder = ["P1", "P2", "P3", "P4"];
  game.currentPlayerIndex = 0;
  game.activeColor = "green";
  game.discardPile = [number("green", 9)];
  game.drawPile = Array.from({ length: 60 }, (_, index) =>
    number("blue", index % 10),
  );
  return game;
}

function cards(count: number, color: CardColor = "red"): Card[] {
  return Array.from({ length: count }, (_, index) =>
    number(color, index % 10),
  );
}

describe("estado público dos jogadores", () => {
  it("local vê própria contagem e oponentes só até 3 cartas", () => {
    const game = setup();
    game.getPlayer("P1").hand = cards(4);
    game.getPlayer("P2").hand = cards(1);
    game.getPlayer("P3").hand = cards(7);
    game.getPlayer("P4").hand = cards(3);

    const view = game.toPlayerView("ABCD", "P1", "P1");

    expect(view.players.map((player) => player.cardCount)).toEqual([
      4, 1, null, 3,
    ]);
    expect(
      view.players.filter((player) => player.isCurrentTurn).map((p) => p.id),
    ).toEqual(["P1"]);
    expect(
      view.players.find((player) => player.id === "P2")?.isAtUnoCount,
    ).toBe(true);
    expect(
      view.players.find((player) => player.id === "P3")?.isAtUnoCount,
    ).toBe(false);

    const outsider = game.toPlayerView("ABCD", "P1", "P2");
    expect(outsider.players.map((player) => player.cardCount)).toEqual([
      null,
      1,
      null,
      3,
    ]);
  });

  it("mostra null para oponente com 4+ e número exato para 3 ou menos", () => {
    const game = setup();
    game.getPlayer("P1").hand = cards(8);
    game.getPlayer("P2").hand = cards(4);
    game.getPlayer("P3").hand = cards(3);
    game.getPlayer("P4").hand = cards(2);

    const view = game.toPlayerView("ABCD", "P1", "P1");
    expect(view.players.find((player) => player.id === "P2")?.cardCount).toBeNull();
    expect(view.players.find((player) => player.id === "P3")?.cardCount).toBe(3);
    expect(view.players.find((player) => player.id === "P4")?.cardCount).toBe(2);
    expect(view.players.find((player) => player.id === "P1")?.cardCount).toBe(8);
  });

  it("não serializa cartas nem IDs da mão dos adversários", () => {
    const game = setup();
    const secret = { ...number("blue", 8), id: "ID-SECRETO-ADVERSARIO" };
    game.getPlayer("P1").hand = cards(2);
    game.getPlayer("P2").hand = [secret];

    const serialized = JSON.stringify(
      game.toPlayerView("ABCD", "P1", "P1"),
    );

    expect(serialized).not.toContain("ID-SECRETO-ADVERSARIO");
    expect(serialized).not.toContain('"value":8');
    expect(serialized).not.toContain('"cardCount":7');
    expect(serialized).not.toContain("unoDeclared");
  });
});

describe("resultado final imutável", () => {
  function finishRankedGame(): Game {
    const game = setup();
    game.getPlayer("P1").hand = [number("green", 4)];
    game.getPlayer("P2").hand = cards(2);
    game.getPlayer("P3").hand = cards(2, "yellow");
    game.getPlayer("P4").hand = cards(5, "blue");
    game.playCard("P1", game.getPlayer("P1").hand[0]!.id);
    return game;
  }

  it("fotografa todos os jogadores e coloca o vencedor em primeiro", () => {
    const game = finishRankedGame();

    expect(game.phase).toBe("finished");
    expect(game.result?.winnerId).toBe("P1");
    expect(game.result?.standings).toHaveLength(4);
    expect(game.result?.standings[0]).toEqual({
      playerId: "P1",
      userId: null,
      nickname: "P1",
      cardsRemaining: 0,
      position: 1,
    });
  });

  it("ordena por cartas restantes e usa classificação com empates", () => {
    const game = finishRankedGame();

    expect(
      game.result?.standings.map((standing) => ({
        id: standing.playerId,
        cards: standing.cardsRemaining,
        position: standing.position,
      })),
    ).toEqual([
      { id: "P1", cards: 0, position: 1 },
      { id: "P2", cards: 2, position: 2 },
      { id: "P3", cards: 2, position: 2 },
      { id: "P4", cards: 5, position: 4 },
    ]);
  });

  it("mantém o resultado mesmo se uma mão for alterada depois do fim", () => {
    const game = finishRankedGame();
    const snapshot = structuredClone(game.result);

    game.getPlayer("P4").hand.push(...cards(8));

    expect(game.result).toEqual(snapshot);
    expect(game.winnerId).toBe("P1");
    expect(game.phase).toBe("finished");
  });

  it("não reinicia nem distribui cartas automaticamente após vencer", () => {
    const game = finishRankedGame();

    expect(game.getPlayer("P1").hand).toHaveLength(0);
    expect(game.getPlayer("P2").hand).toHaveLength(2);
    expect(game.getPlayer("P3").hand).toHaveLength(2);
    expect(game.getPlayer("P4").hand).toHaveLength(5);
  });

  it("reinício explícito limpa resultado e distribui sete cartas novas", () => {
    const game = finishRankedGame();

    game.restart();

    expect(game.result).toBeNull();
    expect(game.winnerId).toBeNull();
    expect(game.phase).toBe("playing");
    expect(game.players.every((player) => player.hand.length === 7)).toBe(true);
  });
});

describe("responsividade do placar público", () => {
  it("mantém o placar renderizado em telas móveis", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../client/src/components/PlayerBoard.tsx"),
      "utf8",
    );

    expect(source).toContain("grid grid-cols-2");
    expect(source).toContain("? cartas");
    expect(source).toContain('player.cardCount === 1 ? "carta" : "cartas"');
    expect(source).not.toMatch(/hidden[^"]*PlayerBoard|PlayerBoard[^"]*hidden/);
  });
});
