import BracketView from './BracketView';

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'radial-gradient(ellipse at top, #18181b 0%, #09090b 70%)' }}
    >
      <BracketView tournamentId={id} />
    </div>
  );
}
