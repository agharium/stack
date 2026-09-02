import { useEffect, useState } from "react";
import { api, type RankingEntry } from "../api";

type Props = {
  onBack: () => void;
};

function winsLabel(wins: number): string {
  return `${wins} ${wins === 1 ? "vitória" : "vitórias"}`;
}

function gamesLabel(gamesPlayed: number): string {
  return `${gamesPlayed} ${gamesPlayed === 1 ? "partida" : "partidas"}`;
}

export function RankingPage({ onBack }: Props) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api
      .getRanking()
      .then((result) => {
        setRanking(result.ranking);
        if (result.error) setError(result.error);
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar o ranking.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="home-shell min-h-dvh px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold text-indigo-200 hover:text-white"
        >
          ← Voltar
        </button>
        <h1 className="mt-6 text-4xl font-black">🏆 Ranking geral</h1>

        {loading && (
          <p className="mt-8 font-bold text-indigo-200">Carregando ranking…</p>
        )}
        {error && !loading && (
          <p role="alert" className="mt-8 font-bold text-amber-200">
            {error}
          </p>
        )}
        {!loading && ranking.length === 0 && !error && (
          <p className="mt-8 font-bold text-indigo-200">
            Ainda não há resultados no ranking.
          </p>
        )}

        <ol className="mt-8 space-y-4">
          {ranking.map((entry, index) => (
            <li
              key={entry.userId}
              className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl"
            >
              <strong className="text-xl font-black">
                {index + 1}. {entry.name}
              </strong>
              <p className="mt-2 text-sm font-bold text-indigo-100">
                {winsLabel(entry.wins)} · {gamesLabel(entry.gamesPlayed)}
              </p>
              <p className="mt-1 text-sm text-indigo-200">
                {Math.round(entry.winRate * 100)}% de vitórias
              </p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
