import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { Game } from "../game/game.js";
import { ERRORS } from "../messages.js";

let serial = 40_000;
const number = (color: CardColor, value: number): Card => ({
  id: `c-${++serial}`,
  kind: "number",
  color,
  value,
});
const wild = (kind: "wild" | "wild-draw-four"): Card => ({
  id: `c-${++serial}`,
  kind,
  color: null,
});

function setup(): Game {
  const game = new Game(
    ["P1", "P2", "P3"].map((nickname) => ({ id: nickname, nickname })),
    () => 0.4,
  );
  game.phase = "playing";
  game.matchPlayerOrder = ["P1", "P2", "P3"];
  game.discardPile = [number("green", 9)];
  game.activeColor = "green";
  game.drawPile = Array.from({ length: 40 }, (_, value) =>
    number("red", value % 9),
  );
  return game;
}

function give(game: Game, playerId: string, ...cards: Card[]): void {
  game.getPlayer(playerId).hand = cards;
}

describe("jogada agrupada após comprar", () => {
  it("joga imediatamente a carta comprada", () => {
    const game = setup();
    const drawn = number("green", 4);
    give(game, "P1", number("red", 2));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCards("P1", [drawn.id]);
    expect(game.topDiscard).toBe(drawn);
  });

  it("joga a carta comprada com uma cópia idêntica antiga", () => {
    const game = setup();
    const old = number("green", 4);
    const drawn = number("green", 4);
    give(game, "P1", old, number("red", 2));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCards("P1", [drawn.id, old.id]);
    expect(game.getPlayer("P1").hand).toHaveLength(1);
    expect(game.pendingDrawPlay).toBeNull();
  });

  it("joga a carta comprada com várias cópias idênticas antigas", () => {
    const game = setup();
    const old1 = number("green", 4);
    const old2 = number("green", 4);
    const drawn = number("green", 4);
    give(game, "P1", old1, old2, number("red", 2));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCards("P1", [old1.id, drawn.id, old2.id]);
    expect(game.getPlayer("P1").hand).toHaveLength(1);
  });

  it("exige que o grupo contenha o ID recém-comprado", () => {
    const game = setup();
    const old = number("green", 4);
    const drawn = number("green", 4);
    give(game, "P1", old);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(() => game.playDrawnCards("P1", [old.id])).toThrow(
      ERRORS.drawnCardRequired,
    );
  });

  it("rejeita uma carta não idêntica junto da comprada", () => {
    const game = setup();
    const other = number("green", 7);
    const drawn = number("green", 4);
    give(game, "P1", other);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(() =>
      game.playDrawnCards("P1", [drawn.id, other.id]),
    ).toThrow(ERRORS.cardsNotIdentical);
  });

  it("rejeita outra carta jogável que não veio da compra", () => {
    const game = setup();
    const other = number("green", 7);
    const drawn = number("green", 4);
    give(game, "P1", other);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(() => game.playDrawnCards("P1", [other.id])).toThrow(
      ERRORS.drawnCardRequired,
    );
  });

  it("mantém todas as cartas e encerra a vez ao recusar", () => {
    const game = setup();
    const drawn = number("green", 4);
    give(game, "P1", number("red", 2));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.keepDrawnCard("P1");
    expect(game.getPlayer("P1").hand).toContain(drawn);
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("preserva a proibição de terminar com grupo de coringas", () => {
    const game = setup();
    const old = wild("wild");
    const drawn = wild("wild");
    give(game, "P1", old);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(() =>
      game.playDrawnCards("P1", [drawn.id, old.id], "blue"),
    ).toThrow(ERRORS.wildFinish);
  });

  it("deixa o jogador sem UNO declarado ao terminar a jogada com uma carta", () => {
    const game = setup();
    const old = number("green", 4);
    const drawn = number("green", 4);
    const remaining = number("red", 2);
    give(game, "P1", old, remaining);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCards("P1", [drawn.id, old.id]);
    expect(game.getPlayer("P1").hand).toEqual([remaining]);
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
  });
});

describe("declaração e acusação de UNO", () => {
  it("expõe contagem pública apenas até 3 cartas sem expor cartas adversárias", () => {
    const game = setup();
    give(game, "P1", number("red", 1));
    give(game, "P2", number("blue", 2), number("yellow", 3));
    const serialized = JSON.stringify(
      game.toPlayerView("ABCD", "P1", "P1"),
    );
    expect(
      game
        .toPlayerView("ABCD", "P1", "P1")
        .players.find((player) => player.id === "P2")?.cardCount,
    ).toBe(2);
    expect(serialized).not.toContain(game.getPlayer("P2").hand[0]!.id);

    const outsider = game.toPlayerView("ABCD", "P1", "P2");
    expect(
      outsider.players.find((player) => player.id === "P1")?.cardCount,
    ).toBe(1);
    expect(
      outsider.players.find((player) => player.id === "P2")?.cardCount,
    ).toBe(2);
  });

  it("exige nova declaração ao chegar a exatamente uma carta", () => {
    const game = setup();
    const played = number("green", 4);
    give(game, "P1", played, number("red", 2));
    game.getPlayer("P1").unoDeclared = true;
    game.playCard("P1", played.id);
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
  });

  it("declara UNO com exatamente uma carta e impede repetição", () => {
    const game = setup();
    give(game, "P1", number("red", 2));
    game.declareUno("P1");
    expect(game.getPlayer("P1").unoDeclared).toBe(true);
    expect(() => game.declareUno("P1")).toThrow(ERRORS.unoAlreadyDeclared);
  });

  it("não permite declarar UNO com duas cartas", () => {
    const game = setup();
    give(game, "P1", number("red", 2), number("blue", 3));
    expect(() => game.declareUno("P1")).toThrow(ERRORS.noLongerAtUnoCount);
  });

  it("aplica duas cartas ao alvo em uma acusação correta", () => {
    const game = setup();
    give(game, "P2", number("red", 1));
    game.accuseUno("P1", "P2");
    expect(game.getPlayer("P2").hand).toHaveLength(3);
    expect(game.getPlayer("P2").unoDeclared).toBe(false);
  });

  it("rejeita acusação quando o alvo tem mais de uma carta", () => {
    const game = setup();
    give(game, "P1", number("red", 1));
    give(game, "P2", number("red", 2), number("blue", 3));
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );
    expect(game.getPlayer("P1").hand).toHaveLength(1);
  });

  it("rejeita acusação quando o alvo já declarou UNO", () => {
    const game = setup();
    give(game, "P1", number("red", 1));
    give(game, "P2", number("red", 1));
    game.declareUno("P2");
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );
    expect(game.getPlayer("P1").hand).toHaveLength(1);
    expect(game.getPlayer("P2").hand).toHaveLength(1);
  });

  it("não permite acusar a si mesmo", () => {
    const game = setup();
    expect(() => game.accuseUno("P1", "P1")).toThrow(ERRORS.catchSelf);
  });

  it("penalidades administrativas não criam nem alteram correntes ou turnos", () => {
    const game = setup();
    give(game, "P1", number("red", 1));
    give(game, "P2", number("red", 1));
    game.drawChain = { type: "DRAW_TWO", amount: 6, activeColor: "red" };
    const currentBefore = game.currentPlayer.id;
    game.accuseUno("P1", "P2");
    expect(game.drawChain).toEqual({
      type: "DRAW_TWO",
      amount: 6,
      activeColor: "red",
    });
    expect(game.currentPlayer.id).toBe(currentBefore);

    give(game, "P2", number("red", 2), number("blue", 3));
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );
    expect(game.drawChain?.amount).toBe(6);
    expect(game.currentPlayer.id).toBe(currentBefore);
  });

  it("reseta a declaração quando a mão sai de uma carta", () => {
    const game = setup();
    give(game, "P1", number("red", 2));
    game.getPlayer("P1").unoDeclared = true;
    game.drawPile = [number("blue", 8)];
    game.drawOneCard("P1");
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
  });

  it("vencer com zero cartas não exige declaração", () => {
    const game = setup();
    const final = number("green", 4);
    give(game, "P1", final);
    game.playCard("P1", final.id);
    expect(game.winnerId).toBe("P1");
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
  });

  it("reiniciar limpa todas as declarações", () => {
    const game = setup();
    game.phase = "finished";
    for (const player of game.players) player.unoDeclared = true;
    game.restart();
    expect(game.players.every((player) => !player.unoDeclared)).toBe(true);
  });
});

