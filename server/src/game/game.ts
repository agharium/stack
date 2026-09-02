import type {
  Card,
  CardColor,
  Direction,
  DrawChain,
  GameEvent,
  GameResult,
  PlayerView,
  PublicPlayer,
} from "../../../shared/types.js";
import {
  cardDescriptionPtBr,
  COLOR_LABELS_PT_BR,
} from "../../../shared/cards.js";
import { ERRORS, chainColorMismatch } from "../messages.js";
import { createDeck, shuffle } from "./deck.js";
import {
  buildSpyQueue,
  createEmptySpyState,
  pickNextSpyFromQueue,
  type SpyState,
} from "./spy.js";

export type GamePhase = "lobby" | "playing" | "finished";
export type GamePlayer = {
  id: string;
  nickname: string;
  connected: boolean;
  hand: Card[];
  unoDeclared: boolean;
};

export type PendingDrawPlay = {
  playerId: string;
  cardId: string;
};

export function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function sameFace(a: Card, b: Card): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== "number" || (b.kind === "number" && a.value === b.value);
}

export function sameGameplayIdentity(a: Card, b: Card): boolean {
  if (a.kind !== b.kind || a.color !== b.color) return false;
  return a.kind !== "number" || (b.kind === "number" && a.value === b.value);
}

export function buildMatchPlayerOrder(
  players: Array<{ id: string; connected: boolean }>,
  random: () => number = Math.random,
): string[] {
  return shuffle(
    players.filter((player) => player.connected).map((player) => player.id),
    random,
  );
}

export class Game {
  phase: GamePhase = "lobby";
  players: GamePlayer[];
  matchPlayerOrder: string[] = [];
  drawPile: Card[] = [];
  discardPile: Card[] = [];
  currentPlayerIndex = 0;
  direction: Direction = 1;
  activeColor: CardColor | null = null;
  drawChain: DrawChain | null = null;
  pendingDrawPlay: PendingDrawPlay | null = null;
  winnerId: string | null = null;
  result: GameResult | null = null;
  events: GameEvent[] = [];
  lastPlayerId: string | null = null;
  spy: SpyState = createEmptySpyState();
  private servedAsSpyThisCycle = new Set<string>();

  constructor(
    players: Array<{ id: string; nickname: string; connected?: boolean }>,
    private readonly random: () => number = Math.random,
  ) {
    this.players = players.map((player) => ({
      ...player,
      connected: player.connected ?? true,
      hand: [],
      unoDeclared: false,
    }));
  }

  start(): void {
    if (this.phase !== "lobby") {
      throw new Error(
        this.phase === "finished" ? ERRORS.gameFinished : ERRORS.matchStarted,
      );
    }
    if (this.players.filter((player) => player.connected).length < 2) {
      throw new Error(ERRORS.minimumPlayers);
    }
    this.phase = "playing";
    this.direction = 1;
    this.drawChain = null;
    this.pendingDrawPlay = null;
    this.winnerId = null;
    this.result = null;
    this.events = [];
    this.lastPlayerId = null;
    for (const player of this.players) {
      player.hand = [];
      player.unoDeclared = false;
    }
    this.drawPile = shuffle(createDeck(), this.random);
    this.discardPile = [];
    this.matchPlayerOrder = buildMatchPlayerOrder(this.players, this.random);
    this.currentPlayerIndex = 0;
    this.initSpy();

    for (let round = 0; round < 7; round += 1) {
      for (const playerId of this.matchPlayerOrder) {
        this.getPlayer(playerId).hand.push(this.drawRaw());
      }
    }

    const numericIndex = this.drawPile.findIndex(
      (card) => card.kind === "number",
    );
    if (numericIndex < 0) throw new Error(ERRORS.noStartingCard);
    const [startingCard] = this.drawPile.splice(numericIndex, 1);
    this.discardPile.push(startingCard!);
    this.activeColor = startingCard!.color;
    this.addEvent("A ordem dos jogadores foi sorteada!");
    this.addEvent(`${this.currentPlayer.nickname} começa a partida.`);
  }

  restart(): void {
    if (this.phase !== "finished") throw new Error(ERRORS.gameNotOver);
    this.phase = "lobby";
    this.start();
  }

