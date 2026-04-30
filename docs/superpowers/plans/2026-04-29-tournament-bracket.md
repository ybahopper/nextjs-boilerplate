# Tournament Bracket API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-elimination tournament bracket API for a Roblox game with a real-time Next.js frontend, backed by Neon PostgreSQL and Pusher for live updates.

**Architecture:** Next.js 16 App Router API routes backed by Neon PostgreSQL via `@neondatabase/serverless` (HTTP transport). Bracket structure is generated upfront at tournament creation. Roblox reports match winners via authenticated POST requests. Real-time browser updates use Pusher WebSockets — SSE was ruled out because the app runs on Vercel serverless where in-process state does not survive between function invocations.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, @neondatabase/serverless, pusher (server SDK), pusher-js (client SDK), react-brackets, Vitest

---

> **Before implementing any Next.js route handler:** run `npm install` first, then check `node_modules/next/dist/docs/` for breaking changes in App Router route handlers — particularly async `params`, Response APIs, and any deprecation notices.

---

## File Map

| File | Responsibility |
|---|---|
| `types/tournament.ts` | Shared TypeScript interfaces: Tournament, Player, Match, BracketState |
| `lib/schema.sql` | SQL DDL — run once in Neon console |
| `lib/db.ts` | Neon SQL client singleton |
| `lib/auth.ts` | API key validation helper |
| `lib/bracket.ts` | Pure bracket generation logic (no DB, fully testable) |
| `lib/queries.ts` | `getBracketState()` — fetches full bracket from DB |
| `lib/pusher.ts` | Pusher server client |
| `lib/auth.test.ts` | Unit tests for auth helper |
| `lib/bracket.test.ts` | Unit tests for bracket generation |
| `vitest.config.ts` | Vitest configuration |
| `app/api/tournaments/route.ts` | `POST /api/tournaments` |
| `app/api/tournaments/[id]/route.ts` | `GET /api/tournaments/:id` |
| `app/api/matches/[id]/winner/route.ts` | `POST /api/matches/:id/winner` |
| `app/tournament/[id]/page.tsx` | Server component — passes tournament ID to client |
| `app/tournament/[id]/BracketView.tsx` | Client component — Pusher subscription + react-brackets render |

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install all packages**

```bash
npm install
npm install @neondatabase/serverless react-brackets pusher pusher-js
npm install -D vitest
```

Expected: packages added to `node_modules` and `package-lock.json` updated. If `react-brackets` reports peer dependency warnings with React 19, check its README for a resolution.

- [ ] **Step 2: Add test script to `package.json`**

Add `"test": "vitest run"` to the `scripts` block:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Verify Vitest runs**

```bash
npm test
```

Expected: `No test files found` — correct, no tests written yet.

- [ ] **Step 5: Check the Next.js 16 docs**

```bash
ls node_modules/next/dist/docs/
```

Read any files relating to App Router route handlers before continuing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: install dependencies and configure vitest"
```

---

## Task 2: Environment variables

**Files:**
- Create: `.env.local.example`
- Create: `.env.local` (fill in real values, never committed)

- [ ] **Step 1: Create `.env.local.example`**

```bash
# Neon PostgreSQL — use the POOLED connection string from Neon dashboard
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require

# API key — any random secret; use the same value in Roblox HttpService header x-api-key
API_KEY=replace-with-a-random-secret

# Pusher — from your Pusher app dashboard at https://pusher.com (free tier is sufficient)
PUSHER_APP_ID=your-app-id
PUSHER_SECRET=your-secret
NEXT_PUBLIC_PUSHER_KEY=your-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

- [ ] **Step 2: Copy to `.env.local` and fill in real values**

Neon: dashboard → your project → Connection Details → select "Pooled connection" → copy string.
Pusher: create free account → New App → App Keys tab.

```bash
cp .env.local.example .env.local
# Edit .env.local with actual values
```

- [ ] **Step 3: Confirm `.env.local` is gitignored**

