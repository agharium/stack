import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { Game } from "../game/game.js";
import { ERRORS } from "../messages.js";

let serial = 10_000;
const number = (color: CardColor, value: number): Card => ({
  id: `h-${++serial}`,
  kind: "number",
  color,
  value,
});
const action = (
  color: CardColor,
  kind: "skip" | "reverse" | "draw-two",
): Card => ({ id: `h-${++serial}`, kind, color });
const wild = (kind: "wild" | "wild-draw-four"): Card => ({
  id: `h-${++serial}`,
  kind,
  color: null,
});

function setup(names = ["P1", "P2", "P3", "P4"]): Game {
  const game = new Game(
    names.map((nickname) => ({ id: nickname, nickname })),
    () => 0.25,
  );
  game.phase = "playing";
  game.discardPile = [number("green", 9)];
  game.activeColor = "green";
  game.currentPlayerIndex = 0;
  game.drawPile = Array.from({ length: 40 }, (_, index) =>
    number("blue", index % 9),
  );
  return game;
}

function give(game: Game, playerId: string, ...cards: Card[]): void {
  game.getPlayer(playerId).hand = cards;
}

describe("playing identical groups", () => {
  it("plays two identical number cards in one move", () => {
    const game = setup();
    const cards = [number("green", 4), number("green", 4)];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.getPlayer("P1").hand).toHaveLength(1);
    expect(game.topDiscard).toBe(cards[1]);
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("plays three identical number cards in one move", () => {
    const game = setup();
    const cards = [
      number("green", 7),
      number("green", 7),
      number("green", 7),
    ];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.getPlayer("P1").hand).toHaveLength(1);
  });

  it("rejects same value with different colors", () => {
    const game = setup();
    const cards = [number("green", 4), number("red", 4)];
    give(game, "P1", ...cards);
    expect(() =>
      game.playCards("P1", cards.map((card) => card.id)),
    ).toThrow(ERRORS.cardsNotIdentical);
  });

  it("rejects same color with different values", () => {
    const game = setup();
    const cards = [number("green", 4), number("green", 5)];
    give(game, "P1", ...cards);
    expect(() =>
      game.playCards("P1", cards.map((card) => card.id)),
    ).toThrow(ERRORS.cardsNotIdentical);
  });

  it("rejects duplicate card IDs in one request", () => {
    const game = setup();
    const card = number("green", 4);
    give(game, "P1", card);
    expect(() => game.playCards("P1", [card.id, card.id])).toThrow(
      ERRORS.duplicateCard,
    );
  });

  it("requires every grouped card to belong to the player", () => {
    const game = setup();
    const card = number("green", 4);
    give(game, "P1", card);
    expect(() => game.playCards("P1", [card.id, "not-owned"])).toThrow(
      ERRORS.cardNotOwned,
    );
  });

  it("two identical Draw Twos start a +4 chain", () => {
    const game = setup();
    const cards = [action("green", "draw-two"), action("green", "draw-two")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.drawChain?.amount).toBe(4);
  });

  it("three identical Draw Twos start a +6 chain", () => {
    const game = setup();
    const cards = Array.from({ length: 3 }, () =>
      action("green", "draw-two"),
    );
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.drawChain?.amount).toBe(6);
  });

  it("grouped Draw Twos increase an existing Draw Two chain", () => {
    const game = setup();
    game.drawChain = { type: "DRAW_TWO", amount: 4, activeColor: "red" };
    const cards = [action("blue", "draw-two"), action("blue", "draw-two")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.drawChain).toEqual({
      type: "DRAW_TWO",
      amount: 8,
      activeColor: "blue",
    });
  });

  it("rejects grouped Draw Twos during a Draw Four chain", () => {
    const game = setup();
    game.drawChain = { type: "DRAW_FOUR", amount: 4, activeColor: "green" };
    const cards = [action("green", "draw-two"), action("green", "draw-two")];
    give(game, "P1", ...cards);
    expect(() =>
      game.playCards("P1", cards.map((card) => card.id)),
    ).toThrow(ERRORS.onlyDrawFour);
  });

  it("two identical Reverse cards reverse twice", () => {
    const game = setup();
    const cards = [action("green", "reverse"), action("green", "reverse")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.direction).toBe(1);
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("three identical Reverse cards reverse three times", () => {
    const game = setup();
    const cards = Array.from({ length: 3 }, () =>
      action("green", "reverse"),
    );
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.direction).toBe(-1);
    expect(game.currentPlayer.id).toBe("P4");
  });

  it("two identical Skip cards skip two player positions", () => {
    const game = setup();
    const cards = [action("green", "skip"), action("green", "skip")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.currentPlayer.id).toBe("P4");
  });

  it("wins by playing the final two identical colored cards", () => {
    const game = setup();
    const cards = [number("green", 4), number("green", 4)];
    give(game, "P1", ...cards);
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.winnerId).toBe("P1");
    expect(game.phase).toBe("finished");
  });

  it("cannot win with grouped Wild cards", () => {
    const game = setup();
    const cards = [wild("wild"), wild("wild")];
    give(game, "P1", ...cards);
    expect(() =>
      game.playCards("P1", cards.map((card) => card.id), "red"),
    ).toThrow(ERRORS.wildFinish);
  });

  it("groups identical Wild Draw Fours and adds four per card", () => {
    const game = setup();
    const cards = [wild("wild-draw-four"), wild("wild-draw-four")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id), "yellow");
    expect(game.drawChain).toEqual({
      type: "DRAW_FOUR",
      amount: 8,
      activeColor: "yellow",
    });
  });

  it("groups Wild Draw Fours during an existing Draw Four chain", () => {
    const game = setup();
    game.drawChain = { type: "DRAW_FOUR", amount: 4, activeColor: "red" };
    const cards = [wild("wild-draw-four"), wild("wild-draw-four")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id), "blue");
    expect(game.drawChain).toEqual({
      type: "DRAW_FOUR",
      amount: 12,
      activeColor: "blue",
    });
  });

  it("applies each grouped Skip while defending a chain", () => {
    const game = setup();
    game.drawChain = { type: "DRAW_TWO", amount: 6, activeColor: "green" };
    const cards = [action("green", "skip"), action("green", "skip")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.currentPlayer.id).toBe("P3");
    expect(game.drawChain?.amount).toBe(6);
  });

  it("applies every grouped Reverse while defending a chain", () => {
    const game = setup();
    game.drawChain = { type: "DRAW_TWO", amount: 6, activeColor: "green" };
    const cards = [action("green", "reverse"), action("green", "reverse")];
    give(game, "P1", ...cards, number("red", 1));
    game.playCards("P1", cards.map((card) => card.id));
    expect(game.direction).toBe(1);
    expect(game.currentPlayer.id).toBe("P2");
  });
});

