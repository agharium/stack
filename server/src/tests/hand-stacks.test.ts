import { describe, expect, it } from "vitest";
import type { Card, CardColor } from "../../../shared/types.js";
import {
  getLegalStackQuantities,
  groupHandIntoStacks,
  groupStacksByColor,
  selectLegalPhysicalCards,
  selectPhysicalCards,
} from "../../../shared/hand-stacks.js";

let serial = 30_000;
const number = (color: CardColor, value: number): Card => ({
  id: `p-${++serial}`,
  kind: "number",
  color,
  value,
});
const action = (
  color: CardColor,
  kind: "skip" | "reverse" | "draw-two",
): Card => ({ id: `p-${++serial}`, kind, color });
const wild = (kind: "wild" | "wild-draw-four"): Card => ({
  id: `p-${++serial}`,
  kind,
  color: null,
});

describe("pilhas visuais da mão", () => {
  it("agrupa três cartas idênticas em uma pilha", () => {
    const hand = [
      number("green", 4),
      number("green", 4),
      number("green", 4),
    ];
    const stacks = groupHandIntoStacks(hand);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]?.count).toBe(3);
  });

  it("mantém cores diferentes em pilhas separadas", () => {
    const stacks = groupHandIntoStacks([
      number("red", 4),
      number("blue", 4),
    ]);
    expect(stacks).toHaveLength(2);
  });

  it("mantém valores diferentes em pilhas separadas", () => {
    const stacks = groupHandIntoStacks([
      number("red", 4),
      number("red", 5),
    ]);
    expect(stacks).toHaveLength(2);
  });

  it("não agrupa Bloquear com Voltar", () => {
    const stacks = groupHandIntoStacks([
      action("blue", "skip"),
      action("blue", "reverse"),
    ]);
    expect(stacks).toHaveLength(2);
  });

  it("não agrupa Coringa com Coringa +4", () => {
    const stacks = groupHandIntoStacks([
      wild("wild"),
      wild("wild-draw-four"),
    ]);
    expect(stacks).toHaveLength(2);
  });

  it("preserva todos os IDs físicos originais", () => {
    const hand = [
      number("yellow", 3),
      number("yellow", 3),
      number("yellow", 3),
    ];
    const ids = groupHandIntoStacks(hand)[0]!.cards.map((card) => card.id);
    expect(ids).toEqual(hand.map((card) => card.id));
    expect(new Set(ids).size).toBe(3);
  });

  it("não modifica o array ou a ordem da mão original", () => {
    const hand = [number("blue", 8), number("red", 1)];
    const original = [...hand];
    groupHandIntoStacks(hand);
    expect(hand).toEqual(original);
  });

  it("mantém os grupos na ordem obrigatória", () => {
    const groups = groupStacksByColor(
      groupHandIntoStacks([
        wild("wild"),
        number("blue", 1),
        number("green", 1),
        number("yellow", 1),
        number("red", 1),
      ]),
    );
    expect(groups.map((group) => group.key)).toEqual([
      "red",
      "yellow",
      "green",
      "blue",
      "wild",
    ]);
  });

  it("ordena pilhas dentro da cor por valor e ação", () => {
    const stacks = groupHandIntoStacks([
      action("red", "draw-two"),
      number("red", 9),
      action("red", "reverse"),
      number("red", 0),
      action("red", "skip"),
    ]);
    expect(stacks.map((stack) => stack.card.kind)).toEqual([
      "number",
      "number",
      "skip",
      "reverse",
      "draw-two",
    ]);
  });

  it("calcula o cabeçalho pelo total de cartas físicas", () => {
    const groups = groupStacksByColor(
      groupHandIntoStacks([
        number("green", 4),
        number("green", 4),
        number("green", 7),
        number("green", 7),
        number("green", 7),
      ]),
    );
    expect(groups[0]?.physicalCount).toBe(5);
    expect(groups[0]?.stacks).toHaveLength(2);
  });

  it("encontra a carta comprada pelo ID dentro da pilha", () => {
    const oldCard = number("green", 4);
    const drawnCard = number("green", 4);
    const stack = groupHandIntoStacks([oldCard, drawnCard])[0]!;
    expect(stack.cards.some((card) => card.id === drawnCard.id)).toBe(true);
  });

  it("seleciona somente a carta física recém-comprada", () => {
    const oldCard = number("green", 4);
    const drawnCard = number("green", 4);
    const stack = groupHandIntoStacks([oldCard, drawnCard])[0]!;
    expect(selectPhysicalCards(stack, 1, drawnCard.id)).toEqual([drawnCard]);
    expect(selectPhysicalCards(stack, 2, drawnCard.id)).toEqual([
      drawnCard,
      oldCard,
    ]);
  });

  it("resolve uma jogada múltipla em IDs físicos únicos", () => {
    const stack = groupHandIntoStacks([
      number("red", 2),
      number("red", 2),
      number("red", 2),
    ])[0]!;
    const selected = selectPhysicalCards(stack, 2);
    expect(selected).toHaveLength(2);
    expect(new Set(selected.map((card) => card.id)).size).toBe(2);
  });

  it("rejeita quantidades inexistentes", () => {
    const stack = groupHandIntoStacks([number("red", 2)])[0]!;
    expect(() => selectPhysicalCards(stack, 0)).toThrow();
    expect(() => selectPhysicalCards(stack, 2)).toThrow();
  });

  it("não oferece esvaziar a mão com uma pilha de coringas", () => {
    const stack = groupHandIntoStacks([
      wild("wild"),
      wild("wild"),
      wild("wild"),
    ])[0]!;
    expect(getLegalStackQuantities(stack, 3)).toEqual([1, 2]);
    expect(() => selectLegalPhysicalCards(stack, 3, 3)).toThrow();
  });

  it("compacta 40 cartas sem perder nenhum ID físico", () => {
    const hand = Array.from({ length: 40 }, (_, index) =>
      number(
        (["red", "yellow", "green", "blue"] as CardColor[])[index % 4]!,
        index % 2,
      ),
    );
    const stacks = groupHandIntoStacks(hand);
    const allIds = stacks.flatMap((stack) =>
      stack.cards.map((card) => card.id),
    );
    expect(stacks).toHaveLength(4);
    expect(allIds).toHaveLength(40);
    expect(new Set(allIds)).toEqual(new Set(hand.map((card) => card.id)));
  });
});