```bash
grep '\.env\.local' .gitignore
```

Expected: a matching line. If missing, add `.env.local` to `.gitignore`.

- [ ] **Step 4: Commit example file only**

```bash
git add .env.local.example
git commit -m "chore: add environment variable template"
```

---

## Task 3: TypeScript types

**Files:**
- Create: `types/tournament.ts`

- [ ] **Step 1: Create `types/tournament.ts`**

```typescript
export interface Tournament {
  id: string;
  name: string;
  status: 'active' | 'complete';
  createdAt: string;
}

export interface Player {
  id: string;
  tournamentId: string;
  name: string;
  seed: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
}

export interface BracketState {
  tournament: Tournament;
  players: Player[];
  matches: Match[];
}
```

- [ ] **Step 2: Commit**

```bash
git add types/tournament.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Database schema

**Files:**
- Create: `lib/schema.sql`

- [ ] **Step 1: Create `lib/schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tournaments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id            UUID NOT NULL PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  seed          INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id            UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         INT  NOT NULL,
  position      INT  NOT NULL,
  player1_id    UUID REFERENCES players(id),
  player2_id    UUID REFERENCES players(id),
  winner_id     UUID REFERENCES players(id),
  next_match_id UUID REFERENCES matches(id)
);
```

- [ ] **Step 2: Run schema in Neon console**

1. Go to your Neon project → **SQL Editor**
2. Paste the entire contents of `lib/schema.sql`
3. Click **Run**
4. Open the **Tables** tab and confirm `tournaments`, `players`, `matches` appear

- [ ] **Step 3: Commit**

```bash
git add lib/schema.sql
git commit -m "feat: add database schema"
```

---

## Task 5: DB client

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: Create `lib/db.ts`**

```typescript
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);
```

- [ ] **Step 2: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add Neon database client"
```

---

## Task 6: Auth helper (TDD)

**Files:**
- Create: `lib/auth.test.ts`
- Create: `lib/auth.ts`

- [ ] **Step 1: Write failing tests in `lib/auth.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateApiKey } from './auth';

describe('validateApiKey', () => {
  beforeAll(() => { process.env.API_KEY = 'secret-test-key'; });
  afterAll(() => { delete process.env.API_KEY; });

  it('returns true when header matches API_KEY', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-api-key': 'secret-test-key' },
    });
    expect(validateApiKey(req)).toBe(true);
  });

  it('returns false when header does not match', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(validateApiKey(req)).toBe(false);
  });

  it('returns false when header is absent', () => {
    const req = new Request('http://localhost');
    expect(validateApiKey(req)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test
```

Expected: `Error: Failed to resolve import "./auth"`

- [ ] **Step 3: Create `lib/auth.ts`**

```typescript
export function validateApiKey(request: Request): boolean {
  return request.headers.get('x-api-key') === process.env.API_KEY;
}

export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test
```

Expected:
```
✓ lib/auth.test.ts (3)
Test Files  1 passed (1)
Tests  3 passed (3)
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat: add API key auth helper"
```

---

## Task 7: Bracket generation (TDD)

**Files:**
- Create: `lib/bracket.test.ts`
- Create: `lib/bracket.ts`

