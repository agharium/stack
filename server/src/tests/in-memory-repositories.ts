import { randomUUID } from "node:crypto";
import type { UserRecord, UserRepository } from "../repositories/user-repository.js";
import type {
  CreateMatchInput,
  MatchRepository,
  MatchWithResults,
} from "../repositories/match-repository.js";
import type { Match, MatchResult } from "@prisma/client";

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, UserRecord>();

  findById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByUsername(username: string): Promise<UserRecord | null> {
    const normalized = username.trim().toLowerCase();
    return Promise.resolve(
      [...this.users.values()].find((user) => user.username === normalized) ??
        null,
    );
  }

  create(input: {
    name: string;
    username: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      name: input.name,
      username: input.username.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  updateProfile(
    id: string,
    data: { name?: string; username?: string },
  ): Promise<UserRecord> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updated = {
      ...user,
      ...data,
      ...(data.username
        ? { username: data.username.trim().toLowerCase() }
        : {}),
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return Promise.resolve(updated);
  }

  updatePasswordHash(id: string, passwordHash: string): Promise<UserRecord> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updated = { ...user, passwordHash, updatedAt: new Date() };
    this.users.set(id, updated);
    return Promise.resolve(updated);
  }

  getAll(): UserRecord[] {
    return [...this.users.values()];
  }
}

export class InMemoryMatchRepository implements MatchRepository {
  private matches = new Map<string, MatchWithResults>();

  findBySessionId(sessionId: string): Promise<MatchWithResults | null> {
    return Promise.resolve(this.matches.get(sessionId) ?? null);
  }

  async createCompletedMatch(input: CreateMatchInput): Promise<MatchWithResults> {
    if (this.matches.has(input.sessionId)) {
      throw new Error("duplicate");
    }
    const matchId = randomUUID();
    const now = new Date();
    const match: Match = {
      id: matchId,
      sessionId: input.sessionId,
      roomCode: input.roomCode,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      winnerUserId: input.winnerUserId,
      winnerNameSnapshot: input.winnerNameSnapshot,
      createdAt: now,
    };
    const results: MatchResult[] = input.results.map((result) => ({
      id: randomUUID(),
      matchId,
      userId: result.userId,
      displayNameSnapshot: result.displayNameSnapshot,
      position: result.position,
      cardsRemaining: result.cardsRemaining,
      pointsAwarded: result.pointsAwarded,
      createdAt: now,
    }));
    const stored = { ...match, results };
    this.matches.set(input.sessionId, stored);
    return stored;
  }

  async aggregateLeaderboard() {
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

    for (const match of this.matches.values()) {
      for (const result of match.results) {
        if (!result.userId) continue;
        const entry = byUser.get(result.userId) ?? {
          userId: result.userId,
          name: result.displayNameSnapshot,
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
        byUser.set(result.userId, entry);
      }
    }

    return [...byUser.values()].sort((a, b) => b.totalPoints - a.totalPoints);
  }

  getAll(): MatchWithResults[] {
    return [...this.matches.values()];
  }
}
