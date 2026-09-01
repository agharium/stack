import type { Card, CardColor } from "../../../shared/types.js";

const COLORS: CardColor[] = ["red", "yellow", "green", "blue"];

export function createDeck(): Card[] {
  let serial = 0;
  const id = () => `card-${++serial}`;
  const deck: Card[] = [];

  for (const color of COLORS) {
    deck.push({ id: id(), kind: "number", color, value: 0 });
    for (let copy = 0; copy < 2; copy += 1) {
      for (let value = 1; value <= 9; value += 1) {
        deck.push({ id: id(), kind: "number", color, value });
      }
      deck.push(
        { id: id(), kind: "skip", color },
        { id: id(), kind: "reverse", color },
        { id: id(), kind: "draw-two", color },
      );
    }
  }

  for (let copy = 0; copy < 4; copy += 1) {
    deck.push(
      { id: id(), kind: "wild", color: null },
      { id: id(), kind: "wild-draw-four", color: null },
    );
  }
  return deck;
}

export function shuffle<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