- [ ] **Step 1: Write failing tests in `lib/bracket.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateBracket, nextPowerOf2 } from './bracket';

describe('nextPowerOf2', () => {
  it('returns 2 for 2', () => expect(nextPowerOf2(2)).toBe(2));
  it('returns 4 for 3', () => expect(nextPowerOf2(3)).toBe(4));
  it('returns 4 for 4', () => expect(nextPowerOf2(4)).toBe(4));
  it('returns 8 for 5', () => expect(nextPowerOf2(5)).toBe(8));
  it('returns 8 for 8', () => expect(nextPowerOf2(8)).toBe(8));
  it('returns 16 for 9', () => expect(nextPowerOf2(9)).toBe(16));
});

describe('generateBracket', () => {
  it('throws for fewer than 2 players', () => {
    expect(() => generateBracket(['Alice'])).toThrow('Need at least 2 players');
  });

  it('assigns unique seeds 1 through N', () => {
    const { players } = generateBracket(['A', 'B', 'C', 'D', 'E', 'F']);
    const seeds = players.map(p => p.seed).sort((a, b) => a - b);
    expect(seeds).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('creates 3 matches for 4 players (bracketSize=4)', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D']);
    expect(matches).toHaveLength(3);
  });

  it('creates 7 matches for 5 players (bracketSize=8)', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D', 'E']);
    expect(matches).toHaveLength(7);
  });

  it('creates 7 matches for 8 players (bracketSize=8)', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(matches).toHaveLength(7);
  });

  it('auto-resolves 3 byes in round 1 for 5 players', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D', 'E']);
    const round1 = matches.filter(m => m.round === 1);
    const byeMatches = round1.filter(m => m.player1Id === null || m.player2Id === null);
    expect(byeMatches).toHaveLength(3);
    expect(byeMatches.every(m => m.winnerId !== null)).toBe(true);
  });

  it('bye winners are placed into round 2 player slots', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D', 'E']);
    const byeWinners = matches
      .filter(m => m.round === 1 && (m.player1Id === null || m.player2Id === null))
      .map(m => m.winnerId!);
    const round2Players = matches
      .filter(m => m.round === 2)
      .flatMap(m => [m.player1Id, m.player2Id])
      .filter(Boolean);
    expect(byeWinners.every(w => round2Players.includes(w))).toBe(true);
  });

  it('non-final matches have nextMatchId set', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D']);
    const maxRound = Math.max(...matches.map(m => m.round));
    const nonFinal = matches.filter(m => m.round < maxRound);
    expect(nonFinal.every(m => m.nextMatchId !== null)).toBe(true);
  });

  it('final match has null nextMatchId', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D']);
    const maxRound = Math.max(...matches.map(m => m.round));
    const final = matches.find(m => m.round === maxRound && m.position === 0)!;
    expect(final.nextMatchId).toBeNull();
  });

  it('power-of-2 count produces no byes', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D']);
    const round1 = matches.filter(m => m.round === 1);
    expect(round1.every(m => m.player1Id !== null && m.player2Id !== null)).toBe(true);
    expect(round1.every(m => m.winnerId === null)).toBe(true);
  });

  it('handles 2 players (minimum)', () => {
    const { players, matches } = generateBracket(['A', 'B']);
    expect(players).toHaveLength(2);
    expect(matches).toHaveLength(1);
    expect(matches[0].nextMatchId).toBeNull();
    expect(matches[0].player1Id).not.toBeNull();
    expect(matches[0].player2Id).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test
```

Expected: `Error: Failed to resolve import "./bracket"`

- [ ] **Step 3: Create `lib/bracket.ts`**

