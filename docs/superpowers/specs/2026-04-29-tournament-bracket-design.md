# Tournament Bracket API — Design Spec

**Date:** 2026-04-29
**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Neon PostgreSQL, react-brackets

---

## Overview

A tournament bracket system for a Roblox game. The Roblox game server creates tournaments, reports match winners via HTTP, and a Next.js web frontend displays the bracket updating in real time via Server-Sent Events.

---

## Data Model

Three tables in Neon PostgreSQL, created via raw SQL using `@neondatabase/serverless`.

### `tournaments`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key, gen_random_uuid() |
| name | TEXT | Tournament display name |
| status | TEXT | `active` \| `complete` — set to `active` on creation, `complete` when the final match has a winner |
| created_at | TIMESTAMPTZ | Default now() |

### `players`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| tournament_id | UUID | FK → tournaments.id |
| name | TEXT | Player display name |
| seed | INT | 1-indexed seeding order |

### `matches`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| tournament_id | UUID | FK → tournaments.id |
| round | INT | 1 = first round, increases toward final |
| position | INT | Match index within round (0-based), determines visual order |
| player1_id | UUID\|null | FK → players.id, null = bye slot |
| player2_id | UUID\|null | FK → players.id, null = bye slot |
| winner_id | UUID\|null | FK → players.id, null = not yet played |
| next_match_id | UUID\|null | FK → matches.id, null = this is the final |

`next_match_id` wires the bracket tree: when a match is won, the winner is written into the `player1_id` or `player2_id` of the linked next match. Slot assignment is deterministic: even `position` matches (0, 2, 4…) write their winner as `player1_id`; odd position matches (1, 3, 5…) write as `player2_id`.

---

## API Routes

All routes live under `/api`. Routes marked **[protected]** require an `x-api-key` header matching `process.env.API_KEY`.

### `POST /api/tournaments` [protected]
Creates a tournament, seeds players, generates all match slots, and auto-resolves byes.

**Request body:**
```json
{ "name": "Grand Tournament", "players": ["Alice", "Bob", "Charlie", "Dave", "Eve"] }
```

**Response:**
```json
{ "tournamentId": "<uuid>", "bracket": { ...full bracket state } }
```

### `GET /api/tournaments/:id`
Returns full bracket state including all rounds, matches, player names, and winners. Used by the frontend on initial load. No auth required (read-only).

### `POST /api/matches/:id/winner` [protected]
Called by the Roblox game server to report a match result.

**Request body:**
```json
{ "winnerId": "<player-uuid>" }
```

Sets `winner_id` on the match, advances the winner into the correct slot of `next_match_id`, marks the tournament `complete` if it was the final, and broadcasts an SSE event to all connected browser clients watching that tournament.

### ~~`GET /api/tournaments/:id/stream`~~
Not implemented. Replaced by Pusher WebSocket delivery — see Real-Time Updates section.

---

## Bracket Generation Algorithm

Executed inside `POST /api/tournaments`:

1. Shuffle players and assign seeds 1–N
2. `bracketSize` = next power of 2 ≥ N (e.g. 6 players → 8)
3. `byeCount` = bracketSize − N (top seeds receive byes)
4. Generate round 1 matches using standard bracket seeding: seed 1 vs seed `bracketSize`, seed 2 vs seed `bracketSize − 1`, etc. Bye opponents are `null`
5. Generate empty match slots for all subsequent rounds upfront, linked via `next_match_id`
6. Auto-complete bye matches: write the real player as `winner_id` and populate their slot in the linked next match immediately

The full bracket skeleton exists in the DB from creation. Subsequent winner reports only need to: set `winner_id`, write winner into next match's `player1_id` or `player2_id`, broadcast SSE.

---

## Real-Time Updates (Pusher)

The app runs on Vercel's serverless environment. Serverless function invocations are stateless — an in-process SSE subscriber Map would not persist between requests. Pusher is used instead: it is a managed WebSocket service with a generous free tier (100 concurrent connections, 200k messages/day).

**Server side (`lib/pusher.ts`):** Initialises a `Pusher` server client using `PUSHER_APP_ID`, `NEXT_PUBLIC_PUSHER_KEY`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_CLUSTER`. When `POST /api/matches/:id/winner` completes, it calls `pusherServer.trigger('tournament-{id}', 'bracket-update', bracketState)`.

**Client side (`BracketView.tsx`):** Uses `pusher-js` to subscribe to the `tournament-{id}` channel and bind to the `bracket-update` event. On each event, React state is replaced wholesale with the full bracket payload.

The `GET /api/tournaments/:id/stream` SSE endpoint is not needed and is not implemented.

---

## Frontend

**Route:** `/tournament/[id]`

- On mount: fetches `GET /api/tournaments/:id` for initial bracket state
- Opens `EventSource` to `GET /api/tournaments/:id/stream`
- On each SSE message: parses JSON and replaces React state
- Transforms bracket state into `react-brackets` `Round[]` shape:
  ```ts
  { title: "Round 1", seeds: [{ id, teams: [{ name }, { name }] }] }
  ```
- Winner highlighting: uses `react-brackets` seed render prop to style the winning team
- The page is a read-only spectator view — no controls

**No admin UI is included.** Tournament creation and match reporting are done exclusively via API (Roblox HttpService or curl/Postman).

---

## Authentication

A single `API_KEY` environment variable. Protected endpoints check the `x-api-key` request header against this value and return `401` if missing or mismatched. The key is set in `.env.local` and configured in the Roblox game script's HttpService headers.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string (pooled) |
| `API_KEY` | Shared secret for protected endpoints |
| `PUSHER_APP_ID` | Pusher app ID (server only) |
| `PUSHER_SECRET` | Pusher secret (server only) |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher public key (client + server) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher cluster, e.g. `us2` (client + server) |

---

## Out of Scope

- Double elimination / round robin formats
- Per-tournament API keys
- Match scheduling or timers
- WebSocket alternatives (Ably, Upstash Redis pub/sub)
- Admin dashboard UI
