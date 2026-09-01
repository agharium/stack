# STACK!

STACK! is a real-time multiplayer card game inspired by UNO, with custom house rules built for faster, more chaotic matches. Create a room, share the code, and play directly in the browser - no accounts required.

No accounts. No database. The server is authoritative: clients send intentions, and the backend decides whether a play is legal.

Supports multiplayer rooms with 2–12 players in the current implementation.

## Features

- Real-time Socket.IO multiplayer
- Create or join a room with a short 4-character code
- Private hands; opponents only see public card counts
- Always-visible player board (names, counts, whose turn it is)
- Standard UNO-style 108-card deck with discard recycling
- Custom draw-chain system (type-locked stacking plus Skip/Reverse defenses)
- Play multiple identical cards together; effects stack
- Immediate play of a just-drawn card, including matching copies
- UNO declaration and anytime accusation (server-authoritative)
- Match history / event log
- Final ranking by remaining cards after a win
- Rematches in the same room (host starts the next round)
- Responsive UI for mobile and desktop
- Server-side validation of every gameplay action

## Tech stack

React, Vite, TypeScript, Tailwind CSS, Node.js, Express, Socket.IO, and Vitest.

The repo is an npm workspace: `client`, `server`, and shared types in `shared`. In production a single Node process runs Express + Socket.IO and serves the built React app from the same origin.

## Run locally

Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The API and Socket.IO run on port 3001; Vite proxies them in development. Open extra browser windows (or other devices that can reach your machine) to join the same room.

## Tests

```bash
npm test
```

Coverage includes deck generation, turn movement, custom draw chains, grouped identical-card plays, UNO accusations, Wild final-card restrictions, public vs private serialization, and restart behavior.

## Production

```bash
npm run build
npm start
```

Express serves the React build and Socket.IO on one origin. The process binds to `0.0.0.0` and uses `PORT` (default 3001). `GET /health` returns HTTP 200. No extra static host or database is required.

### Railway

Deploy this repository as **one** Nixpacks/Node service from the **repo root**.

- Build: `npm run build`
- Start: `npm start`
- Node 20+ (`engines.node` is `>=20`; optional `NIXPACKS_NODE_VERSION=20`)
- Do not hardcode a port; Railway injects `PORT`
- Health check: `/health`
- **One replica** (rooms are in memory)
- Optional: `NODE_ENV=production`. Avoid `NPM_CONFIG_PRODUCTION=true` during build (TypeScript/Vite are needed to compile)
- Generate a public domain on the service. Socket.IO uses that same origin; no extra Socket.IO URL is required

`railway.toml` already sets build, start, and the health check.

## House rules

STACK! intentionally does not follow official UNO rules exactly. These house rules are part of the game.

### Basic play

- The host starts the match. Each connected player is dealt seven cards.
- The initial discard is always a numeric colored card.
- A card is playable if it matches the active color or the top card’s face/action. Wild cards are always playable (subject to the final-card restriction).
- Wild Draw Four may be played whenever a Wild would be legal. There is no “must have no matching color” restriction.

### Playing identical cards

Players may play several **exactly identical** cards in one move: same color and same face/action (for example three Green 4s, or two Red +2s). Wilds only group with the same Wild type.

Skip, Reverse, Draw Two, and Wild Draw Four effects apply **once per physical card**. Two Reverse cards flip direction twice (back to the original). Two Skip cards skip two turn positions.

### Drawing and immediate play

On a normal turn, drawing one card does **not** always end the turn. If that specific card is playable, the player may play it immediately, keep it and end the turn, or play it together with identical copies already in hand. A grouped post-draw play must include the newly drawn card. Accepting a draw-chain penalty never offers this option.

### Draw chains

Draw Two and Wild Draw Four start **separate, type-locked** chains.

- A Draw Two chain can only be increased by more Draw Twos (any color). Each card adds +2.
- A Draw Four chain can only be increased by more Wild Draw Fours. Each card adds +4. The chosen color becomes the chain’s active color.

While a chain is active, the targeted player may only:

- stack the same draw type
- play a Skip whose color matches the chain’s active color (penalty stays; threat moves to the next player)
- play a Reverse whose color matches the chain’s active color (penalty stays; direction flips; threat moves the new way — often back at the previous player)
- accept the full accumulated penalty and draw that many cards (then the chain ends and play continues)

### UNO

Everyone can see public card counts. When a player’s hand is exactly one card, they should declare UNO. Any opponent may accuse them **at any time** during the match — not only on a particular turn.

- Correct accusation (1 card, UNO not declared): that player draws 2.
- False accusation (any other case): the accuser draws 2.

These draws are administrative. They do not start a draw chain and do not change whose turn it is.

Declaring UNO is **not** required to win. If a player legally plays their last allowed colored card and reaches zero cards, they win immediately even if they never said UNO.

### Winning and rematches

Wild and Wild Draw Four cannot be the last card that empties a hand. Any legal colored card can win (number, Skip, Reverse, or Draw Two).

The match does **not** restart by itself. Everyone sees the winner and a ranking by remaining cards (fewer is better; ties share a place, e.g. 1, 2, 2, 4). Only the host can start another round in the same room (`Jogar novamente` / Play again).

Room codes are four uppercase characters. Confusing characters like `I`, `O`, `0`, and `1` are omitted.

## Public vs private game state

**Public:** player names, card counts, whose turn it is, host/connected status, game status, draw-chain info, events, and the final ranking.

**Private:** the actual cards in an opponent’s hand and those cards’ IDs. Each client only receives its own hand.

## In-memory limitation

Active rooms live only in server memory. Restarting or redeploying the process wipes every match. This keeps the current architecture simple. Run a **single instance**; empty rooms are deleted immediately. Persistence or shared room storage can be added later if you need multiple replicas.
