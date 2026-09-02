import type { RankingEntryDto } from "../types/auth.js";
import {
  matchRepository,
  type MatchRepository,
} from "../repositories/match-repository.js";

export class RankingService {
  constructor(private readonly matches: MatchRepository = matchRepository) {}

  async getLeaderboard(): Promise<RankingEntryDto[]> {
    const rows = await this.matches.aggregateLeaderboard();
    return rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      totalPoints: row.totalPoints,
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      secondPlaces: row.secondPlaces,
      thirdPlaces: row.thirdPlaces,
      winRate:
        row.gamesPlayed > 0
          ? Math.round((row.wins / row.gamesPlayed) * 100)
          : 0,
    }));
  }
}

export const rankingService = new RankingService();
