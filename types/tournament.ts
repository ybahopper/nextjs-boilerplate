export interface Tournament {
  id: string;
  name: string;
  status: 'active' | 'complete';
  createdAt: string;
}

export interface Player {
  id: string;
  tournamentId: string;
  name: string;
  seed: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
}

export interface BracketState {
  tournament: Tournament;
  players: Player[];
  matches: Match[];
}
