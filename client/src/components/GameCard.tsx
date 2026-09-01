import type { Card } from "../../../shared/types";
import { cardDescriptionPtBr } from "../../../shared/cards";

const symbols = {
  skip: "⊘",
  reverse: "↔",
  "draw-two": "+2",
  wild: "◆",
  "wild-draw-four": "+4",
} as const;

export function cardText(card: Card): string {
  return card.kind === "number" ? String(card.value) : symbols[card.kind];
}

type Props = {
  card: Card;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
  ariaLabel?: string;
};

export function GameCard({
  card,
  disabled,
  onClick,
  compact,
  ariaLabel,
}: Props) {
  const wild = card.color === null;
  const label = cardDescriptionPtBr(card);

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      disabled={disabled || !onClick}
      onClick={onClick}
      className={[
        "game-card relative shrink-0 overflow-hidden rounded-2xl border-[5px] border-white text-white shadow-xl",
        compact ? "h-28 w-20 sm:h-36 sm:w-24" : "h-40 w-28 sm:h-48 sm:w-32",
        wild ? "wild-card" : `card-${card.color}`,
        onClick && !disabled
          ? "cursor-pointer hover:-translate-y-3 hover:rotate-1 hover:shadow-2xl active:-translate-y-1"
          : "",
        onClick && disabled ? "cursor-not-allowed" : "",
        !onClick ? "cursor-default disabled:cursor-default" : "",
        disabled ? "opacity-35 grayscale-[35%]" : "",
      ].join(" ")}
    >
      <span className="absolute left-2 top-1 text-lg font-black">
        {cardText(card)}
      </span>
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-20 w-16 -rotate-12 place-items-center rounded-[50%] bg-white/90 text-3xl font-black text-slate-900 shadow-inner sm:h-24 sm:w-20 sm:text-4xl">
          {cardText(card)}
        </span>
      </span>
      <span className="absolute bottom-1 right-2 rotate-180 text-lg font-black">
        {cardText(card)}
      </span>
    </button>
  );
}
