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
    pointsAwarded: number;
  }>;
};

export type MatchRepository = {
  findBySessionId(sessionId: string): Promise<MatchWithResults | null>;
  createCompletedMatch(input: CreateMatchInput): Promise<MatchWithResults>;
  aggregateLeaderboard(): Promise<
    Array<{
      userId: string;
      name: string;
      totalPoints: number;
      gamesPlayed: number;
      wins: number;
      secondPlaces: number;
      thirdPlaces: number;
    }>
  >;
};

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
              pointsAwarded: result.pointsAwarded,
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

    const byUser = new Map<
      string,
      {
        userId: string;
        name: string;
        totalPoints: number;
        gamesPlayed: number;
        wins: number;
        secondPlaces: number;
        thirdPlaces: number;
      }
    >();

    for (const result of results) {
      if (!result.userId || !result.user) continue;
      const entry = byUser.get(result.userId) ?? {
        userId: result.userId,
        name: result.user.name,
        totalPoints: 0,
        gamesPlayed: 0,
        wins: 0,
        secondPlaces: 0,
        thirdPlaces: 0,
      };
      entry.totalPoints += result.pointsAwarded;
      entry.gamesPlayed += 1;
      if (result.position === 1) entry.wins += 1;
      if (result.position === 2) entry.secondPlaces += 1;
      if (result.position === 3) entry.thirdPlaces += 1;
      entry.name = result.user.name;
      byUser.set(result.userId, entry);
    }

    return [...byUser.values()].sort((a, b) => b.totalPoints - a.totalPoints);
  },
};
