import { describe, expect, it } from "vitest";
import { MatchService } from "../services/match-service.js";
import { RankingService } from "../services/ranking-service.js";
import { getPointsForPosition } from "../lib/scoring.js";
import { InMemoryMatchRepository } from "./in-memory-repositories.js";

function snapshot(overrides?: Partial<Parameters<MatchService["saveCompletedMatch"]>[0]>) {
  return {
    sessionId: "session-1",
    roomCode: "ABCD",
    startedAt: new Date("2026-01-01T12:00:00Z"),
    finishedAt: new Date("2026-01-01T12:30:00Z"),
    result: {
      winnerId: "p1",
      standings: [
        {
          playerId: "p1",
          userId: "user-1",
          nickname: "Maria",
          cardsRemaining: 0,
          position: 1,
        },
        {
          playerId: "p2",
          userId: null,
          nickname: "Convidado",
          cardsRemaining: 3,
          position: 2,
        },
        {
          playerId: "p3",
          userId: "user-2",
          nickname: "João",
          cardsRemaining: 5,
          position: 3,
        },
      ],
    },
    playerIdentities: [
      { playerId: "p1", userId: "user-1", name: "Maria" },
      { playerId: "p2", userId: null, name: "Convidado" },
      { playerId: "p3", userId: "user-2", name: "João" },
    ],
    ...overrides,
  };
}

describe("persistência de partidas", () => {
  it("cria exatamente uma partida e um resultado por participante", async () => {
    const matches = new InMemoryMatchRepository();
    const service = new MatchService(matches);
    const saved = await service.saveCompletedMatch(snapshot());
    expect(saved.saved).toBe(true);
    const all = matches.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.results).toHaveLength(3);
  });

  it("salva convidado com userId null", async () => {
    const matches = new InMemoryMatchRepository();
    const service = new MatchService(matches);
    await service.saveCompletedMatch(snapshot());
    const guest = matches.getAll()[0]?.results.find((r) => r.userId === null);
    expect(guest?.displayNameSnapshot).toBe("Convidado");
  });

  it("salva vencedor autenticado e snapshot do nome", async () => {
    const matches = new InMemoryMatchRepository();
    const service = new MatchService(matches);
    await service.saveCompletedMatch(snapshot());
    const match = matches.getAll()[0];
    expect(match?.winnerUserId).toBe("user-1");
    expect(match?.winnerNameSnapshot).toBe("Maria");
  });

  it("persiste pontos e cartas restantes", async () => {
    const matches = new InMemoryMatchRepository();
    const service = new MatchService(matches);
    await service.saveCompletedMatch(snapshot());
    const winner = matches
      .getAll()[0]
      ?.results.find((result) => result.position === 1);
    expect(winner?.cardsRemaining).toBe(0);
    expect(winner?.pointsAwarded).toBe(getPointsForPosition(1));
  });

  it("não duplica partida com o mesmo sessionId", async () => {
    const matches = new InMemoryMatchRepository();
    const service = new MatchService(matches);
    await service.saveCompletedMatch(snapshot());
    const duplicate = await service.saveCompletedMatch(snapshot());
    expect(duplicate.duplicate).toBe(true);
    expect(matches.getAll()).toHaveLength(1);
  });
});

describe("ranking global", () => {
  it("conta apenas resultados autenticados", async () => {
    const matches = new InMemoryMatchRepository();
    const matchService = new MatchService(matches);
    const rankingService = new RankingService(matches);
    await matchService.saveCompletedMatch(snapshot());
    const ranking = await rankingService.getLeaderboard();
    expect(ranking).toHaveLength(2);
    expect(ranking.every((entry) => entry.name !== "Convidado")).toBe(true);
    expect(ranking[0]?.name).toBe("Maria");
    expect(ranking[0]?.totalPoints).toBe(10);
    expect(ranking[0]?.wins).toBe(1);
    expect(ranking[0]?.gamesPlayed).toBe(1);
    expect(ranking[0]?.winRate).toBe(100);
  });

  it("não expõe username nem passwordHash", async () => {
    const matches = new InMemoryMatchRepository();
    const rankingService = new RankingService(matches);
    await new MatchService(matches).saveCompletedMatch(snapshot());
    const serialized = JSON.stringify(await rankingService.getLeaderboard());
    expect(serialized).not.toContain("username");
    expect(serialized).not.toContain("passwordHash");
  });

  it("lida com zero partidas", async () => {
    const ranking = await new RankingService(
      new InMemoryMatchRepository(),
    ).getLeaderboard();
    expect(ranking).toEqual([]);
  });
});
