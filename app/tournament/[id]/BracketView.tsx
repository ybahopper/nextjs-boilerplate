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