  get currentPlayer(): GamePlayer {
    if (this.matchPlayerOrder.length > 0) {
      const playerId = this.matchPlayerOrder[this.currentPlayerIndex];
      if (!playerId) throw new Error(ERRORS.currentPlayerUnavailable);
      return this.getPlayer(playerId);
    }
    const player = this.players[this.currentPlayerIndex];
    if (!player) throw new Error(ERRORS.currentPlayerUnavailable);
    return player;
  }

  get topDiscard(): Card | null {
    return this.discardPile.at(-1) ?? null;
  }

  getPlayer(playerId: string): GamePlayer {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error(ERRORS.playerNotFound);
    return player;
  }

  getPlayerIndexOffset(offset: number): number {
    const order = this.matchPlayerOrder;
    if (order.length === 0) throw new Error(ERRORS.noPlayers);
    let index = this.currentPlayerIndex;
    const step = offset < 0 ? -this.direction : this.direction;
    let remaining = Math.abs(offset);
    let guard = 0;
    while (remaining > 0) {
      index = wrapIndex(index + step, order.length);
      guard += 1;
      if (this.getPlayer(order[index]!).connected) remaining -= 1;
      if (guard > order.length * Math.max(remaining + 1, 2)) {
        throw new Error(ERRORS.noConnectedPlayer);
      }
    }
    return index;
  }

  private connectedMatchPlayerCount(): number {
    return this.matchPlayerOrder.filter((playerId) =>
      this.getPlayer(playerId).connected,
    ).length;
  }

  advanceTurn(offset = 1): void {
    if (this.phase === "playing" && this.matchPlayerOrder.length > 0) {
      this.lastPlayerId = this.currentPlayer.id;
    }
    this.currentPlayerIndex = this.getPlayerIndexOffset(offset);
    this.onTurnResolved();
  }

  private onTurnResolved(): void {
    if (this.phase !== "playing" || !this.spy.currentPlayerId) return;
    this.spy.remainingTurns -= 1;
    if (this.spy.remainingTurns <= 0) {
      this.promoteNextSpy();
    }
  }

  private initSpy(): void {
    this.spy = createEmptySpyState();
    this.servedAsSpyThisCycle.clear();
    this.ensureSpyQueue();
    this.promoteNextSpy();
  }

  private connectedMatchPlayerIds(): string[] {
    return this.matchPlayerOrder.filter((playerId) =>
      this.getPlayer(playerId).connected,
    );
  }

  private ensureSpyQueue(): void {
    if (this.spy.selectionQueue.length > 0) return;
    const connected = this.connectedMatchPlayerIds();
    if (connected.length === 0) return;

    const unserved = connected.filter(
      (playerId) => !this.servedAsSpyThisCycle.has(playerId),
    );
    const pool = unserved.length > 0 ? unserved : connected;
    if (unserved.length === 0) {
      this.servedAsSpyThisCycle.clear();
    }
    this.spy.selectionQueue = buildSpyQueue(pool, this.random);
  }

  private promoteNextSpy(): void {
    if (this.phase !== "playing") return;

    if (this.spy.currentPlayerId) {
      this.servedAsSpyThisCycle.add(this.spy.currentPlayerId);
    }

    this.ensureSpyQueue();
    const picked = pickNextSpyFromQueue(
      this.spy.selectionQueue,
      (playerId) => this.getPlayer(playerId).connected,
    );
    this.spy.selectionQueue = picked.queue;

    if (!picked.nextId) {
      this.ensureSpyQueue();
      const retry = pickNextSpyFromQueue(
        this.spy.selectionQueue,
        (playerId) => this.getPlayer(playerId).connected,
      );
      this.spy.selectionQueue = retry.queue;
      if (!retry.nextId) {
        this.spy.currentPlayerId = null;
        this.spy.remainingTurns = 0;
        return;
      }
      this.activateSpy(retry.nextId);
      return;
    }

    this.activateSpy(picked.nextId);
  }

  private activateSpy(playerId: string): void {
    this.spy.currentPlayerId = playerId;
    this.spy.remainingTurns = this.connectedMatchPlayerCount();
    this.addEvent(
      `Novo espião: ${this.getPlayer(playerId).nickname} 🕵️`,
    );
  }

  private handleSpyDisconnect(playerId: string): void {
    if (this.spy.currentPlayerId !== playerId) return;
    this.servedAsSpyThisCycle.add(playerId);
    this.spy.currentPlayerId = null;
    this.spy.remainingTurns = 0;
    this.promoteNextSpy();
  }

