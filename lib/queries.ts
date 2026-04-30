import { sql } from './db';
import type { BracketState } from '../types/tournament';

interface TournamentRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface PlayerRow {
  id: string;
  tournament_id: string;
  name: string;
  seed: number;
}

interface MatchRow {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  next_match_id: string | null;
  is_third_place: boolean;
  loser_next_match_id: string | null;
}

export async function getBracketState(tournamentId: string): Promise<BracketState | null> {
  const [tournamentRows, players, matches] = await Promise.all([
    sql`SELECT id, name, status, created_at FROM tournaments WHERE id = ${tournamentId}`,
    sql`
      SELECT id, tournament_id, name, seed
      FROM players
      WHERE tournament_id = ${tournamentId}
      ORDER BY seed
    `,
    sql`
      SELECT id, tournament_id, round, position,
             player1_id, player2_id, winner_id, next_match_id,
             is_third_place, loser_next_match_id
      FROM matches
      WHERE tournament_id = ${tournamentId}
      ORDER BY round, position
    `,
  ]);

  if (tournamentRows.length === 0) return null;
  const t = tournamentRows[0] as TournamentRow;

  return {
    tournament: {
      id: t.id,
      name: t.name,
      status: t.status as 'active' | 'complete',
      createdAt: t.created_at,
    },
    players: (players as PlayerRow[]).map(p => ({
      id: p.id,
      tournamentId: p.tournament_id,
      name: p.name,
      seed: p.seed,
    })),
    matches: (matches as MatchRow[]).map(m => ({
      id: m.id,
      tournamentId: m.tournament_id,
      round: m.round,
      position: m.position,
      player1Id: m.player1_id,
      player2Id: m.player2_id,
      winnerId: m.winner_id,
      nextMatchId: m.next_match_id,
      isThirdPlace: m.is_third_place,
      loserNextMatchId: m.loser_next_match_id,
    })),
  };
}
