import { FormEvent, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  Card,
  CardColor,
  ClientToServerEvents,
  PlayerView,
  ServerToClientEvents,
} from "../../shared/types";
import {
  cardDescriptionPtBr,
  COLOR_LABELS_PT_BR,
} from "../../shared/cards";
import {
  getLegalStackQuantities,
  groupHandIntoStacks,
  groupStacksByColor,
  selectLegalPhysicalCards,
  type CardStackView,
} from "../../shared/hand-stacks";
import { CardStack } from "./components/CardStack";
import { GameCard } from "./components/GameCard";
import { GameEventList } from "./components/GameEventLog";
import { FinalResults } from "./components/FinalResults";
import { PlayerBoard } from "./components/PlayerBoard";

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
});
const COLORS: CardColor[] = ["red", "yellow", "green", "blue"];
const SESSION_KEY = "stack-session";

type Session = { nickname: string; roomCode: string; playerId: string };

function readSession(): Session | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as Session) : null;
  } catch {
    return null;
  }
}

function visuallyPlayable(card: Card, state: PlayerView): boolean {
  if (state.currentPlayerId !== state.selfId) return false;
  if (state.pendingDrawPlay) {
    return state.pendingDrawPlay.cardId === card.id;
  }
  if (
    state.hand.length === 1 &&
    (card.kind === "wild" || card.kind === "wild-draw-four")
  ) {
    return false;
  }
  const chain = state.drawChain;
  if (chain) {
    if (card.kind === "draw-two") return chain.type === "DRAW_TWO";
    if (card.kind === "wild-draw-four") return chain.type === "DRAW_FOUR";
    if (card.kind === "skip" || card.kind === "reverse") {
      return card.color === chain.activeColor;
    }
    return false;
  }
  if (card.kind === "wild" || card.kind === "wild-draw-four") return true;
  const top = state.topDiscard;
  if (!top) return false;
  const faceMatch =
    card.kind === top.kind &&
    (card.kind !== "number" ||
      (top.kind === "number" && card.value === top.value));
  return card.color === state.activeColor || faceMatch;
}

