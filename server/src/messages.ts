export const ERRORS = {
  minimumPlayers: "São necessários pelo menos 2 jogadores conectados.",
  noStartingCard: "Não foi possível encontrar uma carta inicial.",
  currentPlayerUnavailable: "O jogador da vez não está disponível.",
  playerNotFound: "Jogador não encontrado.",
  noPlayers: "Não há jogadores na sala.",
  noConnectedPlayer: "Não há outro jogador conectado.",
  noDiscard: "Não há uma carta na pilha de descarte.",
  cardNotPlayable: "Essa carta não pode ser jogada agora.",
  onlyDrawFour: "A corrente atual só aceita cartas Coringa +4.",
  onlyDrawTwo: "A corrente atual só aceita cartas +2.",
  defendDrawTwo:
    "Defenda com +2, Bloquear ou Voltar da cor atual da corrente.",
  defendDrawFour:
    "Defenda com Coringa +4, Bloquear ou Voltar da cor atual da corrente.",
  chooseCard: "Selecione pelo menos uma carta.",
  duplicateCard: "Uma mesma carta não pode ser selecionada mais de uma vez.",
  cardNotOwned: "Todas as cartas selecionadas devem estar na sua mão.",
  cardsNotIdentical: "As cartas selecionadas precisam ser exatamente iguais.",
  drawnCardRequired:
    "A jogada após a compra precisa incluir a carta que acabou de ser comprada.",
  wildFinish: "Você não pode terminar a partida com um coringa.",
  chooseColor: "Escolha uma cor para o coringa.",
  acceptPenalty: "Aceite a corrente e compre todas as cartas.",
  resolveDrawn: "Jogue ou guarde a carta que acabou de comprar primeiro.",
  noPendingDrawnPlay: "Não há uma carta comprada aguardando para ser jogada.",
  noPendingDrawnKeep: "Não há uma carta comprada aguardando sua decisão.",
  noDrawPenalty: "Não há uma corrente de compra para aceitar.",
  noUnoNeeded: "Você não precisa gritar UNO agora.",
  noLongerAtUnoCount: "Você não está mais com uma carta.",
  unoAlreadyDeclared: "Você já declarou UNO.",
  unoAlreadyDeclaredByTarget: "Esse jogador já declarou UNO.",
  targetNoLongerAtUnoCount: "Esse jogador não está mais com uma carta.",
  catchSelf: "Você não pode denunciar a si mesmo.",
  spyOnlyAccuse:
    "Apenas o espião pode acusar outro jogador de não ter falado UNO.",
  disconnected: "Você está desconectado.",
  gameNotStarted: "A partida ainda não começou.",
  gameFinished: "A partida já terminou.",
  notYourTurn: "Não é a sua vez.",
  noCardsToDraw: "Não há cartas disponíveis para comprar.",
  noCardsToRecycle: "Não há cartas disponíveis para reciclar.",
  inactiveSession: "Esta sessão de jogador não está ativa.",
  hostStartOnly: "Somente o anfitrião pode iniciar a partida.",
  hostRestartOnly: "Somente o anfitrião pode iniciar uma nova partida.",
  gameNotOver: "A partida atual ainda não terminou.",
  nicknameLength: "O nome deve ter entre 2 e 20 caracteres.",
  invalidRoomCode: "Digite um código de sala válido.",
  roomNotFound: "Sala não encontrada.",
  matchStarted: "Esta partida já começou.",
  roomFull: "A sala está cheia.",
  nicknameTaken: "Esse nome já está sendo usado na sala.",
  notInRoom: "Você não pertence a esta sala.",
  unexpected: "Algo deu errado. Tente novamente.",
} as const;

export function chainColorMismatch(kind: "skip" | "reverse"): string {
  return kind === "skip"
    ? "Esse Bloquear não corresponde à cor atual da corrente."
    : "Esse Voltar não corresponde à cor atual da corrente.";
}