  private handleSpyReconnect(playerId: string): void {
    if (this.phase !== "playing") return;
    if (this.servedAsSpyThisCycle.has(playerId)) return;
    if (this.spy.currentPlayerId === playerId) return;
    if (this.spy.selectionQueue.includes(playerId)) return;
    this.spy.selectionQueue.push(playerId);
  }

  private getNextPlayerId(): string | null {
    if (this.phase !== "playing" || this.matchPlayerOrder.length === 0) {
      return null;
    }
    if (this.connectedMatchPlayerCount() < 2) return null;
    try {
      return this.matchPlayerOrder[this.getPlayerIndexOffset(1)] ?? null;
    } catch {
      return null;
    }
  }

  canPlayCard(card: Card): { valid: true } | { valid: false; error: string } {
    if (this.drawChain) {
      if (card.kind === "draw-two") {
        return this.drawChain.type === "DRAW_TWO"
          ? { valid: true }
          : { valid: false, error: ERRORS.onlyDrawFour };
      }
      if (card.kind === "wild-draw-four") {
        return this.drawChain.type === "DRAW_FOUR"
          ? { valid: true }
          : { valid: false, error: ERRORS.onlyDrawTwo };
      }
      if (card.kind === "skip" || card.kind === "reverse") {
        return card.color === this.drawChain.activeColor
          ? { valid: true }
          : {
              valid: false,
              error: chainColorMismatch(card.kind),
            };
      }
      return {
        valid: false,
        error:
          this.drawChain.type === "DRAW_TWO"
            ? ERRORS.defendDrawTwo
            : ERRORS.defendDrawFour,
      };
    }

    if (card.kind === "wild" || card.kind === "wild-draw-four") {
      return { valid: true };
    }
    const top = this.topDiscard;
    if (!top) return { valid: false, error: ERRORS.noDiscard };
    return card.color === this.activeColor || sameFace(card, top)
      ? { valid: true }
      : { valid: false, error: ERRORS.cardNotPlayable };
  }

  playCard(
    playerId: string,
    cardId: string,
    chosenColor?: CardColor,
  ): void {
    this.playCards(playerId, [cardId], chosenColor);
  }

  playCards(
    playerId: string,
    cardIds: string[],
    chosenColor?: CardColor,
  ): void {
    this.assertTurn(playerId);
    const player = this.getPlayer(playerId);
    if (cardIds.length === 0) throw new Error(ERRORS.chooseCard);
    if (new Set(cardIds).size !== cardIds.length) {
      throw new Error(ERRORS.duplicateCard);
    }
    const cards = cardIds.map((cardId) => {
      const card = player.hand.find((candidate) => candidate.id === cardId);
      if (!card) throw new Error(ERRORS.cardNotOwned);
      return card;
    });
    const card = cards[0]!;
    if (!cards.every((candidate) => sameGameplayIdentity(card, candidate))) {
      throw new Error(ERRORS.cardsNotIdentical);
    }
    if (
      this.pendingDrawPlay &&
      (this.pendingDrawPlay.playerId !== playerId ||
        !cardIds.includes(this.pendingDrawPlay.cardId))
    ) {
      throw new Error(ERRORS.drawnCardRequired);
    }
    if (
      player.hand.length === cards.length &&
      (card.kind === "wild" || card.kind === "wild-draw-four")
    ) {
      throw new Error(ERRORS.wildFinish);
    }
    if (
      (card.kind === "wild" || card.kind === "wild-draw-four") &&
      !chosenColor
    ) {
      throw new Error(ERRORS.chooseColor);
    }
    const validity = this.canPlayCard(card);
    if (!validity.valid) throw new Error(validity.error);

    const selectedIds = new Set(cardIds);
    player.hand = player.hand.filter((candidate) => !selectedIds.has(candidate.id));
    player.unoDeclared = false;
    this.discardPile.push(...cards);
    this.pendingDrawPlay = null;
    if (card.color) this.activeColor = card.color;
    if (chosenColor) this.activeColor = chosenColor;
    this.addEvent(
      `${player.nickname} jogou ${cards.length > 1 ? `${cards.length} × ` : ""}${cardDescriptionPtBr(card)}.`,
    );
    if (chosenColor) {
      this.addEvent(
        `${player.nickname} escolheu a cor ${COLOR_LABELS_PT_BR[chosenColor].toLocaleLowerCase("pt-BR")}.`,
      );
    }

    if (player.hand.length === 0) {
      this.finishGame(player);
      return;
    }
    if (this.drawChain) {
      this.applyDrawChainCards(player, card, cards.length, chosenColor);
    } else {
      this.applyNormalCardEffects(player, card, cards.length, chosenColor);
    }
  }

