import type { PublicGameResult } from "../../../shared/types";

type Props = {
  result: PublicGameResult;
  isHost: boolean;
  isGuest: boolean;
  busy: boolean;
  onRestart: () => void;
};

const placementIcon = (position: number): string | null => {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return null;
};

export function FinalResults({
  result,
  isHost,
  isGuest,
  busy,
  onRestart,
}: Props) {
  const winner = result.standings.find(
    (standing) => standing.playerId === result.winnerId,
  );

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#100d28]/95 p-4 backdrop-blur-md">
      <div className="mx-auto grid min-h-full max-w-xl place-items-center py-4">
        <section
          aria-labelledby="final-result-title"
          className="winner-card w-full rounded-[2rem] border border-white/20 p-6 text-center shadow-2xl sm:p-9"
        >
          <div aria-hidden="true" className="text-6xl">
            🏆
          </div>
          <p className="mt-3 text-sm font-black uppercase tracking-[.25em] text-amber-200">
            Fim da partida
          </p>
          <h2 id="final-result-title" className="mt-2 text-4xl font-black sm:text-5xl">
            {winner?.nickname} venceu!
          </h2>
          <p className="mt-2 font-semibold text-indigo-100">
            {winner?.nickname} ficou sem cartas primeiro!
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-3 text-left sm:p-4">
            <h3 className="mb-3 text-center text-sm font-black uppercase tracking-widest text-white/60">
              Resultado final
            </h3>
            <ol className="space-y-2">
              {result.standings.map((standing) => {
                const medal = placementIcon(standing.position);
                return (
                  <li
                    key={standing.playerId}
                    className={[
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                      standing.position === 1
                        ? "border-amber-300/45 bg-amber-300/15"
                        : "border-white/10 bg-white/[.04]",
                    ].join(" ")}
                  >
                    <span
                      aria-label={`${standing.position}º lugar`}
                      className="w-10 shrink-0 text-center text-lg font-black"
                    >
                      {medal ?? `${standing.position}º`}
                    </span>
                    <strong className="min-w-0 flex-1 truncate">
                      {standing.nickname}
                    </strong>
                    <span className="shrink-0 text-sm font-bold text-white/65">
                      {standing.cardsRemaining}{" "}
                      {standing.cardsRemaining === 1 ? "carta" : "cartas"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {isGuest && (
            <p className="mt-5 text-sm font-semibold text-indigo-200">
              Crie uma conta para participar do ranking nas próximas partidas.
            </p>
          )}

          {isHost ? (
            <button
              type="button"
              onClick={onRestart}
              disabled={busy}
              className="primary-button mt-7 w-full"
            >
              Jogar novamente
            </button>
          ) : (
            <p className="mt-7 font-bold text-indigo-100">
              Aguardando o anfitrião iniciar uma nova partida...
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
