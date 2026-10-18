import { describe, expect, it } from 'vitest';
import worker, { FRESHNESS_KEY, parseFreshness, type Env } from '../../src/worker/freshness.ts';

const STORED = {
  intervals: { last_success_at: '2026-10-17T09:19:00Z' },
  generated_at: '2026-10-17T09:19:00Z',
};

// A fake env: FRESHNESS holds at most the one object, or throws like an R2 outage would.
function env(stored: unknown, { fails = false } = {}): Env & { reads: string[]; assets: string[] } {
  const reads: string[] = [];
  const assets: string[] = [];
  return {
    reads,
    assets,
    REFRESH_REPO: 'alexwebber/alexanderwebber.com',
    REFRESH_WORKFLOW: 'refresh.yml',
    ASSETS: {
      async fetch(request) {
        assets.push(new URL(request.url).pathname);
        return new Response('asset', { status: 200 });
      },
    },
    FRESHNESS: {
      async get(key) {
        reads.push(key);
        if (fails) throw new Error('R2 unavailable');
        if (stored === undefined) return null;
        const text = typeof stored === 'string' ? stored : JSON.stringify(stored);
        return { text: async () => text };
      },
    },
  };
}

const get = (path: string, method = 'GET') =>
  new Request(`https://alexanderwebber.com${path}`, { method });

describe('freshness worker', () => {
  it('returns the contract fields with a 5-minute cache', async () => {
    const e = env(STORED);
    const response = await worker.fetch(get('/running/api/freshness'), e);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(await response.json()).toEqual(STORED);
    expect(e.reads).toEqual([FRESHNESS_KEY]);
    expect(e.assets).toEqual([]);
  });

  it('drops anything beyond the contract fields', async () => {
    const response = await worker.fetch(
      get('/running/api/freshness'),
      env({ ...STORED, intervals: { ...STORED.intervals, cursor: 'x' }, other: { last_success_at: STORED.generated_at } }),
    );
    expect(await response.json()).toEqual(STORED);
  });

  it.each([
    ['the object is absent', env(undefined)],
    ['the read fails', env(STORED, { fails: true })],
    ['the object is not JSON', env('{not json')],
    ['last_success_at is missing', env({ generated_at: STORED.generated_at })],
    ['a timestamp is malformed', env({ ...STORED, generated_at: '2026-10-17 09:19' })],
  ])('returns 503 when %s', async (_, e) => {
    const response = await worker.fetch(get('/running/api/freshness'), e);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(e.assets).toEqual([]);
  });

  it('answers HEAD without a body and refuses other methods', async () => {
    const head = await worker.fetch(get('/running/api/freshness', 'HEAD'), env(STORED));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const post = await worker.fetch(get('/running/api/freshness', 'POST'), env(STORED));
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('passes every other path to the static assets without reading R2', async () => {
    const e = env(STORED);
    for (const path of ['/', '/running/', '/running/api/freshness/', '/running/api/other']) {
      expect((await worker.fetch(get(path), e)).status).toBe(200);
    }
    expect(e.assets).toEqual(['/', '/running/', '/running/api/freshness/', '/running/api/other']);
    expect(e.reads).toEqual([]);
  });

  it('parses only well-formed records', () => {
    expect(parseFreshness(JSON.stringify(STORED))).toEqual(STORED);
    expect(parseFreshness('null')).toBeUndefined();
    expect(parseFreshness('[]')).toBeUndefined();
    expect(parseFreshness(JSON.stringify({ ...STORED, intervals: 'x' }))).toBeUndefined();
  });
});
