import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import { createDeck } from "../game/deck.js";
import { Game, wrapIndex } from "../game/game.js";
import { ERRORS } from "../messages.js";

let serial = 0;
const number = (color: CardColor, value: number): Card => ({
  id: `t-${++serial}`,
  kind: "number",
  color,
  value,
});
const action = (
  color: CardColor,
  kind: "skip" | "reverse" | "draw-two",
): Card => ({ id: `t-${++serial}`, kind, color });
const wild = (kind: "wild" | "wild-draw-four"): Card => ({
  id: `t-${++serial}`,
  kind,
  color: null,
});

function gameFor(names = ["P1", "P2", "P3"]): Game {
  const game = new Game(
    names.map((nickname) => ({ id: nickname, nickname })),
    () => 0.42,
  );
  game.phase = "playing";
  game.matchPlayerOrder = [...names];
  game.currentPlayerIndex = 0;
  game.direction = 1;
  game.discardPile = [number("red", 5)];
  game.activeColor = "red";
  game.drawPile = Array.from({ length: 80 }, (_, index) =>
    number((["red", "blue", "green", "yellow"] as CardColor[])[index % 4]!, index % 10),
  );
  return game;
}

function give(game: Game, playerId: string, ...cards: Card[]): Card[] {
  game.getPlayer(playerId).hand = cards;
  return cards;
}

describe("deck and setup", () => {
  it("creates the conventional 108 unique-card deck", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((card) => card.id)).size).toBe(108);
  });

  it("deals seven cards to every player and starts on a number", () => {
    const game = new Game(
      [
        { id: "a", nickname: "A" },
        { id: "b", nickname: "B" },
        { id: "c", nickname: "C" },
      ],
      () => 0,
    );
    game.start();
    expect(game.players.map((player) => player.hand.length)).toEqual([7, 7, 7]);
    expect(game.topDiscard?.kind).toBe("number");
    expect(game.matchPlayerOrder).toHaveLength(3);
    expect(new Set(game.matchPlayerOrder).size).toBe(3);
    expect(game.currentPlayer.id).toBe(game.matchPlayerOrder[0]);
  });

  it("wraps turn indices in both directions", () => {
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(6, 5)).toBe(1);
  });
});

