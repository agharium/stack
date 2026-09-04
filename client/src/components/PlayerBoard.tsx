import type { PublicPlayer } from "../../../shared/types";

type Props = {
  players: PublicPlayer[];
  selfId: string;
  canRename?: boolean;
  onAccuseUno: (playerId: string) => void;
  onRenamePlayer?: (playerId: string, currentName: string) => void;
};

function formatCardCount(player: PublicPlayer, isSelf: boolean): string {
  if (player.cardCount !== null) {
    return `${player.cardCount} ${player.cardCount === 1 ? "carta" : "cartas"}`;
  }
  if (isSelf) {
    return "";
  }
  return "? cartas";
}

export function PlayerBoard({
  players,
  selfId,
  canRename = false,
  onAccuseUno,
  onRenamePlayer,
}: Props) {
  return (
    <section
      aria-labelledby="player-board-title"
      className="rounded-2xl border border-white/10 bg-black/15 p-3"
    >
      <h2
        id="player-board-title"
        className="mb-2 text-xs font-black uppercase tracking-widest text-white/55"
      >
        Jogadores
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {players.map((player) => {
          const isSelf = player.id === selfId;
          const cardLabel = formatCardCount(player, isSelf);
          const showAccuse = player.canAccuseUno === true;
          return (
            <article
              key={player.id}
              className={[
                "min-w-0 rounded-xl border px-3 py-2",
                player.isCurrentTurn
                  ? "border-lime-300 bg-lime-300/15 shadow-md shadow-lime-950/25"
                  : "border-white/10 bg-white/[.04]",
              ].join(" ")}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-black">
                  {player.nickname}
                </span>
                {canRename && !isSelf && onRenamePlayer && (
                  <button
                    type="button"
                    onClick={() => onRenamePlayer(player.id, player.nickname)}
                    title={`Renomear ${player.nickname}`}
                    aria-label={`Renomear ${player.nickname}`}
                    className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-indigo-200 hover:bg-white/10 hover:text-white"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-3.5 w-3.5 fill-none stroke-current"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3.5 14.5 5 16l9.5-9.5L13 5 3.5 14.5Z" />
                      <path d="m12.2 5.8 2 2" />
                      <path d="M3 17h4" />
                    </svg>
                  </button>
                )}
                {isSelf && (
                  <span className="shrink-0 text-[10px] font-black text-cyan-200">
                    VOCÊ
                  </span>
                )}
                {player.isHost && (
                  <span
                    title="Anfitrião"
                    aria-label="Anfitrião"
                    className="ml-auto shrink-0 text-xs"
                  >
                    ★
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {player.isPreviousTurn && (
                  <span className="rounded-full bg-slate-400/20 px-2 py-0.5 text-[10px] font-black uppercase text-slate-200">
                    Anterior
                  </span>
                )}
                {player.isCurrentTurn && (
                  <span className="rounded-full bg-lime-300/25 px-2 py-0.5 text-[10px] font-black uppercase text-lime-200">
                    Atual
                  </span>
                )}
                {player.isNextTurn && (
                  <span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-200">
                    Próximo
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {cardLabel && (
                  <strong
                    className={
                      player.isAtUnoCount && player.cardCount === 1
                        ? "text-base text-amber-300"
                        : "text-sm text-white/85"
                    }
                  >
                    {cardLabel}
                  </strong>
                )}
                {!player.connected && (
                  <span className="text-[10px] font-bold text-rose-300">
                    Desconectado
                  </span>
                )}
              </div>
              {showAccuse && (
                <button
                  type="button"
                  onClick={() => onAccuseUno(player.id)}
                  title="Acusar de não ter falado UNO"
                  aria-label={`Acusar ${player.nickname} de não ter falado UNO`}
                  className="mt-2 min-h-9 cursor-pointer rounded-full bg-amber-400 px-3 text-[11px] font-black text-slate-950"
                >
                  Não falou UNO!
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