describe("fim de partida e reinício explícito", () => {
  it("permite vencer com a última carta colorida sem UNO declarado", () => {
    const game = setup();
    const first = number("green", 4);
    const final = number("red", 7);
    give(game, "P1", first, final);

    game.playCard("P1", first.id);
    expect(game.getPlayer("P1").hand).toEqual([final]);
    expect(game.getPlayer("P1").unoDeclared).toBe(false);

    game.currentPlayerIndex = 0;
    game.activeColor = "red";
    game.playCard("P1", final.id);

    expect(game.phase).toBe("finished");
    expect(game.winnerId).toBe("P1");
    expect(game.getPlayer("P1").hand).toHaveLength(0);
  });

  it("preserva vencedor e mãos sem reiniciar ou redistribuir automaticamente", () => {
    const game = setup();
    const final = number("green", 2);
    give(game, "P1", final);
    give(game, "P2", number("red", 1), number("blue", 2));
    const drawPileBefore = game.drawPile.length;

    game.playCard("P1", final.id);

    expect(game.phase).toBe("finished");
    expect(game.winnerId).toBe("P1");
    expect(game.getPlayer("P1").hand).toHaveLength(0);
    expect(game.getPlayer("P2").hand).toHaveLength(2);
    expect(game.drawPile).toHaveLength(drawPileBefore);
  });

  it("rejeita acusação após a vitória sem alterar nenhuma mão", () => {
    const game = setup();
    const final = number("green", 2);
    give(game, "P1", final);
    give(game, "P2", number("red", 1));
    give(game, "P3", number("blue", 2));
    game.playCard("P1", final.id);
    const handSizes = game.players.map((player) => player.hand.length);

    expect(() => game.accuseUno("P2", "P1")).toThrow(
      ERRORS.gameFinished,
    );
    expect(game.players.map((player) => player.hand.length)).toEqual(handSizes);
    expect(game.winnerId).toBe("P1");
  });

  it("deriva acusação somente para uma carta sem UNO declarado", () => {
    const game = setup();

    give(game, "P2", number("red", 1), number("blue", 2));
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );

    give(game, "P2", number("red", 1));
    game.getPlayer("P2").unoDeclared = false;
    game.accuseUno("P1", "P2");

    give(game, "P2", number("red", 1));
    game.getPlayer("P2").unoDeclared = true;
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.unoAlreadyDeclaredByTarget,
    );

    give(game, "P2");
    game.getPlayer("P2").unoDeclared = false;
    expect(() => game.accuseUno("P1", "P2")).toThrow(
      ERRORS.targetNoLongerAtUnoCount,
    );
  });

  it("estado público oculta contagem acima de 3 cartas", () => {
    const game = new Game([
      { id: "P1", nickname: "P1" },
      { id: "P2", nickname: "P2" },
    ]);
    game.start();
    const p1 = game.getPlayer("P1");
    const p2 = game.getPlayer("P2");
    p1.hand = [number("red", 1), number("red", 2), number("red", 3), number("red", 4)];
    p2.hand = [number("blue", 1), number("blue", 2), number("blue", 3)];
    const p1View = game.toPlayerView("ABCD", "P1", "P1");
    const p2View = game.toPlayerView("ABCD", "P1", "P2");

    expect(p1View.players.find((player) => player.id === "P2")?.cardCount).toBe(3);
    expect(p2View.players.find((player) => player.id === "P1")?.cardCount).toBeNull();
  });

  it("somente restart explícito cria uma rodada nova com estado limpo", () => {
    const game = setup();
    const final = number("green", 2);
    give(game, "P1", final);
    game.getPlayer("P2").unoDeclared = true;
    game.pendingDrawPlay = { playerId: "P1", cardId: final.id };
    game.playCard("P1", final.id);

    expect(game.phase).toBe("finished");
    expect(game.winnerId).toBe("P1");
    expect(game.players.some((player) => player.hand.length === 7)).toBe(
      false,
    );
    game.drawChain = { type: "DRAW_TWO", amount: 6, activeColor: "green" };

    game.restart();

    expect(game.phase).toBe("playing");
    expect(game.winnerId).toBeNull();
    expect(game.drawChain).toBeNull();
    expect(game.pendingDrawPlay).toBeNull();
    expect(game.direction).toBe(1);
    expect(game.players.every((player) => player.hand.length === 7)).toBe(true);
    expect(game.players.every((player) => !player.unoDeclared)).toBe(true);
  });

  it("não permite iniciar novamente uma partida já em andamento", () => {
    const game = setup();
    expect(() => game.start()).toThrow(ERRORS.matchStarted);
  });
});
