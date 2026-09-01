import type { Card, CardColor } from "./types.js";
import {
  cardColorGroup,
  cardColorGroupLabelPtBr,
  compareCardsForHand,
} from "./cards.js";

export type HandColorGroup = CardColor | "wild";

export type CardStackView = {
  key: string;
  group: HandColorGroup;
  card: Card;
  cards: Card[];
  count: number;
};

export type HandGroupView = {
  key: HandColorGroup;
  label: string;
  stacks: CardStackView[];
  physicalCount: number;
};

const GROUP_ORDER: HandColorGroup[] = [
  "red",
  "yellow",
  "green",
  "blue",
  "wild",
];

export function cardGameplayKey(card: Card): string {
  if (card.kind === "number") {
    return `${card.color}:number:${card.value}`;
  }
  if (card.color === null) return `wild:${card.kind}`;
  return `${card.color}:${card.kind}`;
}

export function groupHandIntoStacks(hand: readonly Card[]): CardStackView[] {
  const sortedCards = [...hand].sort(compareCardsForHand);
  const byIdentity = new Map<string, Card[]>();
  for (const card of sortedCards) {
    const key = cardGameplayKey(card);
    const cards = byIdentity.get(key);
    if (cards) cards.push(card);
    else byIdentity.set(key, [card]);
  }

  return [...byIdentity.entries()].map(([key, cards]) => ({
    key,
    group: cardColorGroup(cards[0]!),
    card: cards[0]!,
    cards,
    count: cards.length,
  }));
}

export function groupStacksByColor(
  stacks: readonly CardStackView[],
): HandGroupView[] {
  return GROUP_ORDER.flatMap((key) => {
    const groupStacks = stacks.filter((stack) => stack.group === key);
    if (groupStacks.length === 0) return [];
    return [
      {
        key,
        label: cardColorGroupLabelPtBr(groupStacks[0]!.card),
        stacks: groupStacks,
        physicalCount: groupStacks.reduce(
          (total, stack) => total + stack.count,
          0,
        ),
      },
    ];
  });
}

export function getLegalStackQuantities(
  stack: CardStackView,
  handSize: number,
  pendingDrawCardId?: string | null,
): number[] {
  if (pendingDrawCardId) {
    if (!stack.cards.some((card) => card.id === pendingDrawCardId)) return [];
  }
  const wouldFinishWithWild =
    stack.card.color === null && stack.count === handSize;
  const maximum = wouldFinishWithWild ? stack.count - 1 : stack.count;
  return Array.from({ length: Math.max(0, maximum) }, (_, index) => index + 1);
}

export function selectPhysicalCards(
  stack: CardStackView,
  quantity: number,
  pendingDrawCardId?: string | null,
): Card[] {
  if (pendingDrawCardId) {
    const drawnCard = stack.cards.find(
      (card) => card.id === pendingDrawCardId,
    );
    if (!drawnCard) {
      throw new Error("A carta recém-comprada não pertence a esta pilha.");
    }
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > stack.cards.length
    ) {
      throw new Error("Quantidade de cartas inválida.");
    }
    return [
      drawnCard,
      ...stack.cards
        .filter((card) => card.id !== pendingDrawCardId)
        .slice(0, quantity - 1),
    ];
  }
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > stack.cards.length
  ) {
    throw new Error("Quantidade de cartas inválida.");
  }
  return stack.cards.slice(0, quantity);
}

export function selectLegalPhysicalCards(
  stack: CardStackView,
  quantity: number,
  handSize: number,
  pendingDrawCardId?: string | null,
): Card[] {
  if (
    !getLegalStackQuantities(
      stack,
      handSize,
      pendingDrawCardId,
    ).includes(quantity)
  ) {
    throw new Error("Essa quantidade de cartas não pode ser jogada agora.");
  }
  return selectPhysicalCards(stack, quantity, pendingDrawCardId);
}
