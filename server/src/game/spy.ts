import { shuffle } from "./deck.js";

export type SpyState = {
  currentPlayerId: string | null;
  remainingTurns: number;
  selectionQueue: string[];
};

export function createEmptySpyState(): SpyState {
  return {
    currentPlayerId: null,
    remainingTurns: 0,
    selectionQueue: [],
  };
}

export function buildSpyQueue(
  playerIds: string[],
  random: () => number = Math.random,
): string[] {
  return shuffle([...playerIds], random);
}

export function pickNextSpyFromQueue(
  queue: string[],
  isConnected: (playerId: string) => boolean,
): { nextId: string | null; queue: string[] } {
  const remaining = [...queue];
  const deferred: string[] = [];

  while (remaining.length > 0) {
    const candidate = remaining.shift()!;
    if (isConnected(candidate)) {
      return { nextId: candidate, queue: [...remaining, ...deferred] };
    }
    deferred.push(candidate);
  }

  return { nextId: null, queue: deferred };
}
