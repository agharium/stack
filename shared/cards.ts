import type { Card, CardColor } from "./types.js";

export const COLOR_LABELS_PT_BR: Record<CardColor, string> = {
  red: "Vermelho",
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
};

const COLOR_ORDER: Record<CardColor, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
};

const ACTION_ORDER: Record<"skip" | "reverse" | "draw-two", number> = {
  skip: 10,
  reverse: 11,
  "draw-two": 12,
};

export function compareCardsForHand(a: Card, b: Card): number {
  const aColorOrder = a.color === null ? 4 : COLOR_ORDER[a.color];
  const bColorOrder = b.color === null ? 4 : COLOR_ORDER[b.color];
  if (aColorOrder !== bColorOrder) return aColorOrder - bColorOrder;

  const rank = (card: Card): number => {
    if (card.kind === "number") return card.value;
    if (
      card.kind === "skip" ||
      card.kind === "reverse" ||
      card.kind === "draw-two"
    ) {
      return ACTION_ORDER[card.kind];
    }
    return card.kind === "wild" ? 13 : 14;
  };
  return rank(a) - rank(b);
}

export function cardColorGroup(card: Card): CardColor | "wild" {
  return card.color ?? "wild";
}

export function cardColorGroupLabelPtBr(card: Card): string {
  return card.color ? COLOR_LABELS_PT_BR[card.color] : "Coringas";
}

export function cardNamePtBr(card: Card): string {
  if (card.kind === "wild") return "Coringa";
  if (card.kind === "wild-draw-four") return "Coringa +4";
  if (card.kind === "number") return String(card.value);
  if (card.kind === "skip") return "Bloquear";
  if (card.kind === "reverse") return "Voltar";
  return "+2";
}

export function cardDescriptionPtBr(card: Card): string {
  if (card.color === null) return cardNamePtBr(card);
  return `${cardNamePtBr(card)} ${COLOR_LABELS_PT_BR[card.color].toLocaleLowerCase("pt-BR")}`;
}
