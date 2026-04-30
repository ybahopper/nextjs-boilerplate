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
