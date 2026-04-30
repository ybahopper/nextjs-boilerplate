'use client';

import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { Bracket, Seed } from 'react-brackets';
import type { BracketState, Match } from '@/types/tournament';
import type { JSX } from 'react';
import MatchCard from './MatchCard';

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

export default function BracketView({ tournamentId }: { tournamentId: string }) {
  const [state, setState] = useState<BracketState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newWinners, setNewWinners] = useState<Set<string>>(new Set());
  const prevStateRef = useRef<BracketState | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}`)
      .then(r => r.json())
      .then((data: BracketState) => {
        prevStateRef.current = data;
        setState(data);
      })
      .catch(() => setError('Failed to load tournament'));

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
    const channel = pusher.subscribe(`tournament-${tournamentId}`);
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
          if (pulseTimerRef.current !== null) clearTimeout(pulseTimerRef.current);
          setNewWinners(freshWinners);
          pulseTimerRef.current = setTimeout(() => setNewWinners(new Set()), 1000);
        }
      }
      prevStateRef.current = data;
      setState(data);
    });

    return () => {
      if (pulseTimerRef.current !== null) clearTimeout(pulseTimerRef.current);
      channel.unbind_all();
      pusher.disconnect();
    };
  }, [tournamentId]);

  if (error) return <p className="p-8 text-red-400">{error}</p>;
  if (!state) return (
    <div className="p-8 flex flex-col items-center gap-2">
      <div className="h-10 w-64 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse mb-8" />
      <div className="flex gap-8 animate-pulse">
        <div className="bg-zinc-800 rounded-lg h-24 w-48" />
        <div className="bg-zinc-800 rounded-lg h-24 w-48" />
        <div className="bg-zinc-800 rounded-lg h-24 w-48" />
      </div>
    </div>
  );

  return (
    <div className="p-8 w-full flex flex-col items-center">
      <h1 className="text-4xl font-bold tracking-tight text-white border-b border-zinc-800 pb-4 mb-10 w-full text-center">
        {state.tournament.name}
      </h1>
      <div className="overflow-x-auto max-w-full">
        <Bracket
          rounds={toRounds(state)}
          roundTitleComponent={(title: string | JSX.Element) => (
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 text-center mb-4">
              {title}
            </p>
          )}
          renderSeedComponent={({ seed, breakpoint }) => (
            <Seed mobileBreakpoint={breakpoint}>
              <MatchCard seed={seed} isPulsing={newWinners.has(seed.id as string)} />
            </Seed>
          )}
        />
      </div>
    </div>
  );
}