export default function App() {
  const [nickname, setNickname] = useState(() => readSession()?.nickname ?? "");
  const [roomCode, setRoomCode] = useState("");
  const [session, setSession] = useState<Session | null>(readSession);
  const [state, setState] = useState<PlayerView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [wildPlay, setWildPlay] = useState<{
    cards: Card[];
    drawn: boolean;
  } | null>(null);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const saved = readSession();
      if (!saved) return;
      socket.emit(
        "join-room",
        {
          nickname: saved.nickname,
          roomCode: saved.roomCode,
          playerId: saved.playerId,
        },
        (result) => {
          if (!result.ok) {
            setError(result.error);
            setState(null);
          }
        },
      );
    };
    const onDisconnect = () => setConnected(false);
    const onState = (next: PlayerView) => {
      setState(next);
      setError("");
    };
    const onError = (message: string) => setError(message);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state-update", onState);
    socket.on("action-error", onError);
    if (socket.connected && session && !state) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state-update", onState);
      socket.off("action-error", onError);
    };
  }, []);

  const saveSession = (next: Session) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const createRoom = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    socket.emit("create-room", { nickname }, (result) => {
      setBusy(false);
      if (!result.ok) return setError(result.error);
      const next = { nickname: nickname.trim(), ...result.data };
      saveSession(next);
      setError("");
    });
  };

  const joinRoom = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const code = roomCode.trim().toUpperCase();
    socket.emit("join-room", { nickname, roomCode: code }, (result) => {
      setBusy(false);
      if (!result.ok) return setError(result.error);
      saveSession({ nickname: nickname.trim(), ...result.data });
      setError("");
    });
  };

  const action = (
    event: keyof Pick<
      ClientToServerEvents,
      | "start-game"
      | "draw-card"
      | "keep-drawn-card"
      | "accept-draw-chain"
      | "call-uno"
      | "restart-game"
    >,
  ) => {
    if (!session) return;
    setBusy(true);
    socket.emit(event, session, (result: Ack) => {
      setBusy(false);
      if (!result.ok) setError(result.error);
    });
  };

  const play = (
    cards: Card[],
    drawn = false,
    chosenColor?: CardColor,
  ) => {
    if (!session) return;
    const card = cards[0];
    if (!card) return;
    if (
      (card.kind === "wild" || card.kind === "wild-draw-four") &&
      !chosenColor
    ) {
      setWildPlay({ cards, drawn });
      return;
    }
    setBusy(true);
    const done = (result: Ack) => {
        setBusy(false);
        if (!result.ok) setError(result.error);
        else setWildPlay(null);
    };
    if (drawn) {
      socket.emit(
        "play-drawn-cards",
        {
          ...session,
          cardIds: cards.map((candidate) => candidate.id),
          chosenColor,
        },
        done,
      );
    } else {
      socket.emit(
        "play-cards",
        { ...session, cardIds: cards.map((candidate) => candidate.id), chosenColor },
        done,
      );
    }
  };

  const leave = () => {
    if (session) socket.emit("leave-room", session);
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setState(null);
    setRoomCode("");
  };

  if (!state) {
    return (
      <main className="home-shell min-h-dvh px-4 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl items-center">
          <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <section className="flex flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                Partidas em tempo real para a turma
              </div>
              <h1 className="brand-title text-7xl font-black tracking-tighter sm:text-9xl">
                STACK!
              </h1>
              <p className="mt-4 max-w-xl text-xl font-semibold text-indigo-100 sm:text-2xl">
                Crie uma sala ou entre na sala da sua turma. Combine cores,
                redirecione correntes e seja o primeiro a ficar sem cartas.
              </p>
              <div className="mt-8 flex gap-3 text-sm font-bold text-indigo-200">
                <span>2–12 jogadores</span><span>•</span><span>Sem cadastro</span><span>•</span><span>Funciona no celular</span>
              </div>
            </section>
            <section className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <label className="block text-sm font-black uppercase tracking-widest text-indigo-200">
                Seu nome
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={20}
                  placeholder="Ex.: Professora Ana"
                  className="field mt-2"
                />
              </label>
              <form onSubmit={createRoom} className="mt-6">
                <button className="primary-button w-full" disabled={busy || !connected}>
                  Criar sala
                </button>
              </form>
              <div className="my-6 flex items-center gap-3 text-xs font-black uppercase tracking-widest text-indigo-300">
                <span className="h-px flex-1 bg-white/15" />ou entre<span className="h-px flex-1 bg-white/15" />
              </div>
              <form onSubmit={joinRoom} className="flex gap-3">
                <input
                  value={roomCode}
                  onChange={(event) =>
                    setRoomCode(event.target.value.toUpperCase().slice(0, 4))
                  }
                  placeholder="CÓDIGO"
                  aria-label="Código da sala"
                  className="field min-w-0 flex-1 uppercase tracking-[.25em]"
                />
                <button className="secondary-button" disabled={busy || !connected}>
                  Entrar na sala
                </button>
              </form>
              {!connected && <p className="mt-4 text-sm font-bold text-amber-300">Conectando ao servidor da partida…</p>}
              {error && <ErrorBanner message={error} />}
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (state.phase === "lobby") {
    return <Lobby state={state} error={error} busy={busy} start={() => action("start-game")} leave={leave} />;
  }

  return (
    <GameTable
      state={state}
      error={error}
      busy={busy}
      connected={connected}
      wildPlay={wildPlay}
      closeWild={() => setWildPlay(null)}
      chooseWild={(color) =>
        wildPlay && play(wildPlay.cards, wildPlay.drawn, color)
      }
      play={play}
      draw={() => action("draw-card")}
      keepDrawn={() => action("keep-drawn-card")}
      accept={() => action("accept-draw-chain")}
      callUno={() => action("call-uno")}
      accuseUno={(targetPlayerId) => {
        if (!session) return;
        socket.emit("accuse-uno", { ...session, targetPlayerId }, (result) => {
          if (!result.ok) setError(result.error);
        });
      }}
      restart={() => action("restart-game")}
      leave={leave}
    />
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100">
      {message}
    </div>
  );
}

function Lobby({ state, error, busy, start, leave }: {
  state: PlayerView; error: string; busy: boolean; start: () => void; leave: () => void;
}) {
  const isHost = state.selfId === state.hostId;
  return (
    <main className="home-shell min-h-dvh px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <span className="text-3xl font-black tracking-tight">STACK!</span>
          <button onClick={leave} className="text-sm font-bold text-indigo-200 hover:text-white">Sair da sala</button>
        </header>
        <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 bg-black/10 p-6 text-center sm:p-9">
            <p className="text-sm font-black uppercase tracking-[.25em] text-indigo-200">Código da sala</p>
            <p className="mt-2 text-6xl font-black tracking-[.15em] sm:text-8xl">{state.roomCode}</p>
            <p className="mt-3 text-indigo-200">Compartilhe este código com a turma</p>
          </div>
          <div className="p-6 sm:p-9">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black">Jogadores</h2>
              <span className="rounded-full bg-lime-400/15 px-3 py-1 text-sm font-black text-lime-300">
                {state.players.filter((p) => p.connected).length} conectados
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {state.players.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-400 text-lg font-black">
                    {player.nickname[0]?.toUpperCase()}
                  </span>
                  <span className="font-bold">{player.nickname}</span>
                  {player.isHost && <span className="ml-auto rounded-full bg-amber-400 px-2 py-1 text-xs font-black text-amber-950">ANFITRIÃO</span>}
                </div>
              ))}
            </div>
            {error && <ErrorBanner message={error} />}
            {isHost ? (
              <button onClick={start} disabled={busy || state.players.filter((p) => p.connected).length < 2} className="primary-button mt-7 w-full">
                {state.players.length < 2 ? "Aguardando jogadores…" : "Iniciar partida"}
              </button>
            ) : (
              <p className="mt-7 text-center font-bold text-indigo-200">Aguardando o anfitrião iniciar a partida…</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type GameProps = {
  state: PlayerView; error: string; busy: boolean; connected: boolean;
  wildPlay: { cards: Card[]; drawn: boolean } | null;
  closeWild: () => void; chooseWild: (color: CardColor) => void;
  play: (cards: Card[], drawn?: boolean) => void; draw: () => void;
  keepDrawn: () => void; accept: () => void;
  callUno: () => void; accuseUno: (id: string) => void; restart: () => void; leave: () => void;
};

function GameTable(props: GameProps) {
  const [stackChoice, setStackChoice] = useState<CardStackView | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(
    () => new Set(props.state.events.map((event) => event.id)),
  );
  const { state } = props;
  const self = state.players.find((player) => player.id === state.selfId)!;
  const current = state.players.find((player) => player.id === state.currentPlayerId);
  const myTurn = state.currentPlayerId === state.selfId;
  const pendingDraw =
    state.pendingDrawPlay?.playerId === state.selfId
      ? state.hand.find((card) => card.id === state.pendingDrawPlay?.cardId) ?? null
      : null;
  const handStacks = useMemo(
    () => groupHandIntoStacks(state.hand),
    [state.hand],
  );
  const handGroups = useMemo(
    () => groupStacksByColor(handStacks),
    [handStacks],
  );
  const playable = useMemo(
    () => new Set(state.hand.filter((card) => visuallyPlayable(card, state)).map((card) => card.id)),
    [state],
  );
  const chooseStack = (stack: CardStackView) => {
    const pendingId = state.pendingDrawPlay?.cardId;
    if (pendingId) {
      if (!stack.cards.some((card) => card.id === pendingId)) return;
      if (stack.count === 1) {
        props.play(
          selectLegalPhysicalCards(stack, 1, state.hand.length, pendingId),
          true,
        );
        return;
      }
      setSelectedQuantity(1);
      setStackChoice(stack);
      return;
    }
    const legalQuantities = getLegalStackQuantities(
      stack,
      state.hand.length,
    );
    if (legalQuantities.length === 0) return;
    if (stack.count === 1) {
      props.play(selectLegalPhysicalCards(stack, 1, state.hand.length));
      return;
    }
    setSelectedQuantity(1);
    setStackChoice(stack);
  };
  const stackChoiceQuantities = stackChoice
    ? getLegalStackQuantities(
        stackChoice,
        state.hand.length,
        state.pendingDrawPlay?.cardId,
      )
    : [];
  const maximumStackQuantity = stackChoiceQuantities.at(-1) ?? 0;
  const unreadCount = state.events.filter(
    (event) => !seenEventIds.has(event.id),
  ).length;

  useEffect(() => {
    if (!historyOpen) return;
    setSeenEventIds(new Set(state.events.map((event) => event.id)));
  }, [historyOpen, state.events]);

  useEffect(() => {
    if (!historyOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyOpen]);

  const openHistory = () => {
    setSeenEventIds(new Set(state.events.map((event) => event.id)));
    setHistoryOpen(true);
  };

  return (
    <main className="table-shell min-h-dvh overflow-hidden text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <div><span className="text-2xl font-black">STACK!</span><span className="ml-3 text-sm font-bold text-white/60">SALA {state.roomCode}</span></div>
        <div className="flex items-center gap-2 sm:gap-3">
          {!props.connected && <span className="text-xs font-bold text-amber-300">Reconectando…</span>}
          <button
            type="button"
            aria-label={
              unreadCount > 0
                ? `Abrir histórico da partida, ${unreadCount} ${unreadCount === 1 ? "evento novo" : "eventos novos"}`
                : "Abrir histórico da partida"
            }
            onClick={openHistory}
            className="relative inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 text-sm font-black lg:hidden"
          >
            <span aria-hidden="true">☰</span>
            Histórico
            {unreadCount > 0 && (
              <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-lime-300 px-1.5 text-[11px] font-black text-lime-950">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button onClick={props.leave} className="text-sm font-bold text-white/60 hover:text-white">Sair</button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col px-3 pb-3 sm:px-6">
        <PlayerBoard
          players={state.players}
          selfId={state.selfId}
          onAccuseUno={props.accuseUno}
        />

        <section className="relative grid min-h-[300px] flex-1 place-items-center sm:min-h-[360px]">
          <div className="absolute left-0 top-3 hidden max-h-72 w-56 overflow-y-auto rounded-2xl bg-black/20 p-4 lg:block">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Histórico da partida</h3>
            <div className="mt-2">
              <GameEventList events={state.events} />
            </div>
          </div>

          <div className="text-center">
            <div className={`mx-auto mb-4 w-fit rounded-full px-5 py-2 text-sm font-black shadow-lg ${myTurn ? "bg-lime-400 text-lime-950" : "bg-white/10 text-white"}`}>
              {pendingDraw
                ? "Você pode jogar a carta comprada!"
                : state.pendingDrawPlay
                  ? `${current?.nickname ?? "O jogador"} está decidindo se joga a carta comprada`
                : state.drawChain
                ? myTurn ? `Defenda o +${state.drawChain.amount} ou compre as cartas` : `${current?.nickname} precisa responder ao +${state.drawChain.amount}`
                : myTurn ? "SUA VEZ" : `Vez de ${current?.nickname ?? "outro jogador"}`}
            </div>
            <div className="flex items-center justify-center gap-4 sm:gap-7">
              <div className="card-back grid h-40 w-28 place-items-center rounded-2xl border-[5px] border-white shadow-2xl sm:h-48 sm:w-32">
                <span className="rotate-[-12deg] text-2xl font-black">STACK!</span>
              </div>
              {state.topDiscard && <GameCard card={state.topDiscard} />}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <span className={`color-dot bg-${state.activeColor}`} />
              <span className="font-black">{state.activeColor ? COLOR_LABELS_PT_BR[state.activeColor] : "Sem cor"} em jogo</span>
              <span className="text-2xl" title="Direção da partida">{state.direction === 1 ? "↻" : "↺"}</span>
              {state.drawChain && <span className="penalty-badge">+{state.drawChain.amount}</span>}
            </div>
            {myTurn && (
              <div className="mt-5">
                {pendingDraw ? (
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => props.play([pendingDraw], true)}
                      disabled={props.busy}
                      className="primary-button"
                    >
                      Jogar carta comprada
                    </button>
                    <button
                      onClick={props.keepDrawn}
                      disabled={props.busy}
                      className="secondary-button"
                    >
                      Ficar com a carta / Encerrar turno
                    </button>
                  </div>
                ) : state.drawChain ? (
                  <button onClick={props.accept} disabled={props.busy} className="danger-button">COMPRAR {state.drawChain.amount}</button>
                ) : (
                  <button onClick={props.draw} disabled={props.busy} className="secondary-button">Comprar uma carta</button>
                )}
              </div>
            )}
          </div>
        </section>

        {props.error && <div className="mx-auto w-full max-w-xl"><ErrorBanner message={props.error} /></div>}
        <section className="mt-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <div><span className="font-black">{self.nickname}</span><span className="ml-2 text-sm font-bold text-white/50">{state.hand.length} {state.hand.length === 1 ? "carta" : "cartas"}</span></div>
            {state.hand.length === 1 && !state.selfUnoDeclared && (
              <button onClick={props.callUno} className="uno-button">UNO!</button>
            )}
            {state.hand.length === 1 && state.selfUnoDeclared && (
              <span className="rounded-full bg-lime-300/20 px-3 py-2 text-sm font-black text-lime-200">
                UNO declarado
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {handGroups.map((group) => (
              <section
                key={group.key}
                className="min-w-0 rounded-2xl border border-white/10 bg-white/[.04] p-3"
              >
                <header className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full border border-white/60 ${
                      group.key === "wild" ? "wild-card" : `bg-${group.key}`
                    }`}
                  />
                  <h3 className="truncate text-xs font-black uppercase tracking-wide text-white/85">
                    {group.label}
                  </h3>
                  <span className="ml-auto whitespace-nowrap text-[11px] font-bold text-white/50">
                    · {group.physicalCount} {group.physicalCount === 1 ? "carta" : "cartas"}
                  </span>
                </header>
                <div className="flex flex-wrap gap-x-3 gap-y-5 pb-1">
                  {group.stacks.map((stack) => {
                    const containsDrawnCard = stack.cards.some(
                      (card) => card.id === state.pendingDrawPlay?.cardId,
                    );
                    const hasLegalQuantity =
                      getLegalStackQuantities(
                        stack,
                        state.hand.length,
                        state.pendingDrawPlay?.cardId,
                      ).length > 0;
                    const stackPlayable =
                      hasLegalQuantity &&
                      stack.cards.some((card) => playable.has(card.id));
                    return (
                      <CardStack
                        key={stack.key}
                        stack={stack}
                        playable={stackPlayable}
                        selected={stackChoice?.key === stack.key}
                        containsDrawnCard={containsDrawnCard}
                        disabled={props.busy}
                        onClick={() => chooseStack(stack)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>

      {historyOpen && (
        <div
          className="fixed inset-0 z-30 grid cursor-pointer items-end bg-slate-950/70 lg:items-center"
          role="presentation"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-history-title"
            className="max-h-[80dvh] w-full cursor-auto overflow-hidden rounded-t-[2rem] border border-white/15 bg-[#1a2740] p-5 shadow-2xl lg:mx-auto lg:max-w-lg lg:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="game-history-title" className="text-2xl font-black">
                Histórico da partida
              </h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-black"
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[min(28rem,58dvh)] overflow-y-auto pr-1">
              <GameEventList events={state.events} />
            </div>
          </div>
        </div>
      )}

      {stackChoice && maximumStackQuantity > 0 && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-[#211d42] p-7 text-center shadow-2xl">
            <h2 className="text-3xl font-black">Jogar {cardDescriptionPtBr(stackChoice.card)}</h2>
            <p className="mt-2 text-indigo-200">
              Você tem {stackChoice.count} cartas iguais. Os efeitos serão acumulados.
            </p>
            <div className="mt-6 flex justify-center">
              <GameCard card={stackChoice.card} compact />
            </div>
            <div className="mt-6">
              <span className="text-sm font-black uppercase tracking-wide text-indigo-200">Quantidade</span>
              <div className="mx-auto mt-2 flex w-fit items-center gap-4 rounded-2xl border border-white/15 bg-black/20 p-2">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() => setSelectedQuantity((value) => Math.max(1, value - 1))}
                  disabled={selectedQuantity <= 1}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-2xl font-black disabled:opacity-30"
                >
                  −
                </button>
                <strong className="min-w-8 text-2xl">{selectedQuantity}</strong>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() => setSelectedQuantity((value) => Math.min(maximumStackQuantity, value + 1))}
                  disabled={selectedQuantity >= maximumStackQuantity}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-2xl font-black disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  props.play(
                    selectLegalPhysicalCards(
                      stackChoice,
                      selectedQuantity,
                      state.hand.length,
                      state.pendingDrawPlay?.cardId,
                    ),
                    !!state.pendingDrawPlay,
                  );
                  setStackChoice(null);
                }}
                className="primary-button"
              >
                Jogar {selectedQuantity} {selectedQuantity === 1 ? "carta" : "cartas"}
              </button>
              {maximumStackQuantity === stackChoice.count && (
                <button
                  onClick={() => {
                    props.play(
                      selectLegalPhysicalCards(
                        stackChoice,
                        maximumStackQuantity,
                        state.hand.length,
                        state.pendingDrawPlay?.cardId,
                      ),
                      !!state.pendingDrawPlay,
                    );
                    setStackChoice(null);
                  }}
                  className="secondary-button"
                >
                  Jogar todas ({maximumStackQuantity})
                </button>
              )}
            </div>
            {maximumStackQuantity < stackChoice.count && (
              <p className="mt-4 text-sm font-bold text-amber-200">
                Um coringa não pode ser a última carta da partida.
              </p>
            )}
            <button onClick={() => setStackChoice(null)} className="mt-5 text-sm font-bold text-white/60 hover:text-white">Cancelar</button>
          </div>
        </div>
      )}

      {props.wildPlay && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-[#211d42] p-7 text-center shadow-2xl">
            <h2 className="text-3xl font-black">Escolha uma cor</h2>
            <p className="mt-2 text-indigo-200">
              {props.wildPlay.cards.length > 1
                ? `Escolha uma cor para os ${props.wildPlay.cards.length} coringas.`
                : "A vez só avança depois que você escolher."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {COLORS.map((color) => <button key={color} onClick={() => props.chooseWild(color)} className={`color-choice card-${color}`}>{COLOR_LABELS_PT_BR[color]}</button>)}
            </div>
            <button onClick={props.closeWild} className="mt-5 text-sm font-bold text-white/60 hover:text-white">Cancelar</button>
          </div>
        </div>
      )}

      {state.phase === "finished" && state.result && (
        <FinalResults
          result={state.result}
          isHost={state.hostId === state.selfId}
          busy={props.busy}
          onRestart={props.restart}
        />
      )}
    </main>
  );
}
