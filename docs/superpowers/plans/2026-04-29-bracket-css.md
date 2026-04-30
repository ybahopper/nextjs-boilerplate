# Bracket CSS & Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unstyled `react-brackets` default UI with a dark & sleek aesthetic, custom match cards, entrance animations, and real-time winner pulse animation.

**Architecture:** A new `MatchCard` component is passed to `react-brackets` via `renderSeedComponent`. It receives winner state through the seed's `teams` array (extended with `isWinner`). `BracketView` diffs Pusher updates to detect newly-resolved matches and passes `isPulsing` into `MatchCard` via a closure. All animations live in `MatchCard.module.css`.

**Tech Stack:** React, Next.js App Router, Tailwind CSS v4, CSS Modules, react-brackets, Pusher

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/tournament/[id]/MatchCard.module.css` | Create | Keyframe animation definitions |
| `app/tournament/[id]/MatchCard.tsx` | Create | Custom match card UI component |
| `app/tournament/[id]/BracketView.tsx` | Modify | Winner-diff logic, renderSeedComponent, skeleton loader, updated toRounds() |
| `app/globals.css` | Modify | Bracket connector line color override (best-effort, styled-components target) |
| `app/tournament/[id]/page.tsx` | Modify | Radial gradient background |

---

## Task 1: Create `MatchCard.module.css`

**Files:**
- Create: `app/tournament/[id]/MatchCard.module.css`

- [ ] **Step 1: Create the CSS module file**

```css
/* app/tournament/[id]/MatchCard.module.css */

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes winnerPulse {
  0% {
    box-shadow: none;
    border-color: #3f3f46; /* zinc-700 */
  }
  40% {
    box-shadow: 0 0 16px rgb(251 191 36 / 0.5); /* amber-400/50 */
    border-color: #fbbf24; /* amber-400 */
  }
  100% {
    box-shadow: none;
    border-color: rgb(251 191 36 / 0.4);
  }
}

.card {
  animation: fadeSlideIn 200ms ease-out both;
}

.cardPulsing {
  animation: fadeSlideIn 200ms ease-out both, winnerPulse 800ms ease-in-out 200ms both;
}
```

> Note: `winnerPulse` is delayed 200ms so it runs after `fadeSlideIn` completes on newly-appearing match slots.

- [ ] **Step 2: Verify the file exists and has no syntax errors**

```bash
cat "app/tournament/[id]/MatchCard.module.css"
```

Expected: file contents printed with no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/tournament/[id]/MatchCard.module.css"
git commit -m "feat: add bracket match card animation keyframes"
```

---

## Task 2: Create `MatchCard.tsx`

**Files:**
- Create: `app/tournament/[id]/MatchCard.tsx`

This component receives a react-brackets `ISeedProps` seed (with `teams[n].isWinner` extended), plus an `isPulsing` boolean. It renders a two-row match card.

- [ ] **Step 1: Create the component**

