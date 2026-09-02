import type { GameResult } from "../../../shared/types.js";
import { getPointsForPosition } from "../lib/scoring.js";
import {
  matchRepository,
  type MatchRepository,
} from "../repositories/match-repository.js";

export type CompletedMatchSnapshot = {
  sessionId: string;
  roomCode: string;
  startedAt: Date;
  finishedAt: Date;
  result: GameResult;
  playerIdentities: Array<{
    playerId: string;
    userId: string | null;
    name: string;
  }>;
};

export class MatchService {
  constructor(private readonly matches: MatchRepository = matchRepository) {}

  async saveCompletedMatch(
    snapshot: CompletedMatchSnapshot,
  ): Promise<{ saved: boolean; duplicate: boolean }> {
    const existing = await this.matches.findBySessionId(snapshot.sessionId);
    if (existing) {
      return { saved: false, duplicate: true };
    }

    const identityByPlayerId = new Map(
      snapshot.playerIdentities.map((identity) => [identity.playerId, identity]),
    );
    const winnerIdentity = identityByPlayerId.get(snapshot.result.winnerId);

    await this.matches.createCompletedMatch({
      sessionId: snapshot.sessionId,
      roomCode: snapshot.roomCode,
      startedAt: snapshot.startedAt,
      finishedAt: snapshot.finishedAt,
      winnerUserId: winnerIdentity?.userId ?? null,
      winnerNameSnapshot: winnerIdentity?.name ?? "Desconhecido",
      results: snapshot.result.standings.map((standing) => {
        const identity = identityByPlayerId.get(standing.playerId);
        return {
          userId: standing.userId ?? identity?.userId ?? null,
          displayNameSnapshot: standing.nickname,
          position: standing.position,
          cardsRemaining: standing.cardsRemaining,
          pointsAwarded: getPointsForPosition(standing.position),
        };
      }),
    });

    return { saved: true, duplicate: false };
  }
}

export const matchService = new MatchService();
