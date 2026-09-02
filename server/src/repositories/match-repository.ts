import type { Match, MatchResult, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type MatchWithResults = Match & { results: MatchResult[] };

export type CreateMatchInput = {
  sessionId: string;
  roomCode: string;
  startedAt: Date;
  finishedAt: Date;
  winnerUserId: string | null;
  winnerNameSnapshot: string;
  results: Array<{
    userId: string | null;
    displayNameSnapshot: string;
    position: number;
    cardsRemaining: number;
  }>;
};

export type LeaderboardRow = {
  userId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
};

export type MatchRepository = {
  findBySessionId(sessionId: string): Promise<MatchWithResults | null>;
  createCompletedMatch(input: CreateMatchInput): Promise<MatchWithResults>;
  aggregateLeaderboard(): Promise<LeaderboardRow[]>;
};

function sortLeaderboard(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export const matchRepository: MatchRepository = {
  findBySessionId(sessionId) {
    return prisma.match.findUnique({
      where: { sessionId },
      include: { results: true },
    });
  },

  async createCompletedMatch(input) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const match = await tx.match.create({
        data: {
          sessionId: input.sessionId,
          roomCode: input.roomCode,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          winnerUserId: input.winnerUserId,
          winnerNameSnapshot: input.winnerNameSnapshot,
          results: {
            create: input.results.map((result) => ({
              userId: result.userId,
              displayNameSnapshot: result.displayNameSnapshot,
              position: result.position,
              cardsRemaining: result.cardsRemaining,
            })),
          },
        },
        include: { results: true },
      });
      return match;
    });
  },

  async aggregateLeaderboard() {
    const results = await prisma.matchResult.findMany({
      where: { userId: { not: null } },
      include: { user: { select: { id: true, name: true } } },
    });

    const byUser = new Map<string, LeaderboardRow>();

    for (const result of results) {
      if (!result.userId || !result.user) continue;
      const entry = byUser.get(result.userId) ?? {
        userId: result.userId,
        name: result.user.name,
        gamesPlayed: 0,
        wins: 0,
      };
      entry.gamesPlayed += 1;
      if (result.position === 1) entry.wins += 1;
      entry.name = result.user.name;
      byUser.set(result.userId, entry);
    }

    return sortLeaderboard([...byUser.values()]);
  },
};

export { sortLeaderboard };
