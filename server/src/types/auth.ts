export type PublicUserDto = {
  id: string;
  name: string;
};

export type PrivateAccountDto = {
  id: string;
  name: string;
  username: string;
};

export type AuthMeResponse =
  | { authenticated: true; user: PrivateAccountDto }
  | { authenticated: false; user: null };

export type RankingEntryDto = {
  userId: string;
  name: string;
  wins: number;
  gamesPlayed: number;
  winRate: number;
};

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userName?: string;
  }
}