describe("normal play", () => {
  it("accepts a color match", () => {
    const game = gameFor();
    expect(game.canPlayCard(number("red", 8)).valid).toBe(true);
  });

  it("accepts a number value match", () => {
    const game = gameFor();
    expect(game.canPlayCard(number("blue", 5)).valid).toBe(true);
  });

  it("accepts an action face match across colors", () => {
    const game = gameFor();
    game.discardPile = [action("red", "skip")];
    expect(game.canPlayCard(action("green", "skip")).valid).toBe(true);
  });

  it("rejects an unrelated card", () => {
    const game = gameFor();
    expect(game.canPlayCard(number("blue", 7))).toEqual({
      valid: false,
      error: ERRORS.cardNotPlayable,
    });
  });

  it("skip bypasses the next player", () => {
    const game = gameFor();
    const card = action("red", "skip");
    give(game, "P1", card, number("blue", 1));
    game.playCard("P1", card.id);
    expect(game.currentPlayer.id).toBe("P3");
  });

  it("reverse changes direction with three players", () => {
    const game = gameFor();
    const card = action("red", "reverse");
    give(game, "P1", card, number("blue", 1));
    game.playCard("P1", card.id);
    expect(game.direction).toBe(-1);
    expect(game.currentPlayer.id).toBe("P3");
  });

  it("reverse behaves as a skip with two players", () => {
    const game = gameFor(["P1", "P2"]);
    const card = action("red", "reverse");
    give(game, "P1", card, number("blue", 1));
    game.playCard("P1", card.id);
    expect(game.direction).toBe(-1);
    expect(game.currentPlayer.id).toBe("P1");
  });

  it("normal draw gives one card and ends the turn", () => {
    const game = gameFor();
    give(game, "P1", number("blue", 2));
    game.drawOneCard("P1");
    expect(game.getPlayer("P1").hand).toHaveLength(2);
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("rejects actions from a player who does not own the turn", () => {
    const game = gameFor();
    const card = number("red", 2);
    give(game, "P2", card);
    expect(() => game.playCard("P2", card.id)).toThrow(ERRORS.notYourTurn);
  });

  it("wild sets the chosen active color", () => {
    const game = gameFor();
    const card = wild("wild");
    give(game, "P1", card, number("blue", 2));
    game.playCard("P1", card.id, "green");
    expect(game.activeColor).toBe("green");
  });
});

describe("draw chains", () => {
  it("Draw Two starts a +2 chain", () => {
    const game = gameFor();
    const card = action("red", "draw-two");
    give(game, "P1", card, number("blue", 1));
    game.playCard("P1", card.id);
    expect(game.drawChain).toEqual({
      type: "DRAW_TWO",
      amount: 2,
      activeColor: "red",
    });
    expect(game.currentPlayer.id).toBe("P2");
  });

  it("stacks Draw Two regardless of color", () => {
    const game = gameFor();
    const red = action("red", "draw-two");
    const yellow = action("yellow", "draw-two");
    give(game, "P1", red, number("blue", 1));
    give(game, "P2", yellow, number("blue", 2));
    game.playCard("P1", red.id);
    game.playCard("P2", yellow.id);
    expect(game.drawChain?.amount).toBe(4);
    expect(game.drawChain?.activeColor).toBe("yellow");
  });

  it("Draw Two chain rejects Draw Four", () => {
    const game = gameFor();
    game.drawChain = { type: "DRAW_TWO", amount: 2, activeColor: "red" };
    expect(game.canPlayCard(wild("wild-draw-four"))).toEqual({
      valid: false,
      error: ERRORS.onlyDrawTwo,
    });
  });

  it("Draw Four chain rejects Draw Two", () => {
    const game = gameFor();
    game.drawChain = { type: "DRAW_FOUR", amount: 4, activeColor: "blue" };
    expect(game.canPlayCard(action("blue", "draw-two"))).toEqual({
      valid: false,
      error: ERRORS.onlyDrawFour,
    });
  });

  it("stacks Draw Four and applies its chosen color", () => {
    const game = gameFor();
    const first = wild("wild-draw-four");
    const second = wild("wild-draw-four");
    give(game, "P1", first, number("red", 2));
    give(game, "P2", second, number("red", 3));
    game.playCard("P1", first.id, "yellow");
    game.playCard("P2", second.id, "blue");
    expect(game.drawChain).toEqual({
      type: "DRAW_FOUR",
      amount: 8,
      activeColor: "blue",
    });
  });

  it("allows only matching-color Skip during a chain", () => {
    const game = gameFor();
    game.drawChain = { type: "DRAW_TWO", amount: 4, activeColor: "yellow" };
    expect(game.canPlayCard(action("yellow", "skip")).valid).toBe(true);
    expect(game.canPlayCard(action("red", "skip")).valid).toBe(false);
  });

  it("allows only matching-color Reverse during a chain", () => {
    const game = gameFor();
    game.drawChain = { type: "DRAW_FOUR", amount: 8, activeColor: "blue" };
    expect(game.canPlayCard(action("blue", "reverse")).valid).toBe(true);
    expect(game.canPlayCard(action("green", "reverse")).valid).toBe(false);
  });

  it("chain Reverse changes direction and sends the threat backward", () => {
    const game = gameFor(["P1", "P2", "P3", "P4"]);
    game.currentPlayerIndex = 2;
    game.drawChain = { type: "DRAW_TWO", amount: 6, activeColor: "blue" };
    const reverse = action("blue", "reverse");
    give(game, "P3", reverse, number("red", 1));
    game.playCard("P3", reverse.id);
    expect(game.direction).toBe(-1);
    expect(game.currentPlayer.id).toBe("P2");
    expect(game.drawChain?.amount).toBe(6);
  });

  it("accepting a chain draws the exact amount, clears it, and advances", () => {
    const game = gameFor();
    game.currentPlayerIndex = 1;
    game.drawChain = { type: "DRAW_TWO", amount: 8, activeColor: "red" };
    give(game, "P2", number("blue", 1));
    game.acceptDrawPenalty("P2");
    expect(game.getPlayer("P2").hand).toHaveLength(9);
    expect(game.drawChain).toBeNull();
    expect(game.currentPlayer.id).toBe("P3");
  });

  it("recycles all discards except the current top", () => {
    const game = gameFor(["P1", "P2"]);
    const bottom = number("blue", 1);
    const middle = number("green", 2);
    const top = number("red", 3);
    game.drawPile = [];
    game.discardPile = [bottom, middle, top];
    give(game, "P1", number("yellow", 4));
    game.drawOneCard("P1");
    expect(game.topDiscard).toBe(top);
    expect(game.getPlayer("P1").hand).toHaveLength(2);
    expect(game.drawPile).toHaveLength(1);
  });
});

describe("winning and UNO", () => {
  it.each(["wild", "wild-draw-four"] as const)(
    "does not allow %s as a final card",
    (kind) => {
      const game = gameFor();
      const card = wild(kind);
      give(game, "P1", card);
      expect(() => game.playCard("P1", card.id, "blue")).toThrow(
        ERRORS.wildFinish,
      );
    },
  );

  it.each([
    ["number", number("red", 9)],
    ["skip", action("red", "skip")],
    ["reverse", action("red", "reverse")],
    ["draw two", action("red", "draw-two")],
  ])("allows a colored %s card to win immediately", (_name, card) => {
    const game = gameFor();
    give(game, "P1", card as Card);
    game.playCard("P1", (card as Card).id);
    expect(game.phase).toBe("finished");
    expect(game.winnerId).toBe("P1");
    expect(game.events.at(-1)?.text).toBe("P1 venceu a partida!");
  });

  it("supports declaring and accusing UNO", () => {
    const game = gameFor();
    const playable = number("red", 7);
    give(game, "P1", playable, number("blue", 4));
    game.playCard("P1", playable.id);
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
    game.accuseUno("P2", "P1");
    expect(game.getPlayer("P1").hand).toHaveLength(3);
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
  });

  it("clears a pending UNO state when that player draws", () => {
    const game = gameFor();
    give(game, "P1", number("blue", 4));
    game.getPlayer("P1").unoDeclared = true;
    game.drawOneCard("P1");
    expect(game.getPlayer("P1").unoDeclared).toBe(false);
  });

  it("announces a successful UNO declaration", () => {
    const game = gameFor();
    give(game, "P1", number("blue", 4));
    game.getPlayer("P1").unoDeclared = false;
    game.declareUno("P1");
    expect(game.getPlayer("P1").unoDeclared).toBe(true);
    expect(game.events.at(-1)?.text).toBe("P1 gritou UNO!");
  });
});

describe("required five-player chain scenario", () => {
  it("routes the complete +8 sequence and makes P3 draw exactly eight", () => {
    const game = gameFor(["P1", "P2", "P3", "P4", "P5"]);
    const p1Red2 = action("red", "draw-two");
    const p2Yellow2 = action("yellow", "draw-two");
    const p3YellowSkip = action("yellow", "skip");
    const p3Red2 = action("red", "draw-two");
    const p4Blue2 = action("blue", "draw-two");
    // The written example says Red Skip here, but the active chain color after
    // Blue Reverse is blue. The required matching-color rule makes this Blue.
    const p4BlueSkip = action("blue", "skip");
    const p5BlueReverse = action("blue", "reverse");
    const p2RedReverse = action("red", "reverse");
    give(game, "P1", p1Red2, number("green", 1));
    give(game, "P2", p2Yellow2, p2RedReverse, number("green", 2));
    give(game, "P3", p3YellowSkip, p3Red2, number("green", 3));
    give(game, "P4", p4Blue2, p4BlueSkip, number("green", 4));
    give(game, "P5", p5BlueReverse, number("green", 5));

    game.playCard("P1", p1Red2.id);
    game.playCard("P2", p2Yellow2.id);
    game.playCard("P3", p3YellowSkip.id);
    game.playCard("P4", p4Blue2.id);
    game.playCard("P5", p5BlueReverse.id);
    game.playCard("P4", p4BlueSkip.id);
    game.playCard("P3", p3Red2.id);
    game.playCard("P2", p2RedReverse.id);

    expect(game.currentPlayer.id).toBe("P3");
    expect(game.drawChain?.amount).toBe(8);
    const before = game.getPlayer("P3").hand.length;
    game.acceptDrawPenalty("P3");
    expect(game.getPlayer("P3").hand.length).toBe(before + 8);
    expect(game.drawChain).toBeNull();
    expect(game.currentPlayer.id).toBe("P4");
  });
});

describe("restart and private views", () => {
  it("restart creates a fresh playable game", () => {
    const game = gameFor();
    game.phase = "finished";
    game.winnerId = "P2";
    game.drawChain = { type: "DRAW_TWO", amount: 12, activeColor: "green" };
    game.restart();
    expect(game.phase).toBe("playing");
    expect(game.winnerId).toBeNull();
    expect(game.drawChain).toBeNull();
    expect(game.direction).toBe(1);
    expect(game.players.every((player) => player.hand.length === 7)).toBe(true);
  });

  it("never serializes an opponent's hand contents", () => {
    const game = gameFor();
    const own = number("red", 1);
    const secret = { ...number("blue", 9), id: "OPPONENT-SECRET-CARD" };
    give(game, "P1", own);
    give(game, "P2", secret);
    const view = game.toPlayerView("ABCD", "P1", "P1");
    expect(view.hand).toEqual([own]);
    expect(view.players.find((player) => player.id === "P2")?.cardCount).toBe(1);
    expect(JSON.stringify(view)).not.toContain("OPPONENT-SECRET-CARD");
  });
});