```typescript
export interface GeneratedPlayer {
  id: string;
  name: string;
  seed: number;
}

export interface GeneratedMatch {
  id: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
}

export interface GeneratedBracket {
  players: GeneratedPlayer[];
  matches: GeneratedMatch[];
}

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function generateBracket(playerNames: string[]): GeneratedBracket {
  if (playerNames.length < 2) throw new Error('Need at least 2 players');

  const n = playerNames.length;
  const bracketSize = nextPowerOf2(n);
  const totalRounds = Math.log2(bracketSize);

  const shuffled = [...playerNames].sort(() => Math.random() - 0.5);
  const players: GeneratedPlayer[] = shuffled.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    seed: i + 1,
  }));

  // Build match grid indexed 1..totalRounds
  const matchGrid: GeneratedMatch[][] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const count = bracketSize / Math.pow(2, round);
    matchGrid[round] = Array.from({ length: count }, (_, pos) => ({
      id: crypto.randomUUID(),
      round,
      position: pos,
      player1Id: null,
      player2Id: null,
      winnerId: null,
      nextMatchId: null,
    }));
  }

  // Wire next_match_id: winner of match at position p feeds floor(p/2) of next round
  for (let round = 1; round < totalRounds; round++) {
    for (const match of matchGrid[round]) {
      match.nextMatchId = matchGrid[round + 1][Math.floor(match.position / 2)].id;
    }
  }

  // Fill round 1: pair slot i vs slot (bracketSize-1-i)
  // Seeds 1..n occupy slots 0..n-1; remaining slots are null (byes)
  const round1 = matchGrid[1];
  for (let i = 0; i < round1.length; i++) {
    round1[i].player1Id = i < n ? players[i].id : null;
    round1[i].player2Id = (bracketSize - 1 - i) < n ? players[bracketSize - 1 - i].id : null;
  }

  // Auto-complete bye matches and advance winners into round 2
  for (const match of round1) {
    const isBye = match.player1Id === null || match.player2Id === null;
    if (!isBye) continue;

    match.winnerId = match.player1Id ?? match.player2Id;

    if (match.nextMatchId && totalRounds > 1) {
      const next = matchGrid[2].find(m => m.id === match.nextMatchId)!;
      if (match.position % 2 === 0) {
        next.player1Id = match.winnerId;
      } else {
        next.player2Id = match.winnerId;
      }
    }
  }

  const allMatches: GeneratedMatch[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    allMatches.push(...matchGrid[round]);
  }

  return { players, matches: allMatches };
}
```

- [ ] **Step 4: Run — expect all PASS**

```bash
npm test
```

Expected:
```
✓ lib/auth.test.ts (3)
✓ lib/bracket.test.ts (11)
Test Files  2 passed (2)
Tests  14 passed (14)
```

- [ ] **Step 5: Commit**

```bash
git add lib/bracket.ts lib/bracket.test.ts
git commit -m "feat: add bracket generation logic"
```

---

## Task 8: Shared query helper

**Files:**
- Create: `lib/queries.ts`

- [ ] **Step 1: Create `lib/queries.ts`**

```typescript
import { sql } from './db';
import type { BracketState } from '../types/tournament';

export async function getBracketState(tournamentId: string): Promise<BracketState | null> {
  const rows = await sql`
    SELECT id, name, status, created_at FROM tournaments WHERE id = ${tournamentId}
  `;
  if (rows.length === 0) return null;
  const t = rows[0];

  const players = await sql`
    SELECT id, tournament_id, name, seed
    FROM players
    WHERE tournament_id = ${tournamentId}
    ORDER BY seed
  `;

  const matches = await sql`
    SELECT id, tournament_id, round, position,
           player1_id, player2_id, winner_id, next_match_id
    FROM matches
    WHERE tournament_id = ${tournamentId}
    ORDER BY round, position
  `;

  return {
    tournament: {
      id: t.id,
      name: t.name,
      status: t.status,
      createdAt: t.created_at,
    },
    players: players.map((p: any) => ({
      id: p.id,
      tournamentId: p.tournament_id,
      name: p.name,
      seed: p.seed,
    })),
    matches: matches.map((m: any) => ({
      id: m.id,
      tournamentId: m.tournament_id,
      round: m.round,
      position: m.position,
      player1Id: m.player1_id,
      player2Id: m.player2_id,
      winnerId: m.winner_id,
      nextMatchId: m.next_match_id,
    })),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: add getBracketState query"
```

---

## Task 9: Pusher server client

**Files:**
- Create: `lib/pusher.ts`

- [ ] **Step 1: Create `lib/pusher.ts`**

```typescript
import Pusher from 'pusher';

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/pusher.ts
git commit -m "feat: add Pusher server client"
```

---

## Task 10: POST /api/tournaments

**Files:**
- Create: `app/api/tournaments/route.ts`

- [ ] **Step 1: Create `app/api/tournaments/route.ts`**

