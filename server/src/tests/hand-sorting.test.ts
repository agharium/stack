import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import {
  cardColorGroup,
  compareCardsForHand,
} from "../../../shared/cards.js";

let serial = 20_000;
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
const wild = (kind: "wild" | "wild-draw-four"): Card => ({
  id: `s-${++serial}`,
  kind,
  color: null,
});
const sort = (cards: Card[]) => [...cards].sort(compareCardsForHand);

describe("ordenação visual da mão", () => {
  it("ordena as cores em vermelho, amarelo, verde, azul e coringas", () => {
    const cards = [
      wild("wild"),
      number("blue", 1),
      number("green", 1),
      number("red", 1),
      number("yellow", 1),
    ];
    expect(sort(cards).map(cardColorGroup)).toEqual([
      "red",
      "yellow",
      "green",
      "blue",
      "wild",
    ]);
  });

  it("ordena números em ordem crescente dentro da cor", () => {
    const cards = [
      number("red", 9),
      number("red", 0),
      number("red", 5),
      number("red", 2),
    ];
    expect(
      sort(cards).map((card) => (card.kind === "number" ? card.value : -1)),
    ).toEqual([0, 2, 5, 9]);
  });

  it("mantém cartas idênticas adjacentes", () => {
    const firstFour = number("green", 4);
    const secondFour = number("green", 4);
    const sorted = sort([
      firstFour,
      number("green", 7),
      secondFour,
      number("green", 1),
    ]);
    expect(
      Math.abs(
        sorted.findIndex((card) => card.id === firstFour.id) -
          sorted.findIndex((card) => card.id === secondFour.id),
      ),
    ).toBe(1);
  });

  it("posiciona Bloquear depois do número 9", () => {
    const sorted = sort([action("red", "skip"), number("red", 9)]);
    expect(sorted.map((card) => card.kind)).toEqual(["number", "skip"]);
  });

  it("posiciona Voltar depois de Bloquear", () => {
    const sorted = sort([
      action("red", "reverse"),
      action("red", "skip"),
    ]);
    expect(sorted.map((card) => card.kind)).toEqual(["skip", "reverse"]);
  });

  it("posiciona +2 depois de Voltar", () => {
    const sorted = sort([
      action("red", "draw-two"),
      action("red", "reverse"),
    ]);
    expect(sorted.map((card) => card.kind)).toEqual([
      "reverse",
      "draw-two",
    ]);
  });

  it("posiciona coringas depois de todas as cartas coloridas", () => {
    const sorted = sort([wild("wild"), action("blue", "draw-two")]);
    expect(sorted.map((card) => card.kind)).toEqual(["draw-two", "wild"]);
  });

  it("posiciona Coringa antes de Coringa +4", () => {
    const sorted = sort([wild("wild-draw-four"), wild("wild")]);
    expect(sorted.map((card) => card.kind)).toEqual([
      "wild",
      "wild-draw-four",
    ]);
  });

  it("não modifica a ordem do array original", () => {
    const cards = [number("blue", 2), number("red", 1)];
    const originalIds = cards.map((card) => card.id);
    sort(cards);
    expect(cards.map((card) => card.id)).toEqual(originalIds);
  });

  it("preserva a identificação da carta comprada pelo ID após ordenar", () => {
    const drawn = number("red", 3);
    const sorted = sort([
      number("blue", 1),
      number("red", 8),
      drawn,
      number("yellow", 2),
    ]);
    expect(sorted.find((card) => card.id === drawn.id)).toBe(drawn);
  });
});
