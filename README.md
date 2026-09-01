# STACK!

STACK! is a polished, real-time multiplayer card game for classrooms. A teacher
creates a four-character room, students join with nicknames, and everyone plays
the same server-authoritative match from a phone or computer. No accounts or
database are required.

## Features

- 2–12 players with live Socket.IO synchronization
- Private hands: each client receives only its own cards and opponents' counts
- Conventional 108-card deck with discard recycling
- Skip, Reverse, Draw Two, Wild, and Wild Draw Four
- Custom locked-type draw chains with matching-color Skip/Reverse defenses
- Grouped identical-card plays with stacked action effects
- A server-controlled chance to play the drawn card with identical copies
- UNO declaration and server-authoritative accusation penalties
- Host transfer in the lobby, safe disconnect handling, and in-room rematches
- Responsive, touch-friendly interface for phones, desktops, and projectors
- Server-side validation for every gameplay action

## Stack

React, Vite, TypeScript, Tailwind CSS, Node.js, Express, Socket.IO, and Vitest.
The npm workspace contains `client` and `server` packages; shared serializable
types live in `shared`.

## Run locally

Node.js 20 or newer is recommended.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The backend runs on port 3001 and Vite proxies
Socket.IO and API traffic to it. Open additional browser windows (or devices
that can reach the development machine) to join the same room.

## Tests

```bash
npm test
```

The tests cover deck composition, turn movement, normal actions, final-card
rules, private serialization, recycling, draw-chain type locking, chain
defenses, and the complete five-player `+8` chain scenario.

## Production

```bash
npm run build
npm start
```

Express serves the built React app and Socket.IO from one origin. The service
listens on `0.0.0.0` and uses `PORT` when provided (otherwise 3001). Deploy the
repository as **one persistent Node service**; no separate static host, database,
or Docker setup is needed.

`GET /health` returns HTTP 200 for platform health checks.

### Railway

1. Create a new Railway project and deploy this Git repository as a **single
   service** (Nixpacks / Node).
2. **Root directory:** repository root (leave empty). Do not set `client` or
   `server` as the root.
3. **Build command:** `npm run build` (already in `railway.toml`).
4. **Start command:** `npm start` (already in `railway.toml`).
5. **Node:** 20 or newer. Railway can read `engines.node` (`>=20`) from the
   root `package.json`. Optionally set `NIXPACKS_NODE_VERSION=20`.
6. **Port:** do **not** hardcode a port. Railway injects `PORT`; the app binds
   to `0.0.0.0` and that value.
7. **Health check path:** `/health`.
8. **Replicas:** keep **1 instance**. Rooms live in memory; multiple replicas
   would split players across different servers.
9. **Variables:** none are required for the game. You may set
   `NODE_ENV=production`. Do **not** set `NPM_CONFIG_PRODUCTION=true` if that
   would skip `devDependencies` during the build (TypeScript/Vite are needed to
   compile).
10. Generate a public domain on the service. Socket.IO uses the same origin;
    students open that URL. No extra Socket.IO URL or CORS origin is required.

Local development is unchanged: `npm run dev` runs Vite (proxy to the API and
Socket.IO) and the backend separately. Production never uses that proxy.

## Rules used by this game

- The host goes first. Every connected player receives seven cards.
- A numeric colored card is always chosen as the initial discard.
- Match the active color or the top card's face; Wild cards match normally.
- Identical cards (same color and face) may be played together. Skip, Reverse,
  Draw Two, and Wild Draw Four effects stack once per physical card.
- After drawing one card during normal play, a playable drawn card may be
  played immediately, together with any number of identical copies, or kept to
  end the turn. Every grouped play must include the newly drawn physical card
  ID. Draw-chain penalties never receive this opportunity.
- A Wild or Wild Draw Four cannot be used as a player's final card.
- Draw Two and Draw Four chains are type-locked. During a chain, the target may
  stack the same draw type regardless of color, play a matching-color Skip or
  Reverse, or accept the entire penalty.
- A chain Reverse changes direction before choosing the next target.
- Wild Draw Four is allowed regardless of whether the player holds the active
  color.
- Reaching one card requires a fresh UNO declaration. A correct accusation
  makes the undeclared player draw two; a false accusation makes the accuser
  draw two. These administrative cards never create a draw chain or alter the
  turn.

Room codes are four uppercase characters generated from an alphabet that omits
easy-to-confuse `I`, `O`, `0`, and `1`. Codes are collision-checked against
active rooms.

## In-memory limitation

Rooms and matches exist only in server memory. Restarting or redeploying the
server destroys active rooms. This keeps the classroom MVP simple, but it also
means the service should run as a single instance (no horizontal scaling)
unless shared room storage is added later. An empty room is removed
immediately.
