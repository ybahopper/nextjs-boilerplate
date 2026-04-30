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

  if (!name || name === 'BYE' || name === 'TBD') {
    const label = name === 'BYE' ? 'BYE' : 'TBD';
    return <div className="px-4 py-2 text-xs italic text-zinc-600">{label}</div>;
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
