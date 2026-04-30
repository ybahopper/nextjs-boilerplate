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

  // Insert matches in DESCENDING round order (final first, round 1 last)
  // Required because next_match_id and loser_next_match_id are self-referencing
  // FKs — the referenced match must exist before the referencing match is inserted.
  const sortedMatches = [...matches].sort((a, b) => b.round - a.round);
  for (const m of sortedMatches) {
    await sql`
      INSERT INTO matches (id, tournament_id, round, position,
                           player1_id, player2_id, winner_id, next_match_id,
                           is_third_place, loser_next_match_id)
      VALUES (${m.id}, ${tournamentId}, ${m.round}, ${m.position},
              ${m.player1Id}, ${m.player2Id}, ${m.winnerId}, ${m.nextMatchId},
              ${m.isThirdPlace}, ${m.loserNextMatchId})
    `;
  }

  const bracket = await getBracketState(tournamentId);
  return Response.json({ tournamentId, bracket }, { status: 201 });
}