  private applyNormalCardEffects(
    player: GamePlayer,
    card: Card,
    count: number,
    chosenColor?: CardColor,
  ): void {
    switch (card.kind) {
      case "skip":
        this.addEvent(
          count === 1
            ? `${player.nickname} bloqueou o próximo jogador.`
            : `${player.nickname} bloqueou os próximos ${count} jogadores.`,
        );
        this.advanceTurn(count + 1);
        break;
      case "reverse":
        for (let index = 0; index < count; index += 1) {
          this.direction = this.direction === 1 ? -1 : 1;
        }
        this.addEvent(
          count === 1
            ? `${player.nickname} inverteu a direção.`
            : `${player.nickname} inverteu a direção ${count} vezes.`,
        );
        this.advanceTurn(
          this.connectedMatchPlayerCount() === 2 ? count + 1 : 1,
        );
        break;
      case "draw-two":
        this.drawChain = {
          type: "DRAW_TWO",
          amount: 2 * count,
          activeColor: card.color,
        };
        this.addEvent(`${player.nickname} iniciou uma corrente de +${2 * count}.`);
        this.advanceTurn();
        break;
      case "wild-draw-four":
        this.drawChain = {
          type: "DRAW_FOUR",
          amount: 4 * count,
          activeColor: chosenColor!,
        };
        this.addEvent(`${player.nickname} iniciou uma corrente de +${4 * count}.`);
        this.advanceTurn();
        break;
      default:
        this.advanceTurn();
    }
  }

  private applyDrawChainCards(
    player: GamePlayer,
    card: Card,
    count: number,
    chosenColor?: CardColor,
  ): void {
    const chain = this.drawChain!;
    if (card.kind === "draw-two") {
      chain.amount += 2 * count;
      chain.activeColor = card.color;
      this.addEvent(`${player.nickname} acumulou +${2 * count}. Total: +${chain.amount}.`);
    } else if (card.kind === "wild-draw-four") {
      chain.amount += 4 * count;
      chain.activeColor = chosenColor!;
      this.addEvent(`${player.nickname} acumulou +${4 * count}. Total: +${chain.amount}.`);
    } else if (card.kind === "reverse") {
      chain.activeColor = card.color;
      for (let index = 0; index < count; index += 1) {
        this.direction = this.direction === 1 ? -1 : 1;
      }
      this.addEvent(
        count === 1
          ? `${player.nickname} inverteu a corrente de compra.`
          : `${player.nickname} inverteu a corrente de compra ${count} vezes.`,
      );
    } else if (card.kind === "skip") {
      chain.activeColor = card.color;
      this.addEvent(
        count === 1
          ? `${player.nickname} bloqueou a corrente de compra.`
          : `${player.nickname} bloqueou ${count} alvos da corrente de compra.`,
      );
    }
    this.advanceTurn(card.kind === "skip" ? count : 1);
  }

  drawOneCard(playerId: string): Card {
    this.assertTurn(playerId);
    if (this.drawChain) throw new Error(ERRORS.acceptPenalty);
    if (this.pendingDrawPlay) {
      throw new Error(ERRORS.resolveDrawn);
    }
    const card = this.drawRaw();
    this.currentPlayer.unoDeclared = false;
    this.currentPlayer.hand.push(card);
    this.addEvent(`${this.currentPlayer.nickname} comprou uma carta.`);
    if (this.canPlayCard(card).valid) {
      this.pendingDrawPlay = { playerId, cardId: card.id };
    } else {
      this.advanceTurn();
    }
    return card;
  }

  playDrawnCards(
    playerId: string,
    cardIds: string[],
    chosenColor?: CardColor,
  ): void {
    this.assertTurn(playerId);
    if (!this.pendingDrawPlay || this.pendingDrawPlay.playerId !== playerId) {
      throw new Error(ERRORS.noPendingDrawnPlay);
    }
    this.playCards(playerId, cardIds, chosenColor);
  }