```typescript
import { validateApiKey, unauthorized } from '@/lib/auth';
import { generateBracket } from '@/lib/bracket';
import { getBracketState } from '@/lib/queries';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  if (!validateApiKey(request)) return unauthorized();

  const body = await request.json() as { name: string; players: string[] };
  const { name, players: playerNames } = body;

  if (!name || !Array.isArray(playerNames) || playerNames.length < 2) {
    return Response.json(
      { error: 'name and at least 2 players are required' },
      { status: 400 },
    );
  }

  const [{ id: tournamentId }] = await sql`
    INSERT INTO tournaments (name, status)
    VALUES (${name}, 'active')
    RETURNING id
  `;

  const { players, matches } = generateBracket(playerNames);

  for (const p of players) {
    await sql`
      INSERT INTO players (id, tournament_id, name, seed)
      VALUES (${p.id}, ${tournamentId}, ${p.name}, ${p.seed})
    `;
  }

  for (const m of matches) {
    await sql`
      INSERT INTO matches (id, tournament_id, round, position,
                           player1_id, player2_id, winner_id, next_match_id)
      VALUES (${m.id}, ${tournamentId}, ${m.round}, ${m.position},
              ${m.player1Id}, ${m.player2Id}, ${m.winnerId}, ${m.nextMatchId})
    `;
  }

  const bracket = await getBracketState(tournamentId);
  return Response.json({ tournamentId, bracket }, { status: 201 });
}
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Smoke test — create a tournament**

```bash
curl -s -X POST http://localhost:3000/api/tournaments \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"name":"Test Cup","players":["Alice","Bob","Charlie","Dave","Eve"]}' \
  | jq '{tournamentId: .tournamentId, playerCount: (.bracket.players | length), matchCount: (.bracket.matches | length)}'
```

Expected: `tournamentId` is a UUID, `playerCount` is 5, `matchCount` is 7 (bracketSize=8).

- [ ] **Step 4: Verify 401 without API key**

```bash
curl -s -X POST http://localhost:3000/api/tournaments \
  -H "Content-Type: application/json" \
  -d '{"name":"x","players":["A","B"]}' | jq .
```

Expected: `{"error":"Unauthorized"}`

- [ ] **Step 5: Commit**

```bash
git add app/api/tournaments/route.ts
git commit -m "feat: add POST /api/tournaments"
```

---

## Task 11: GET /api/tournaments/[id]

**Files:**
- Create: `app/api/tournaments/[id]/route.ts`

- [ ] **Step 1: Create `app/api/tournaments/[id]/route.ts`**

```typescript
import { getBracketState } from '@/lib/queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bracket = await getBracketState(id);
  if (!bracket) return Response.json({ error: 'Tournament not found' }, { status: 404 });
  return Response.json(bracket);
}
```

- [ ] **Step 2: Smoke test — use the tournamentId from Task 10**

```bash
curl -s http://localhost:3000/api/tournaments/TOURNAMENT_ID_HERE | jq '{status: .tournament.status, rounds: (.matches | group_by(.round) | map({round: .[0].round, count: length}))}'
```

Expected: status `"active"`, three rounds with counts 4, 2, 1.

- [ ] **Step 3: Verify 404**

```bash
curl -s http://localhost:3000/api/tournaments/00000000-0000-0000-0000-000000000000 | jq .
```

Expected: `{"error":"Tournament not found"}`

- [ ] **Step 4: Commit**

```bash
git add app/api/tournaments/[id]/route.ts
git commit -m "feat: add GET /api/tournaments/:id"
```

---

## Task 12: POST /api/matches/[id]/winner

**Files:**
- Create: `app/api/matches/[id]/winner/route.ts`

- [ ] **Step 1: Create `app/api/matches/[id]/winner/route.ts`**

```typescript
import { validateApiKey, unauthorized } from '@/lib/auth';
import { getBracketState } from '@/lib/queries';
import { pusherServer } from '@/lib/pusher';
import { sql } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateApiKey(request)) return unauthorized();

  const { id: matchId } = await params;
  const { winnerId } = await request.json() as { winnerId: string };

  const rows = await sql`
    SELECT id, tournament_id, player1_id, player2_id, winner_id, next_match_id, position
    FROM matches WHERE id = ${matchId}
  `;
  if (rows.length === 0) return Response.json({ error: 'Match not found' }, { status: 404 });
  const match = rows[0];

  if (match.winner_id) {
    return Response.json({ error: 'Match already decided' }, { status: 400 });
  }
  if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
    return Response.json(
      { error: 'winnerId must be player1 or player2 of this match' },
      { status: 400 },
    );
  }

  await sql`UPDATE matches SET winner_id = ${winnerId} WHERE id = ${matchId}`;

  if (match.next_match_id) {
    if (match.position % 2 === 0) {
      await sql`UPDATE matches SET player1_id = ${winnerId} WHERE id = ${match.next_match_id}`;
    } else {
      await sql`UPDATE matches SET player2_id = ${winnerId} WHERE id = ${match.next_match_id}`;
    }
  } else {
    // Final match — tournament is over
    await sql`UPDATE tournaments SET status = 'complete' WHERE id = ${match.tournament_id}`;
  }

  const bracket = await getBracketState(match.tournament_id);
  await pusherServer.trigger(
    `tournament-${match.tournament_id}`,
    'bracket-update',
    bracket,
  );

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Find a playable round-1 match ID and its player IDs**

