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
