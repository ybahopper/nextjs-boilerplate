import BracketView from './BracketView';

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <BracketView tournamentId={id} />
    </div>
  );
}
