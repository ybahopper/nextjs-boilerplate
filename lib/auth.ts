export function validateApiKey(request: Request): boolean {
  return request.headers.get('x-api-key') === process.env.API_KEY;
}

export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