describe("playing the just-drawn card", () => {
  it("ends the turn when the drawn card is unplayable", () => {
    const game = setup();
    const drawn = number("red", 2);
    game.drawPile = [drawn];
    give(game, "P1", number("blue", 1));
    game.drawOneCard("P1");
    expect(game.pendingDrawPlay).toBeNull();
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("creates a pending choice when the drawn card is playable", () => {
    const game = setup();
    const drawn = number("green", 2);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(game.pendingDrawPlay).toEqual({
      playerId: "P1",
      cardId: drawn.id,
    });
    expect(game.currentPlayer.id).toBe("P1");
  });

  it("cannot play a different hand card while a draw choice is pending", () => {
    const game = setup();
    const oldCard = number("green", 3);
    const drawn = number("green", 2);
    give(game, "P1", oldCard);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(() => game.playCard("P1", oldCard.id)).toThrow(
      ERRORS.drawnCardRequired,
    );
  });

  it("allows only the newly drawn physical copy when an identical copy exists", () => {
    const game = setup();
    const oldCard = number("green", 2);
    const drawn = number("green", 2);
    give(game, "P1", oldCard, number("red", 1));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(() => game.playCard("P1", oldCard.id)).toThrow(
      ERRORS.drawnCardRequired,
    );
    game.playDrawnCard("P1");
    expect(game.getPlayer("P1").hand).toContain(oldCard);
    expect(game.getPlayer("P1").hand).not.toContain(drawn);
  });

  it("plays exactly the newly drawn card and clears pending state", () => {
    const game = setup();
    const drawn = number("green", 2);
    give(game, "P1", number("red", 1));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCard("P1");
    expect(game.topDiscard).toBe(drawn);
    expect(game.pendingDrawPlay).toBeNull();
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("may keep the drawn card and end the turn", () => {
    const game = setup();
    const drawn = number("green", 2);
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.keepDrawnCard("P1");
    expect(game.getPlayer("P1").hand).toContain(drawn);
    expect(game.pendingDrawPlay).toBeNull();
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("applies a drawn Skip", () => {
    const game = setup();
    const drawn = action("green", "skip");
    give(game, "P1", number("red", 1));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCard("P1");
    expect(game.currentPlayer.id).toBe("P3");
  });

  it("applies a drawn Reverse", () => {
    const game = setup();
    const drawn = action("green", "reverse");
    give(game, "P1", number("red", 1));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCard("P1");
    expect(game.direction).toBe(-1);
    expect(game.currentPlayer.id).toBe("P4");
  });

  it("starts a chain with a drawn Draw Two", () => {
    const game = setup();
    const drawn = action("green", "draw-two");
    give(game, "P1", number("red", 1));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    game.playDrawnCard("P1");
    expect(game.drawChain?.amount).toBe(2);
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("requires a color before resolving a drawn Wild", () => {
    const game = setup();
    const drawn = wild("wild");
    give(game, "P1", number("red", 1));
    game.drawPile = [drawn];
    game.drawOneCard("P1");
    expect(() => game.playDrawnCard("P1")).toThrow(
      ERRORS.chooseColor,
    );
    expect(game.pendingDrawPlay).not.toBeNull();
    game.playDrawnCard("P1", "blue");
    expect(game.activeColor).toBe("blue");
    expect(game.pendingDrawPlay).toBeNull();
  });

  it("does not offer penalty cards for immediate play", () => {
    const game = setup();
    game.drawChain = { type: "DRAW_TWO", amount: 2, activeColor: "green" };
    const playablePenaltyCard = action("green", "skip");
    game.drawPile = [number("red", 1), playablePenaltyCard];
    game.acceptDrawPenalty("P1");
    expect(game.pendingDrawPlay).toBeNull();
    expect(() => game.playDrawnCard("P1")).toThrow(
      ERRORS.noPendingDrawnPlay,
    );
  });

  it("hides the pending drawn card ID from opponents", () => {
    const game = setup();
    const drawn = number("green", 2);
    game.drawPile = [number("blue", 8), number("red", 6), drawn];
    game.drawOneCard("P1");
    expect(game.toPlayerView("ABCD", "P1", "P1").pendingDrawPlay?.cardId).toBe(
      drawn.id,
    );
    expect(game.toPlayerView("ABCD", "P1", "P2").pendingDrawPlay).toEqual({
      playerId: "P1",
      cardId: null,
    });
  });

  it("keeps the drawn-card choice while an UNO accusation is resolved", () => {
    const game = setup();
    const drawn = number("green", 2);
    give(game, "P1", number("blue", 1));
    give(game, "P2", number("red", 4));
    game.drawPile = [number("blue", 8), number("red", 6), drawn];
    game.drawOneCard("P1");
    expect(game.accuseUno("P3", "P2")).toBe(true);
    expect(game.pendingDrawPlay?.cardId).toBe(drawn.id);
    expect(() => game.drawOneCard("P1")).toThrow(
      ERRORS.resolveDrawn,
    );
  });
});