  playDrawnCard(playerId: string, chosenColor?: CardColor): void {
    if (!this.pendingDrawPlay) throw new Error(ERRORS.noPendingDrawnPlay);
    this.playDrawnCards(
      playerId,
      [this.pendingDrawPlay.cardId],
      chosenColor,
    );
  }

  keepDrawnCard(playerId: string): void {
    this.assertTurn(playerId);
    if (!this.pendingDrawPlay || this.pendingDrawPlay.playerId !== playerId) {
      throw new Error(ERRORS.noPendingDrawnKeep);
    }
    this.pendingDrawPlay = null;
    this.addEvent(`${this.currentPlayer.nickname} ficou com a carta comprada.`);
    this.advanceTurn();
  }

  acceptDrawPenalty(playerId: string): number {
    this.assertTurn(playerId);
    if (this.pendingDrawPlay) {
      throw new Error(ERRORS.resolveDrawn);
    }
    if (!this.drawChain) throw new Error(ERRORS.noDrawPenalty);
    const player = this.currentPlayer;
    const amount = this.drawChain.amount;
    for (let index = 0; index < amount; index += 1) {
      player.hand.push(this.drawRaw());
    }
    player.unoDeclared = false;
    this.drawChain = null;
    this.addEvent(`${player.nickname} comprou ${amount} cartas.`);
    this.advanceTurn();
    return amount;
  }

  declareUno(playerId: string): void {
    if (this.phase !== "playing") throw new Error(ERRORS.gameNotStarted);
    const player = this.getPlayer(playerId);
    if (!player.connected) throw new Error(ERRORS.disconnected);
    if (player.hand.length !== 1) {
      throw new Error(ERRORS.noLongerAtUnoCount);
    }
    if (player.unoDeclared) throw new Error(ERRORS.unoAlreadyDeclared);
    player.unoDeclared = true;
    this.addEvent(`${player.nickname} gritou UNO!`);
  }

  private isUnoVulnerable(player: GamePlayer): boolean {
    return (
      this.phase === "playing" &&
      player.hand.length === 1 &&
      !player.unoDeclared
    );
  }

  accuseUno(accuserId: string, targetId: string): void {
    if (this.phase === "finished") throw new Error(ERRORS.gameFinished);
    if (this.phase !== "playing") throw new Error(ERRORS.gameNotStarted);
    if (accuserId === targetId) throw new Error(ERRORS.catchSelf);
    if (accuserId !== this.spy.currentPlayerId) {
      throw new Error(ERRORS.spyOnlyAccuse);
    }
    const accuser = this.getPlayer(accuserId);
    const target = this.getPlayer(targetId);
    if (!accuser.connected) throw new Error(ERRORS.disconnected);

    if (target.unoDeclared) {
      throw new Error(ERRORS.unoAlreadyDeclaredByTarget);
    }
    if (target.hand.length !== 1) {
      throw new Error(ERRORS.targetNoLongerAtUnoCount);
    }

    target.hand.push(this.drawRaw(), this.drawRaw());
    target.unoDeclared = false;
    this.addEvent(
      `${accuser.nickname} pegou ${target.nickname} sem falar UNO! ${target.nickname} comprou 2 cartas.`,
    );
  }

  private finishGame(winner: GamePlayer): void {
    this.phase = "finished";
    this.winnerId = winner.id;
    this.drawChain = null;
    this.pendingDrawPlay = null;
    winner.unoDeclared = false;

    const ordered = [...this.players].sort((a, b) => {
      if (a.id === winner.id) return -1;
      if (b.id === winner.id) return 1;
      return a.hand.length - b.hand.length;
    });
    let previousPosition = 0;
    const standings = ordered.map((player, index, allPlayers) => {
      const previous = allPlayers[index - 1];
      const position =
        previous && previous.hand.length === player.hand.length
          ? previousPosition
          : index + 1;
      previousPosition = position;
      return {
        playerId: player.id,
        nickname: player.nickname,
        cardsRemaining: player.hand.length,
        position,
      };
    });
    this.result = { winnerId: winner.id, standings };
    this.addEvent(`${winner.nickname} venceu a partida!`);
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.getPlayer(playerId);
    player.connected = connected;
    if (connected) {
      this.handleSpyReconnect(playerId);
    } else if (this.phase === "playing") {
      this.handleSpyDisconnect(playerId);
    }
    if (
      !connected &&
      this.phase === "playing" &&
      this.currentPlayer.id === playerId &&
      this.players.some((candidate) => candidate.connected)
    ) {
      this.advanceTurn();
      this.pendingDrawPlay = null;
    }
  }

