import { getBracketState } from '@/lib/queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bracket = await getBracketState(id);
  if (!bracket) return Response.json({ error: 'Tournament not found' }, { status: 404 });
  return Response.json(bracket);
}
