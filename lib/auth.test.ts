import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateApiKey } from './auth';

describe('validateApiKey', () => {
  beforeAll(() => { process.env.API_KEY = 'secret-test-key'; });
  afterAll(() => { delete process.env.API_KEY; });

  it('returns true when header matches API_KEY', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-api-key': 'secret-test-key' },
    });
    expect(validateApiKey(req)).toBe(true);
  });

  it('returns false when header does not match', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(validateApiKey(req)).toBe(false);
  });

  it('returns false when header is absent', () => {
    const req = new Request('http://localhost');
    expect(validateApiKey(req)).toBe(false);
  });
});