```tsx
// app/tournament/[id]/MatchCard.tsx
import type { ISeedProps } from 'react-brackets';
import styles from './MatchCard.module.css';

interface Team {
  name?: string;
  isWinner?: boolean;
}

interface Props {
  seed: ISeedProps;
  isPulsing: boolean;
}

export default function MatchCard({ seed, isPulsing }: Props) {
  const [team1, team2] = seed.teams as Team[];

  return (
    <div className={`border border-zinc-700 rounded-lg w-48 overflow-hidden bg-zinc-900 ${isPulsing ? styles.cardPulsing : styles.card}`}>
      <PlayerRow team={team1} />
      <div className="h-px bg-zinc-700" />
      <PlayerRow team={team2} />
    </div>
  );
}

function PlayerRow({ team }: { team: Team | undefined }) {
  const name = team?.name;
  const isWinner = team?.isWinner ?? false;
  const isBye = name === 'BYE';
  const isTbd = !name || name === 'TBD';

  if (isBye || isTbd) {
    return (
      <div className="px-4 py-2 text-xs italic text-zinc-600">
        {isBye ? 'BYE' : 'TBD'}
      </div>
    );
  }

  if (isWinner) {
    return (
      <div className="px-3 py-2 text-sm font-medium text-amber-400 border-l-2 border-amber-400">
        {name}
      </div>
    );
  }

  return (
    <div className="px-4 py-2 text-sm font-medium text-zinc-500">
      {name}
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors for the new file.

- [ ] **Step 3: Commit**

```bash
git add "app/tournament/[id]/MatchCard.tsx"
git commit -m "feat: add MatchCard component with winner/loser/bye states"
```

---

## Task 3: Update `toRounds()` in `BracketView.tsx` to carry `isWinner`

**Files:**
- Modify: `app/tournament/[id]/BracketView.tsx` (lines 8–32)

Currently `teams` has `{ name: string }`. We extend it with `isWinner: boolean` so `MatchCard` knows which player won without back-referencing `BracketState`.

- [ ] **Step 1: Replace the `toRounds` function**

Replace the entire `toRounds` function (lines 8–32) with:

```ts
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
          {
            name: m.player1Id ? (playerMap.get(m.player1Id) ?? 'TBD') : 'BYE',
            isWinner: m.winnerId !== null && m.winnerId === m.player1Id,
          },
          {
            name: m.player2Id ? (playerMap.get(m.player2Id) ?? 'TBD') : 'BYE',
            isWinner: m.winnerId !== null && m.winnerId === m.player2Id,
          },
        ],
      }));

    return { title, seeds };
  });
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/tournament/[id]/BracketView.tsx"
git commit -m "feat: extend toRounds seeds with isWinner flag"
```

---

## Task 4: Add winner-diff logic to `BracketView.tsx`

**Files:**
- Modify: `app/tournament/[id]/BracketView.tsx`

We need to detect which match IDs gained a `winnerId` in the latest Pusher update, store them in a `Set`, and clear the set after 1 second. `MatchCard` uses this set to trigger the pulse animation.

- [ ] **Step 1: Add `useRef` to the import line and add `newWinners` state**

Change the import line from:
```ts
import { useEffect, useState } from 'react';
```
To:
```ts
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Add refs and new state inside the component function**

After `const [error, setError] = useState<string | null>(null);`, add:

```ts
const [newWinners, setNewWinners] = useState<Set<string>>(new Set());
const prevStateRef = useRef<BracketState | null>(null);
```

- [ ] **Step 3: Replace the Pusher `bracket-update` handler**

Change:
```ts
channel.bind('bracket-update', (data: BracketState) => setState(data));
```

To:
```ts
channel.bind('bracket-update', (data: BracketState) => {
  const prev = prevStateRef.current;
  if (prev) {
    const freshWinners = new Set<string>();
    for (const match of data.matches) {
      const prevMatch = prev.matches.find(m => m.id === match.id);
      if (match.winnerId && prevMatch && !prevMatch.winnerId) {
        freshWinners.add(match.id);
      }
    }
    if (freshWinners.size > 0) {
      setNewWinners(freshWinners);
      setTimeout(() => setNewWinners(new Set()), 1000);
    }
  }
  prevStateRef.current = data;
  setState(data);
});
```

- [ ] **Step 4: Seed `prevStateRef` on initial fetch**

Change:
```ts
fetch(`/api/tournaments/${tournamentId}`)
  .then(r => r.json())
  .then(setState)
  .catch(() => setError('Failed to load tournament'));
```

To:
```ts
fetch(`/api/tournaments/${tournamentId}`)
  .then(r => r.json())
  .then((data: BracketState) => {
    prevStateRef.current = data;
    setState(data);
  })
  .catch(() => setError('Failed to load tournament'));
```