  toPlayerView(
    roomCode: string,
    hostId: string,
    playerId: string,
    lobbyPlayerIds?: string[],
  ): PlayerView {
    const viewer = this.getPlayer(playerId);
    const lobbyOrder = lobbyPlayerIds ?? this.players.map((player) => player.id);
    const displayOrder =
      this.phase === "lobby" ? lobbyOrder : this.matchPlayerOrder;
    const nextPlayerId = this.getNextPlayerId();
    const previousPlayerId =
      this.phase === "playing" ? this.lastPlayerId : null;
    const viewerIsSpy = playerId === this.spy.currentPlayerId;
    const revealAllCounts = this.phase === "finished";
    return {
      roomCode,
      phase: this.phase,
      hostId,
      selfId: playerId,
      hand: [...viewer.hand],
      selfUnoDeclared: viewer.unoDeclared,
      players: displayOrder.map((id) => {
        const player = this.getPlayer(id);
        const isSelf = player.id === playerId;
        const canSeeCount =
          this.phase === "lobby" ||
          isSelf ||
          viewerIsSpy ||
          revealAllCounts;
        const playerView: PublicPlayer = {
          id: player.id,
          nickname: player.nickname,
          connected: player.connected,
          isHost: player.id === hostId,
          cardCount: canSeeCount ? player.hand.length : null,
          isAtUnoCount:
            this.phase === "playing" && player.hand.length === 1,
          isCurrentTurn:
            this.phase === "playing" && player.id === this.currentPlayer.id,
          isPreviousTurn: previousPlayerId === player.id,
          isNextTurn: nextPlayerId === player.id,
          isSpy:
            this.phase === "playing" &&
            player.id === this.spy.currentPlayerId,
        };
        if (viewerIsSpy && this.phase === "playing" && !isSelf) {
          playerView.canAccuseUno = this.isUnoVulnerable(player);
        }
        return playerView;
      }),
      topDiscard: this.topDiscard,
      activeColor: this.activeColor,
      currentPlayerId:
        this.phase === "playing" ? this.currentPlayer.id : null,
      direction: this.direction,
      drawChain: this.drawChain ? { ...this.drawChain } : null,
      pendingDrawPlay: this.pendingDrawPlay
        ? {
            playerId: this.pendingDrawPlay.playerId,
            cardId:
              this.pendingDrawPlay.playerId === playerId
                ? this.pendingDrawPlay.cardId
                : null,
          }
        : null,
      winnerId: this.winnerId,
      result: this.result
        ? {
            winnerId: this.result.winnerId,
            standings: this.result.standings.map((standing) => ({
              ...standing,
            })),
          }
        : null,
      events: this.events.slice(-8),
      currentSpyPlayerId:
        this.phase === "playing" ? this.spy.currentPlayerId : null,
      spyRemainingTurns:
        this.phase === "playing" && viewerIsSpy
          ? this.spy.remainingTurns
          : null,
    };
  }

  private assertTurn(playerId: string): void {
    if (this.phase === "finished") throw new Error(ERRORS.gameFinished);
    if (this.phase !== "playing") throw new Error(ERRORS.gameNotStarted);
    const player = this.getPlayer(playerId);
    if (!player.connected) throw new Error(ERRORS.disconnected);
    if (this.currentPlayer.id !== playerId) {
      throw new Error(ERRORS.notYourTurn);
    }
  }

  private drawRaw(): Card {
    if (this.drawPile.length === 0) this.recycleDiscardPile();
    const card = this.drawPile.pop();
    if (!card) throw new Error(ERRORS.noCardsToDraw);
    return card;
  }

  private recycleDiscardPile(): void {
    if (this.discardPile.length <= 1) {
      throw new Error(ERRORS.noCardsToRecycle);
    }
    const top = this.discardPile.pop()!;
    this.drawPile = shuffle(this.discardPile, this.random);
    this.discardPile = [top];
  }

  private addEvent(text: string): void {
    this.events.push({
      id: `${Date.now()}-${this.events.length}-${this.random()}`,
      text,
      at: Date.now(),
    });
    if (this.events.length > 20) this.events.splice(0, this.events.length - 20);
  }
}
