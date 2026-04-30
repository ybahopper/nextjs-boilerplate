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
