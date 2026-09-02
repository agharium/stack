import { describe, expect, it } from "vitest";
import { MatchService } from "../services/match-service.js";
import { RankingService } from "../services/ranking-service.js";
import { InMemoryMatchRepository } from "./in-memory-repositories.js";

function snapshot(
  overrides?: Partial<Parameters<MatchService["saveCompletedMatch"]>[0]>,
) {
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

  it("persiste posição e cartas restantes sem pontos", async () => {
    const matches = new InMemoryMatchRepository();
    const service = new MatchService(matches);
    await service.saveCompletedMatch(snapshot());
    const winner = matches
      .getAll()[0]
      ?.results.find((result) => result.position === 1);
    expect(winner?.cardsRemaining).toBe(0);
    expect(winner?.position).toBe(1);
    expect(winner).not.toHaveProperty("pointsAwarded");
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

describe("ranking global por vitórias", () => {
  it("vitória autenticada incrementa wins e gamesPlayed", async () => {
    const matches = new InMemoryMatchRepository();
    const matchService = new MatchService(matches);
    const rankingService = new RankingService(matches);
    await matchService.saveCompletedMatch(snapshot());
    const ranking = await rankingService.getLeaderboard();
    const maria = ranking.find((entry) => entry.name === "Maria");
    expect(maria?.wins).toBe(1);
    expect(maria?.gamesPlayed).toBe(1);
  });

  it("derrota autentica incrementa gamesPlayed sem wins", async () => {
    const matches = new InMemoryMatchRepository();
    const matchService = new MatchService(matches);
    const rankingService = new RankingService(matches);
    await matchService.saveCompletedMatch(snapshot());
    const ranking = await rankingService.getLeaderboard();
    const joao = ranking.find((entry) => entry.name === "João");
    expect(joao?.wins).toBe(0);
    expect(joao?.gamesPlayed).toBe(1);
  });

  it("vencedor e perdedores autenticados incrementam gamesPlayed", async () => {
    const matches = new InMemoryMatchRepository();
    const matchService = new MatchService(matches);
    const rankingService = new RankingService(matches);
    await matchService.saveCompletedMatch(snapshot());
    const ranking = await rankingService.getLeaderboard();
    expect(ranking.every((entry) => entry.gamesPlayed === 1)).toBe(true);
  });

  it("vitória de convidado não aparece no ranking autenticado", async () => {
    const matches = new InMemoryMatchRepository();
    const matchService = new MatchService(matches);
    const rankingService = new RankingService(matches);
    await matchService.saveCompletedMatch(
      snapshot({
        sessionId: "guest-win",
        result: {
          winnerId: "p2",
          standings: [
            {
              playerId: "p2",
              userId: null,
              nickname: "Convidado",
              cardsRemaining: 0,
              position: 1,
            },
            {
              playerId: "p1",
              userId: "user-1",
              nickname: "Maria",
              cardsRemaining: 4,
              position: 2,
            },
          ],
        },
        playerIdentities: [
          { playerId: "p2", userId: null, name: "Convidado" },
          { playerId: "p1", userId: "user-1", name: "Maria" },
        ],
      }),
    );
    const ranking = await rankingService.getLeaderboard();
    expect(ranking.every((entry) => entry.name !== "Convidado")).toBe(true);
    expect(ranking[0]?.name).toBe("Maria");
    expect(ranking[0]?.wins).toBe(0);
    expect(ranking[0]?.gamesPlayed).toBe(1);
  });

  it("ordena por vitórias decrescente", async () => {
    const matches = new InMemoryMatchRepository();
    const matchService = new MatchService(matches);
    const rankingService = new RankingService(matches);

    for (let index = 0; index < 10; index += 1) {
      await matchService.saveCompletedMatch(
        snapshot({
          sessionId: `maria-win-${index}`,
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
                playerId: "p3",
                userId: "user-2",
                nickname: "João",
                cardsRemaining: 2,
                position: 2,
              },
            ],
          },
          playerIdentities: [
            { playerId: "p1", userId: "user-1", name: "Maria" },
            { playerId: "p3", userId: "user-2", name: "João" },
          ],
        }),
      );
    }
    for (let index = 0; index < 9; index += 1) {
      await matchService.saveCompletedMatch(
        snapshot({
          sessionId: `joao-win-${index}`,
          result: {
            winnerId: "p3",
            standings: [
              {
                playerId: "p3",
                userId: "user-2",
                nickname: "João",
                cardsRemaining: 0,
                position: 1,
              },
              {
                playerId: "p1",
                userId: "user-1",
                nickname: "Maria",
                cardsRemaining: 3,
                position: 2,
              },
            ],
          },
          playerIdentities: [
            { playerId: "p3", userId: "user-2", name: "João" },
            { playerId: "p1", userId: "user-1", name: "Maria" },
          ],
        }),
      );
    }

    const ranking = await rankingService.getLeaderboard();
    expect(ranking[0]?.name).toBe("Maria");
    expect(ranking[0]?.wins).toBe(10);
    expect(ranking[1]?.name).toBe("João");
    expect(ranking[1]?.wins).toBe(9);
  });

  it("taxa de vitória não altera a ordem principal", async () => {
    const matches = new InMemoryMatchRepository();
    const matchService = new MatchService(matches);
    const rankingService = new RankingService(matches);

    // Pedro: 2 wins / 2 games = 100% win rate, but only 2 wins
    for (let index = 0; index < 2; index += 1) {
      await matchService.saveCompletedMatch(
        snapshot({
          sessionId: `pedro-${index}`,
          result: {
            winnerId: "p4",
            standings: [
              {
                playerId: "p4",
                userId: "user-3",
                nickname: "Pedro",
                cardsRemaining: 0,
                position: 1,
              },
            ],
          },
          playerIdentities: [
            { playerId: "p4", userId: "user-3", name: "Pedro" },
          ],
        }),
      );
    }

    // Maria: 3 wins / 6 games = 50% — more wins than Pedro despite lower rate
    for (let index = 0; index < 3; index += 1) {
      await matchService.saveCompletedMatch(
        snapshot({
          sessionId: `maria-w-${index}`,
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
                playerId: "p3",
                userId: "user-2",
                nickname: "João",
                cardsRemaining: 2,
                position: 2,
              },
            ],
          },
          playerIdentities: [
            { playerId: "p1", userId: "user-1", name: "Maria" },
            { playerId: "p3", userId: "user-2", name: "João" },
          ],
        }),
      );
    }
    for (let index = 0; index < 3; index += 1) {
      await matchService.saveCompletedMatch(
        snapshot({
          sessionId: `maria-l-${index}`,
          result: {
            winnerId: "p3",
            standings: [
              {
                playerId: "p3",
                userId: "user-2",
                nickname: "João",
                cardsRemaining: 0,
                position: 1,
              },
              {
                playerId: "p1",
                userId: "user-1",
                nickname: "Maria",
                cardsRemaining: 4,
                position: 2,
              },
            ],
          },
          playerIdentities: [
            { playerId: "p3", userId: "user-2", name: "João" },
            { playerId: "p1", userId: "user-1", name: "Maria" },
          ],
        }),
      );
    }

    const ranking = await rankingService.getLeaderboard();
    // João and Maria both have 3 wins; Pedro has better win rate but only 2 wins
    expect(ranking.find((entry) => entry.name === "Pedro")?.wins).toBe(2);
    expect(ranking.find((entry) => entry.name === "Pedro")?.winRate).toBe(1);
    expect(ranking[0]?.wins).toBe(3);
    expect(ranking[0]?.name).not.toBe("Pedro");
    const maria = ranking.find((entry) => entry.name === "Maria");
    expect(maria?.wins).toBe(3);
    expect(maria?.winRate).toBe(0.5);
    expect(ranking.indexOf(maria!)).toBeLessThan(
      ranking.findIndex((entry) => entry.name === "Pedro"),
    );
  });

  it("não retorna totalPoints nem coloca convidados", async () => {
    const matches = new InMemoryMatchRepository();
    const rankingService = new RankingService(matches);
    await new MatchService(matches).saveCompletedMatch(snapshot());
    const ranking = await rankingService.getLeaderboard();
    const serialized = JSON.stringify(ranking);
    expect(serialized).not.toContain("totalPoints");
    expect(serialized).not.toContain("pointsAwarded");
    expect(serialized).not.toContain("secondPlaces");
    expect(serialized).not.toContain("thirdPlaces");
    expect(serialized).not.toContain("username");
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("Convidado");
  });

  it("lida com zero partidas", async () => {
    const ranking = await new RankingService(
      new InMemoryMatchRepository(),
    ).getLeaderboard();
    expect(ranking).toEqual([]);
  });
});