```bash
curl -s http://localhost:3000/api/tournaments/TOURNAMENT_ID \
  | jq '.matches[] | select(.round == 1 and .player1Id != null and .player2Id != null) | {id, player1Id, player2Id}'
```

- [ ] **Step 3: Set the winner**

```bash
curl -s -X POST http://localhost:3000/api/matches/MATCH_ID/winner \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"winnerId":"PLAYER_ID"}' | jq .
```

Expected: `{"ok":true}`

- [ ] **Step 4: Verify winner written and advanced**

```bash
curl -s http://localhost:3000/api/tournaments/TOURNAMENT_ID \
  | jq '.matches[] | select(.round <= 2) | {round, position, player1Id, player2Id, winnerId}'
```

Expected: the resolved match has `winnerId` set; the next-round match has the winner in its `player1Id` or `player2Id` slot.

- [ ] **Step 5: Commit**

```bash
git add app/api/matches/[id]/winner/route.ts
git commit -m "feat: add POST /api/matches/:id/winner with Pusher broadcast"
```

---

## Task 13: Frontend bracket page

**Files:**
- Create: `app/tournament/[id]/page.tsx`
- Create: `app/tournament/[id]/BracketView.tsx`

- [ ] **Step 1: Create `app/tournament/[id]/page.tsx`**

```typescript
import BracketView from './BracketView';

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <BracketView tournamentId={id} />
    </div>
  );
}
```

- [ ] **Step 2: Create `app/tournament/[id]/BracketView.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { Bracket } from 'react-brackets';
import type { BracketState, Match } from '@/types/tournament';

function toRounds(state: BracketState) {
  const playerMap = new Map(state.players.map(p => [p.id, p.name]));
  const maxRound = Math.max(...state.matches.map(m => m.round));

  return Array.from({ length: maxRound }, (_, i) => {
    const round = i + 1;
    const title =
      round === maxRound ? 'Final'
      : round === maxRound - 1 ? 'Semi-Final'
      : `Round ${round}`;

    const seeds = state.matches
      .filter(m => m.round === round)
      .sort((a: Match, b: Match) => a.position - b.position)
      .map((m: Match) => ({
        id: m.id,
        teams: [
          { name: m.player1Id ? (playerMap.get(m.player1Id) ?? 'TBD') : 'BYE' },
          { name: m.player2Id ? (playerMap.get(m.player2Id) ?? 'TBD') : 'BYE' },
        ],
      }));

    return { title, seeds };
  });
}

export default function BracketView({ tournamentId }: { tournamentId: string }) {
  const [state, setState] = useState<BracketState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}`)
      .then(r => r.json())
      .then(setState)
      .catch(() => setError('Failed to load tournament'));

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
    const channel = pusher.subscribe(`tournament-${tournamentId}`);
    channel.bind('bracket-update', (data: BracketState) => setState(data));

    return () => {
      channel.unbind_all();
      pusher.disconnect();
    };
  }, [tournamentId]);

  if (error) return <p className="p-8 text-red-400">{error}</p>;
  if (!state) return <p className="p-8 text-zinc-400">Loading…</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">{state.tournament.name}</h1>
      <p className="mb-8 capitalize text-zinc-400">{state.tournament.status}</p>
      <Bracket rounds={toRounds(state)} />
    </div>
  );
}
```

- [ ] **Step 3: Open the bracket page**

Navigate to `http://localhost:3000/tournament/TOURNAMENT_ID`.

