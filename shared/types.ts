export type CardColor = "red" | "yellow" | "green" | "blue";
export type Direction = 1 | -1;
export type CardKind =
  | "number"
  | "skip"
  | "reverse"
  | "draw-two"
  | "wild"
  | "wild-draw-four";

export type Card =
  | { id: string; kind: "number"; color: CardColor; value: number }
  | { id: string; kind: "skip" | "reverse" | "draw-two"; color: CardColor }
  | { id: string; kind: "wild" | "wild-draw-four"; color: null };

export type DrawChain = {
  type: "DRAW_TWO" | "DRAW_FOUR";
  amount: number;
  activeColor: CardColor;
};

export type PendingDrawPlayView = {
  playerId: string;
  cardId: string | null;
};

export type PublicPlayer = {
  id: string;
  nickname: string;
  connected: boolean;
  isHost: boolean;
  cardCount: number | null;
  isAtUnoCount: boolean;
  canAccuseUno?: boolean;
  isCurrentTurn: boolean;
  isPreviousTurn: boolean;
  isNextTurn: boolean;
  isSpy: boolean;
};

export type FinalStanding = {
  playerId: string;
  userId: string | null;
  nickname: string;
  cardsRemaining: number;
  position: number;
};

export type PublicFinalStanding = {
  playerId: string;
  nickname: string;
  cardsRemaining: number;
  position: number;
};

export type GameResult = {
  winnerId: string;
  standings: FinalStanding[];
};

export type PublicGameResult = {
  winnerId: string;
  standings: PublicFinalStanding[];
};

export type GameEvent = {
  id: string;
  text: string;
  at: number;
};

export type PlayerView = {
  roomCode: string;
  phase: "lobby" | "playing" | "finished";
  players: PublicPlayer[];
  hostId: string;
  selfId: string;
  hand: Card[];
  selfUnoDeclared: boolean;
  topDiscard: Card | null;
  activeColor: CardColor | null;
  currentPlayerId: string | null;
  direction: Direction;
  drawChain: DrawChain | null;
  pendingDrawPlay: PendingDrawPlayView | null;
  winnerId: string | null;
  result: PublicGameResult | null;
  events: GameEvent[];
  currentSpyPlayerId: string | null;
  spyRemainingTurns: number | null;
};

export type Ack<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export type CreateRoomPayload = { nickname?: string; playerId?: string };
export type JoinRoomPayload = {
  nickname?: string;
  roomCode: string;
  playerId?: string;
};
export type RoomPayload = { roomCode: string; playerId: string };
export type PlayCardsPayload = RoomPayload & {
  cardIds: string[];
  chosenColor?: CardColor;
};

export interface ClientToServerEvents {
  "create-room": (
    payload: CreateRoomPayload,
    ack: (result: Ack<{ roomCode: string; playerId: string }>) => void,
  ) => void;
  "join-room": (
    payload: JoinRoomPayload,
    ack: (result: Ack<{ roomCode: string; playerId: string }>) => void,
  ) => void;
  "start-game": (payload: RoomPayload, ack: (result: Ack) => void) => void;
  "play-cards": (payload: PlayCardsPayload, ack: (result: Ack) => void) => void;
  "draw-card": (payload: RoomPayload, ack: (result: Ack) => void) => void;
  "play-drawn-cards": (
    payload: RoomPayload & { cardIds: string[]; chosenColor?: CardColor },
    ack: (result: Ack) => void,
  ) => void;
  "keep-drawn-card": (
    payload: RoomPayload,
    ack: (result: Ack) => void,
  ) => void;
  "accept-draw-chain": (
    payload: RoomPayload,
    ack: (result: Ack) => void,
  ) => void;
  "call-uno": (payload: RoomPayload, ack: (result: Ack) => void) => void;
  "accuse-uno": (
    payload: RoomPayload & { targetPlayerId: string },
    ack: (result: Ack) => void,
  ) => void;
  "restart-game": (payload: RoomPayload, ack: (result: Ack) => void) => void;
  "leave-room": (payload: RoomPayload) => void;
}

export interface ServerToClientEvents {
  "state-update": (state: PlayerView) => void;
  "action-error": (message: string) => void;
}
