# Tournament Bracket CSS & Animation Design

**Date:** 2026-04-29
**Scope:** Visual polish and animations for the tournament bracket page
**Approach:** Customize `react-brackets` via `renderSeedComponent` + CSS Module + Tailwind

---

## Goals

- Replace the unstyled `react-brackets` default UI with a dark & sleek aesthetic
- Add entrance animations for match cards
- Animate winner declaration in real-time (pulse + advancement fade-in)
- Polish page-level layout (background, title, round labels, connector lines, loading state)

## Out of Scope

- Replacing the `react-brackets` library with a custom renderer
- Adding new bracket features or data model changes
- Mobile-specific responsive layout changes

---

## Files Changed

| File | Change |
|---|---|
| `app/tournament/[id]/BracketView.tsx` | Add `renderSeedComponent`, `renderRoundTitle`, winner-diff logic, skeleton loader |
| `app/tournament/[id]/MatchCard.tsx` | New component — custom match card UI |
| `app/tournament/[id]/MatchCard.module.css` | New file — keyframe animations |
| `app/globals.css` | Override react-brackets connector line colors |
| `app/tournament/[id]/page.tsx` | Background gradient tweak |

---

## Match Card Design

Component: `MatchCard.tsx`, rendered via react-brackets `renderSeedComponent` prop.

**Layout:**
```
┌─────────────────────────────┐
│  Player 1 Name              │   ← amber text + left border if winner
├─────────────────────────────┤   ← zinc-700 divider line
│  Player 2 Name              │
└─────────────────────────────┘
```

**Tailwind classes:**
- Card shell: `bg-zinc-900 border border-zinc-700 rounded-lg w-48 overflow-hidden`
- Player row: `px-4 py-2 text-sm font-medium`
- Winner row: `text-amber-400 border-l-2 border-amber-400 pl-3`
- Loser row: `text-zinc-500 pl-4`
- TBD/bye slot: `text-zinc-600 italic text-xs pl-4`

**Props received by `MatchCard`:**
- `teams: { name: string | null; isWinner: boolean }[]` — derived from `toRounds()` helper
- `matchId: number` — used to look up `isPulsing` in the `newWinnersState` Set
- `isPulsing: boolean` — passed from `BracketView`, triggers `winnerPulse` animation

---

## Animation System

### `MatchCard.module.css` keyframes

**`fadeSlideIn`** — card entrance on mount
```css
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.card {
  animation: fadeSlideIn 200ms ease-out both;
}
```

**`winnerPulse`** — plays once when a match transitions to having a winner
```css
@keyframes winnerPulse {
  0%   { box-shadow: none; border-color: theme(colors.zinc.700); }
  40%  { box-shadow: 0 0 16px rgb(251 191 36 / 0.5); border-color: theme(colors.amber.400); }
  100% { box-shadow: none; border-color: rgb(251 191 36 / 0.4); }
}
.cardPulsing {
  animation: winnerPulse 800ms ease-in-out both;
}
```

### Winner detection in `BracketView.tsx`

```
prevStateRef (useRef) stores the previous BracketState.

On each Pusher `bracket-update` event:
  1. Diff matches: find match IDs where prevState.matches[id].winnerId was null
     and newState.matches[id].winnerId is non-null.
  2. Add those IDs to newWinnersState (Set<number>).
  3. After 1000ms, clear newWinnersState.
  4. Update prevStateRef to newState.

MatchCard receives `isPulsing: boolean` prop derived from newWinnersState.
```

---

## Page-level Styling

### Background
`page.tsx` wrapper: replace flat `bg-zinc-950` with an inline style radial gradient:
```css
background: radial-gradient(ellipse at top, #18181b 0%, #09090b 70%);
```
(zinc-900 → zinc-950 equivalent)

### Tournament title (`BracketView.tsx`)
```
text-4xl font-bold tracking-tight text-white
border-b border-zinc-800 pb-4 mb-10
```

### Round labels
Pass `renderRoundTitle` to `<Bracket>`:
```tsx
renderRoundTitle={(title) => (
  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 text-center mb-4">
    {title}
  </p>
)}
```

### Connector line override (`globals.css`)
Target react-brackets internal classes to recolor connectors:
```css
.sg-theme-default .sg-seed-item .sg-seed-connector {
  background-color: theme(colors.zinc.700);
}
```
(Exact class names verified against react-brackets DOM output at runtime.)

### Loading skeleton
Replace plain `<p>Loading...</p>` with:
```tsx
<div className="animate-pulse flex gap-8">
  <div className="bg-zinc-800 rounded-lg h-24 w-48" />
  <div className="bg-zinc-800 rounded-lg h-24 w-48" />
  <div className="bg-zinc-800 rounded-lg h-24 w-48" />
</div>
```

---

## Data Flow

react-brackets expects `rounds: Round[]` where each seed has a `teams` array. We extend the teams objects to carry `winnerId` so `MatchCard` can derive winner/loser state without needing to reach back into `BracketState` directly.

```ts
// in toRounds() helper
teams: [
  { name: match.player1?.name ?? null, id: match.player1Id, isWinner: match.winnerId === match.player1Id },
  { name: match.player2?.name ?? null, id: match.player2Id, isWinner: match.winnerId === match.player2Id },
]
```

---

## Constraints

- `react-brackets` connector line CSS classes must be confirmed at runtime — if the class names differ from assumed, override them in `globals.css` accordingly.
- `winnerPulse` uses `theme()` CSS function which requires Tailwind v4 (`@import "tailwindcss"` already present in globals.css).
- No new npm dependencies added.
