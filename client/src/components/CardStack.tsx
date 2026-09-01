import { cardDescriptionPtBr } from "../../../shared/cards";
import type { CardStackView } from "../../../shared/hand-stacks";
import { GameCard } from "./GameCard";

type Props = {
  stack: CardStackView;
  playable: boolean;
  selected: boolean;
  containsDrawnCard: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function accessibleCardName(stack: CardStackView): string {
  return cardDescriptionPtBr(stack.card)
    .toLocaleLowerCase("pt-BR")
    .replace("+4", "mais quatro")
    .replace("+2", "mais dois");
}

export function CardStack({
  stack,
  playable,
  selected,
  containsDrawnCard,
  disabled,
  onClick,
}: Props) {
  const countLabel =
    stack.count === 1 ? "1 carta" : `${stack.count} cartas iguais`;
  const ariaLabel = `${accessibleCardName(stack)}, ${countLabel}${
    playable ? ", jogável" : ", não jogável"
  }${containsDrawnCard ? ", contém a carta comprada" : ""}`;

  return (
    <div
      className={[
        "relative h-28 w-20 shrink-0 sm:h-36 sm:w-24",
        selected ? "rounded-2xl ring-4 ring-lime-300 ring-offset-2 ring-offset-transparent" : "",
      ].join(" ")}
    >
      {stack.count > 1 && (
        <>
          <span className="pointer-events-none absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl border-2 border-white/45 bg-slate-900/50" />
          <span className="pointer-events-none absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-2xl border border-white/35" />
        </>
      )}
      <GameCard
        card={stack.card}
        compact
        disabled={disabled || !playable}
        onClick={onClick}
        ariaLabel={ariaLabel}
      />
      {stack.count > 1 && (
        <span className="pointer-events-none absolute -right-2 -top-2 z-20 grid h-8 min-w-8 place-items-center rounded-full border-2 border-white bg-lime-300 px-1 text-sm font-black text-lime-950 shadow-md">
          ×{stack.count}
        </span>
      )}
      {containsDrawnCard && (
        <span className="pointer-events-none absolute -bottom-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-lime-300 px-2 py-1 text-[10px] font-black uppercase text-lime-950 shadow-md">
          Comprada
        </span>
      )}
    </div>
  );
}
