// The Worker's fundraising route (T055, FR-003, FR-004; specs/002-fundraising/contracts/pipeline.md
// "Freshness route"): the contract's fields, re-shaping, failures, and that neither freshness route
// can reach the other's record.
import { describe, expect, it } from 'vitest';
import worker, { FRESHNESS_KEY, type Env } from '../../src/worker/freshness.ts';
import { FUNDRAISING_FRESHNESS_KEY, parseFundraisingFreshness } from '../../src/worker/fundraising-freshness.ts';

const PATH = '/running/api/fundraising-freshness';
const STORED = {
  campaigns: { 'seaside-2027': { last_read_at: '2026-11-10T09:17:03Z' } },
  generated_at: '2026-11-10T09:17:04Z',
};
const RUNNING = {
  intervals: { last_success_at: '2026-10-17T09:19:00Z' },
  generated_at: '2026-10-17T09:19:00Z',
};

// A fake env: FRESHNESS holds the given objects by key, or throws like an R2 outage would.
function env(objects: Record<string, unknown>, { fails = false } = {}): Env & { reads: string[]; assets: string[] } {
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
        const stored = objects[key];
        if (stored === undefined) return null;
        const text = typeof stored === 'string' ? stored : JSON.stringify(stored);
        return { text: async () => text };
      },
    },
  };
}

const stored = (value: unknown) => env({ [FUNDRAISING_FRESHNESS_KEY]: value });
const get = (path: string, method = 'GET') => new Request(`https://alexanderwebber.com${path}`, { method });

describe('fundraising freshness route', () => {
  it('returns the contract fields with a 5-minute cache, reading only its own record', async () => {
    const e = stored(STORED);
    const response = await worker.fetch(get(PATH), e);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(await response.json()).toEqual(STORED);
    expect(e.reads).toEqual([FUNDRAISING_FRESHNESS_KEY]);
    expect(e.assets).toEqual([]);
  });

  it('drops anything beyond the contract fields', async () => {
    const response = await worker.fetch(
      get(PATH),
      stored({ ...STORED, campaigns: { 'seaside-2027': { ...STORED.campaigns['seaside-2027'], raised_pence: 125000 } }, other: 'x' }),
    );
    expect(await response.json()).toEqual(STORED);
  });

  it.each([
    ['a campaign ID that is not a slug', { 'Not A Slug': { last_read_at: '2026-11-10T09:17:03Z' } }],
    ['a prototype key', JSON.parse('{"__proto__":{"last_read_at":"2026-11-10T09:17:03Z"}}')],
    ['a malformed timestamp', { 'other-2028': { last_read_at: '2026-11-10 09:17' } }],
    ['fractional seconds', { 'other-2028': { last_read_at: '2026-11-10T09:17:03.123Z' } }],
    ['an entry that is not an object', { 'other-2028': '2026-11-10T09:17:03Z' }],
  ])('drops %s and keeps the good entries', async (_, bad) => {
    const response = await worker.fetch(get(PATH), stored({ ...STORED, campaigns: { ...STORED.campaigns, ...bad } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(STORED);
  });

  it('answers with no campaigns once none is active', async () => {
    const response = await worker.fetch(get(PATH), stored({ ...STORED, campaigns: {} }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ campaigns: {}, generated_at: STORED.generated_at });
  });

  it.each([
    ['the object is absent', env({})],
    ['the read fails', env({ [FUNDRAISING_FRESHNESS_KEY]: STORED }, { fails: true })],
    ['the object is not JSON', stored('{not json')],
    ['campaigns is missing', stored({ generated_at: STORED.generated_at })],
    ['campaigns is a list', stored({ ...STORED, campaigns: [] })],
    ['generated_at is malformed', stored({ ...STORED, generated_at: '2026-11-10 09:17' })],
  ])('returns 503 when %s', async (_, e) => {
    const response = await worker.fetch(get(PATH), e);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(e.assets).toEqual([]);
  });

  it('answers HEAD without a body and refuses other methods', async () => {
    const head = await worker.fetch(get(PATH, 'HEAD'), stored(STORED));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const post = await worker.fetch(get(PATH, 'POST'), stored(STORED));
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('parses only well-formed records', () => {
    expect(parseFundraisingFreshness(JSON.stringify(STORED))).toEqual(STORED);
    expect(parseFundraisingFreshness('null')).toBeUndefined();
    expect(parseFundraisingFreshness('[]')).toBeUndefined();
  });
});

describe('neither route reaches the other (FR-003)', () => {
  it('a broken fundraising record leaves /running/api/freshness as it was', async () => {
    const e = env({ [FRESHNESS_KEY]: RUNNING, [FUNDRAISING_FRESHNESS_KEY]: '{not json' });
    const response = await worker.fetch(get('/running/api/freshness'), e);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(RUNNING);
    expect(e.reads).toEqual([FRESHNESS_KEY]);
  });

  it('a broken running record leaves the fundraising route as it was', async () => {
    const e = env({ [FRESHNESS_KEY]: '{not json', [FUNDRAISING_FRESHNESS_KEY]: STORED });
    const response = await worker.fetch(get(PATH), e);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(STORED);
    expect(e.reads).toEqual([FUNDRAISING_FRESHNESS_KEY]);
  });

  it('other paths under the prefix still go to the static assets', async () => {
    const e = env({ [FUNDRAISING_FRESHNESS_KEY]: STORED });
    await worker.fetch(get(`${PATH}/`), e);
    expect(e.assets).toEqual([`${PATH}/`]);
    expect(e.reads).toEqual([]);
  });
});