Expected: bracket renders with player names. Bye slots show "BYE". Future round slots show "TBD".

- [ ] **Step 4: Verify real-time update**

Keep the browser tab open. In a second terminal, call `POST /api/matches/:id/winner` for a playable match. The bracket should update in the browser within 1–2 seconds without a page reload.

- [ ] **Step 5: Commit**

```bash
git add app/tournament/[id]/page.tsx app/tournament/[id]/BracketView.tsx
git commit -m "feat: add bracket frontend with Pusher real-time updates"
```

---

## Task 14: End-to-end smoke test

Full happy-path walkthrough with a 6-player tournament.

- [ ] **Step 1: Create a fresh tournament**

```bash
curl -s -X POST http://localhost:3000/api/tournaments \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"name":"Roblox Grand Cup","players":["Alpha","Bravo","Charlie","Delta","Echo","Foxtrot"]}' \
  | jq '{tournamentId: .tournamentId, rounds: [.bracket.matches | group_by(.round)[] | {round: .[0].round, matches: length}]}'
```

Expected: 7 total matches across 3 rounds (bracketSize=8, byeCount=2).

- [ ] **Step 2: Open spectator page in browser**

`http://localhost:3000/tournament/TOURNAMENT_ID`

Expected: 4 round-1 slots visible; 2 show "BYE" (auto-resolved), 2 show real players waiting to play.

- [ ] **Step 3: Resolve the two real round-1 matches**

Use `GET /api/tournaments/:id` to find the two matches where both `player1Id` and `player2Id` are non-null (and `winnerId` is null). Call `POST /api/matches/:id/winner` for each. Confirm the browser bracket updates live after each call.

- [ ] **Step 4: Resolve semifinals and final**

Continue calling the winner endpoint for each newly playable match. After each call, confirm the next round populates correctly in the browser.

- [ ] **Step 5: Verify tournament completes**

```bash
curl -s http://localhost:3000/api/tournaments/TOURNAMENT_ID | jq '.tournament.status'
```

Expected: `"complete"`

---

## Roblox HttpService usage

The Roblox script calls two endpoints:

**Create tournament:**
```lua
local HttpService = game:GetService("HttpService")

local body = HttpService:JSONEncode({
  name = "Round 1",
  players = {"Player1", "Player2", "Player3", "Player4"}
})

local response = HttpService:RequestAsync({
  Url = "https://your-vercel-app.vercel.app/api/tournaments",
  Method = "POST",
  Headers = {
    ["Content-Type"] = "application/json",
    ["x-api-key"] = "YOUR_API_KEY"
  },
  Body = body
})

local data = HttpService:JSONDecode(response.Body)
local tournamentId = data.tournamentId
```

**Report match winner:**
```lua
local body = HttpService:JSONEncode({ winnerId = winnerPlayerId })

HttpService:RequestAsync({
  Url = "https://your-vercel-app.vercel.app/api/matches/" .. matchId .. "/winner",
  Method = "POST",
  Headers = {
    ["Content-Type"] = "application/json",
    ["x-api-key"] = "YOUR_API_KEY"
  },
  Body = body
})
```
