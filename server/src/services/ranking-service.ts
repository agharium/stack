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
      wins: row.wins,
      gamesPlayed: row.gamesPlayed,
      winRate: row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0,
    }));
  }
}

export const rankingService = new RankingService();
