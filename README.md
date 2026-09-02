# STACK!

STACK! is a real-time multiplayer card game inspired by UNO, with custom house rules built for faster, more chaotic matches. Create a room, share the code, and play directly in the browser.

**Accounts are optional.** Anyone can play as a guest without signing up. Registered accounts save persistent leaderboard statistics and let you manage a profile.

The server is authoritative: clients send intentions, and the backend decides whether a play is legal.

Supports multiplayer rooms with 2-12 players in the current implementation.

## Features

- Real-time Socket.IO multiplayer
- Optional accounts with profile management and global ranking
- Guest play without registration
- Create or join a room with a short 4-character code
- Private hands; opponents only see exact counts if they are the current Spy
- Always-visible player board (names, UNO signal, whose turn it is, spy marker)
- Standard UNO-style 108-card deck with discard recycling
- Custom draw-chain system (type-locked stacking plus Skip/Reverse defenses)
- Play multiple identical cards together; effects stack
- Immediate play of a just-drawn card, including matching copies
- UNO declaration and Espião-only accusation (server-authoritative race)
- Match history / event log
- Final ranking by remaining cards after a win
- Completed match persistence in PostgreSQL (accounts and results only)
- Rematches in the same room (host starts the next round)
- Responsive UI for mobile and desktop
- Server-side validation of every gameplay action

## Accounts

STACK! does not require an account to play. Accounts are optional and are used to save persistent leaderboard statistics and manage a profile.

**Guest**

- Chooses a display name on the home screen
- Full gameplay (create/join rooms, win, rematch, Spy, UNO)
- No persistent leaderboard identity

**Registered**

- Uses the public `name` from the profile in rooms and matches
- Completed match results count toward the global ranking
- Can edit name, username, and password on the profile screen

## Privacy

- `name` is public (lobby, board, history, winner screen, ranking)
- `username` is private (login and your own profile only)
- Passwords are stored as secure hashes and never returned by any API

Username changes do not affect rankings or history because all persistent relations use stable `User.id`.

## PostgreSQL

PostgreSQL stores:

- User accounts
- Completed matches and per-player results

PostgreSQL does **not** store active gameplay (hands, turns, draw chains, Spy rotation, UNO actions, or room state). Active rooms and matches remain in server memory.

## Ranking

The global leaderboard is based only on match victories. Every authenticated match win counts as one victory. Other finishing positions do not award points.

- **Vitórias** — primary ranking value (descending)
- **Partidas** — games played (informational; fewer games is only a tie-breaker)
- **Taxa de vitória** — informational only; does not affect order

Only results linked to a registered account count toward the leaderboard. Guest results are saved for match history integrity but excluded from aggregation.

The end-of-match screen may still list players by remaining cards for that game. That visual summary is separate from the persistent highscore.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, Node.js, Express, Socket.IO, PostgreSQL, Prisma, and Vitest.

The repo is an npm workspace: `client`, `server`, and shared types in `shared`. In production a single Node process runs Express + Socket.IO and serves the built React app from the same origin.

## Run locally

Node.js 20 or newer.

```bash
cp .env.example .env
# Set DATABASE_URL to your local PostgreSQL instance
npm install
npm run db:generate
npm run db:migrate:dev
npm run dev
```

Open `http://localhost:3000`. The API and Socket.IO run on port 3001; Vite proxies them in development.

Guest play works without PostgreSQL. Login, registration, profile, ranking, and match persistence require a working `DATABASE_URL`.

## Database scripts

```bash
npm run db:generate   # prisma generate
npm run db:migrate:dev # development migrations
npm run db:deploy      # production migrations (Railway pre-deploy)
npm run db:studio      # Prisma Studio
```

## Tests

```bash
npm test
```

## Production

```bash
npm run build
npm start
```

Express serves the React build and Socket.IO on one origin. The process binds to `0.0.0.0` and uses `PORT` (default 3001). `GET /health` returns HTTP 200.

Set `DATABASE_URL` and `SESSION_SECRET` in production.

### Railway

Deploy this repository as **one** Nixpacks/Node service from the **repo root**, with PostgreSQL in the same Railway project.

