import type { PublicPlayer } from "../../../shared/types";

type Props = {
  players: PublicPlayer[];
  selfId: string;
  onAccuseUno: (playerId: string) => void;
};

export function PlayerBoard({ players, selfId, onAccuseUno }: Props) {
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
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong
                  className={
                    player.cardCount === 1
                      ? "text-base text-amber-300"
                      : "text-sm text-white/85"
                  }
                >
                  {player.cardCount}{" "}
                  {player.cardCount === 1 ? "carta" : "cartas"}
                </strong>
                {player.isCurrentTurn && (
                  <span className="text-[10px] font-black uppercase text-lime-200">
                    {isSelf ? "Sua vez" : "Jogando agora"}
                  </span>
                )}
                {!player.connected && (
                  <span className="text-[10px] font-bold text-rose-300">
                    Desconectado
                  </span>
                )}
              </div>
              {!isSelf && player.canBeAccusedForUno && (
                <button
                  type="button"
                  onClick={() => onAccuseUno(player.id)}
                  className="mt-2 min-h-9 rounded-full bg-amber-400 px-3 text-[11px] font-black text-slate-950"
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