- [ ] **Step 5: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/tournament/[id]/BracketView.tsx"
git commit -m "feat: add winner-diff logic for Pusher bracket updates"
```

---

## Task 5: Wire `MatchCard` into `BracketView` and add skeleton loader

**Files:**
- Modify: `app/tournament/[id]/BracketView.tsx`

- [ ] **Step 1: Add the MatchCard import**

Add at the top of `BracketView.tsx` (after existing imports):

```ts
import MatchCard from './MatchCard';
```

- [ ] **Step 2: Replace the loading state**

Change:
```tsx
if (!state) return <p className="p-8 text-zinc-400">Loading…</p>;
```

To:
```tsx
if (!state) return (
  <div className="p-8">
    <div className="h-10 w-64 bg-zinc-800 rounded mb-2 animate-pulse" />
    <div className="h-4 w-20 bg-zinc-800 rounded mb-10 animate-pulse" />
    <div className="flex gap-8 animate-pulse">
      <div className="bg-zinc-800 rounded-lg h-24 w-48" />
      <div className="bg-zinc-800 rounded-lg h-24 w-48" />
      <div className="bg-zinc-800 rounded-lg h-24 w-48" />
    </div>
  </div>
);
```

- [ ] **Step 3: Replace the JSX return with the styled version**

Replace:
```tsx
return (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-2">{state.tournament.name}</h1>
    <p className="mb-8 capitalize text-zinc-400">{state.tournament.status}</p>
    <Bracket rounds={toRounds(state)} />
  </div>
);
```

With:
```tsx
return (
  <div className="p-8">
    <h1 className="text-4xl font-bold tracking-tight text-white border-b border-zinc-800 pb-4 mb-10">
      {state.tournament.name}
    </h1>
    <Bracket
      rounds={toRounds(state)}
      roundTitleComponent={(title: string | JSX.Element) => (
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 text-center mb-4">
          {title}
        </p>
      )}
      renderSeedComponent={({ seed }) => (
        <MatchCard seed={seed} isPulsing={newWinners.has(seed.id as string)} />
      )}
    />
  </div>
);
```

> Note: the react-brackets prop is `roundTitleComponent`, not `renderRoundTitle`. The `status` paragraph is removed — the title is enough.

- [ ] **Step 4: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/tournament/[id]/BracketView.tsx"
git commit -m "feat: wire MatchCard into bracket with skeleton loader and styled title"
```

---

## Task 6: Polish page background and connector lines

**Files:**
- Modify: `app/tournament/[id]/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add radial gradient background to `page.tsx`**

Replace:
```tsx
<div className="min-h-screen bg-zinc-950 text-white">
```

With:
```tsx
<div
  className="min-h-screen text-white"
  style={{ background: 'radial-gradient(ellipse at top, #18181b 0%, #09090b 70%)' }}
>
```

- [ ] **Step 2: Add connector line override to `globals.css`**

Append to `app/globals.css`:

```css
/*
  react-brackets uses styled-components with dynamic class names.
  These selectors target connector divs structurally within the bracket wrapper.
  Inspect the rendered DOM in DevTools if connectors don't match — adjust selectors as needed.
*/
.sg-seed-item::before,
.sg-seed-item::after {
  background-color: #3f3f46 !important; /* zinc-700 */
}
```

> If the above selectors have no effect after inspecting the browser DOM, remove these rules — the match cards look great without connector restyling.

- [ ] **Step 3: Check TypeScript compiles and no build errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/tournament/[id]/page.tsx" "app/globals.css"
git commit -m "feat: polish bracket page background and connector line colors"
```

---

## Task 7: Manual browser verification

**No code changes — this is a verification task.**

Start the dev server and visually confirm all design goals.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Create a test tournament via the API**

```bash
curl -X POST http://localhost:3000/api/tournaments \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-api-key-from-.env.local>" \
  -d '{"name":"Test Cup","players":["Alice","Bob","Carlos","Diana","Eve","Frank"]}'
```

Note the `tournamentId` in the response.

- [ ] **Step 3: Open the bracket page**

Navigate to `http://localhost:3000/tournament/<tournamentId>`.

Verify:
- [ ] Background has a subtle top-center radial gradient (not flat black)
- [ ] Tournament name renders at `text-4xl`, with a bottom border separator
- [ ] Round labels are small, uppercase, spaced (`text-xs uppercase tracking-widest`)
- [ ] Match cards are dark zinc-900 with zinc-700 border, rounded corners
- [ ] TBD slots show italic muted text
- [ ] Cards fade-in and slide up on page load

- [ ] **Step 4: Declare a winner via the API**

```bash
curl -X POST http://localhost:3000/api/matches/<match-id>/winner \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-api-key-from-.env.local>" \
  -d '{"winnerId":"<player-id>"}'
```

(Match IDs and player IDs are in the tournament fetch response.)

With the bracket tab open in the browser, verify:
- [ ] Winner's name turns amber-400, gets a left amber border
- [ ] Loser's name dims to zinc-500
- [ ] The card briefly pulses with a gold glow (winnerPulse animation)
- [ ] The winner's name appears in the next round's match slot with a fade-slide-in

- [ ] **Step 5: Check loading skeleton**

Throttle your network in DevTools to "Slow 4G", refresh the bracket page.

Verify:
- [ ] Three zinc-800 rounded rectangles appear where the bracket will load
- [ ] Title area also shows a skeleton bar

- [ ] **Step 6: Commit verification note**

```bash
git commit --allow-empty -m "chore: bracket CSS visual verification passed"
```
