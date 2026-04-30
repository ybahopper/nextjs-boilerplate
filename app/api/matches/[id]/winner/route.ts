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
    SELECT id, tournament_id, player1_id, player2_id, winner_id, next_match_id, position,
           is_third_place, loser_next_match_id
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
  } else if (!match.is_third_place) {
    await sql`UPDATE tournaments SET status = 'complete' WHERE id = ${match.tournament_id}`;
  }

  // Route the loser to the 3rd place match (applies to semi-final matches)
  if (match.loser_next_match_id) {
    const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
    if (match.position % 2 === 0) {
      await sql`UPDATE matches SET player1_id = ${loserId} WHERE id = ${match.loser_next_match_id}`;
    } else {
      await sql`UPDATE matches SET player2_id = ${loserId} WHERE id = ${match.loser_next_match_id}`;
    }
  }

  const bracket = await getBracketState(match.tournament_id);
  await pusherServer.trigger(
    `tournament-${match.tournament_id}`,
    'bracket-update',
    bracket,
  );

  return Response.json({ ok: true });
}