1. Add a **PostgreSQL** service to the project.
2. On the **stack** app service, reference `DATABASE_URL` from the PostgreSQL service (Railway variable reference).
3. Set `SESSION_SECRET` to a long random string.
4. Optional: `NODE_ENV=production`.
5. `railway.toml` runs `npm run build`, `npm run db:deploy` before start, then `npm start`.
6. Generate a public domain on the app service. Socket.IO uses that same origin.

- Build: `npm run build`
- Pre-deploy: `npm run db:deploy`
- Start: `npm start`
- Node 20+ (`engines.node` is `>=20`)
- Health check: `/health`
- **One replica** for the app service (active rooms are in memory)

## House rules

STACK! intentionally does not follow official UNO rules exactly. These house rules are part of the game.

### Basic play

- The host starts the match. Player order is randomized at the beginning of each match. Each connected player is dealt seven cards.
- The initial discard is always a numeric colored card.
- A card is playable if it matches the active color or the top card's face/action. Wild cards are always playable (subject to the final-card restriction).
- Wild Draw Four may be played whenever a Wild would be legal. There is no "must have no matching color" restriction.

### Playing identical cards

Players may play several **exactly identical** cards in one move: same color and same face/action (for example three Green 4s, or two Red +2s). Wilds only group with the same Wild type.

Skip, Reverse, Draw Two, and Wild Draw Four effects apply **once per physical card**. Two Reverse cards flip direction twice (back to the original). Two Skip cards skip two turn positions.

### Drawing and immediate play

On a normal turn, drawing one card does **not** always end the turn. If that specific card is playable, the player may play it immediately, keep it and end the turn, or play it together with identical copies already in hand. A grouped post-draw play must include the newly drawn card. Accepting a draw-chain penalty never offers this option.

### Draw chains

Draw Two and Wild Draw Four start **separate, type-locked** chains.

- A Draw Two chain can only be increased by more Draw Twos (any color). Each card adds +2.
- A Draw Four chain can only be increased by more Wild Draw Fours. Each card adds +4. The chosen color becomes the chain's active color.

While a chain is active, the targeted player may only:

- stack the same draw type
- play a Skip whose color matches the chain's active color (penalty stays; threat moves to the next player)
- play a Reverse whose color matches the chain's active color (penalty stays; direction flips; threat moves the new way ? often back at the previous player)
- accept the full accumulated penalty and draw that many cards (then the chain ends and play continues)

### UNO

Opponent hand sizes are normally hidden. One randomly selected **Espião** temporarily sees everyone's remaining card counts for one full table cycle. Every player becomes Espião once before the selection pool resets. Only the current Espião may accuse another player of failing to declare UNO.

When a player reaches one card, they race to declare UNO with `Tô de UNO!` before the current Espião catches them with `Não falou UNO!`. If the player declares first, they are safe. If the Espião accuses first, the player draws two cards. UNO declaration and accusation are resolved authoritatively by server processing order.

- Successful accusation (1 card, UNO not declared): target draws 2.
- Stale accusation after UNO was declared: rejected with no penalty.
- Stale UNO declaration after a successful accusation: rejected with no effect.

These draws are administrative. They do not start a draw chain and do not change whose turn it is.

Declaring UNO is **not** required to win. If a player legally plays their last allowed colored card and reaches zero cards, they win immediately even if they never said UNO.

### Winning and rematches

Wild and Wild Draw Four cannot be the last card that empties a hand. Any legal colored card can win (number, Skip, Reverse, or Draw Two).

The match does **not** restart by itself. Everyone sees the winner and a ranking by remaining cards (fewer is better; ties share a place, e.g. 1, 2, 2, 4). Only the host can start another round in the same room (`Jogar novamente` / Play again).

Room codes are four uppercase characters. Confusing characters like `I`, `O`, `0`, and `1` are omitted.

## Public vs private game state

**Public:** player names, whose turn it is, host/connected status, current Espião, whether a player is at UNO count (one card), game status, draw-chain info, events, and the final ranking (including card counts).

**Private:** exact opponent card counts (except for the current Espião), the actual cards in an opponent's hand, those cards' IDs, whether opponents declared UNO, usernames, and password hashes. Each client only receives its own hand.

## In-memory limitation

Active rooms live only in server memory. Restarting or redeploying the process wipes every in-progress match. Completed results remain in PostgreSQL. Run a **single app replica**; empty rooms are deleted immediately.
