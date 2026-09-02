import type { Game } from "../game/game.js";

export function bootstrapSpy(
  game: Game,
  playerIds: string[],
  spyId?: string,
): void {
  const spy = spyId ?? playerIds[0]!;
  game.spy = {
    currentPlayerId: spy,
    remainingTurns: playerIds.length,
    selectionQueue: playerIds.filter((id) => id !== spy),
  };
}

export function setSpy(game: Game, playerId: string): void {
  game.spy.currentPlayerId = playerId;
}
