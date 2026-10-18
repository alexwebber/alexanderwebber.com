import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/worker/freshness.ts';
import { DispatchFailed, dispatchRefresh, type TriggerEnv } from '../../src/worker/refresh-trigger.ts';

const TOKEN = 'github_pat_SENTINEL_TOKEN_VALUE';

const ENV: TriggerEnv = {
  GITHUB_DISPATCH_TOKEN: TOKEN,
  REFRESH_REPO: 'alexwebber/alexanderwebber.com',
  REFRESH_WORKFLOW: 'refresh.yml',
};

// A fake fetch that records each call and answers with `status`, or throws like a network error.
function fakeFetch(status: number | 'throws') {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (status === 'throws') throw new TypeError('network down');
    return new Response(status === 204 ? null : '{"message":"x"}', { status });
  };
  return { calls, impl };
}

function captureLogs() {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((line: string) => void lines.push(line));
  vi.spyOn(console, 'error').mockImplementation((line: string) => void lines.push(line));
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('refresh trigger', () => {
  it('dispatches refresh.yml on main with the token and a descriptive User-Agent', async () => {
    const logs = captureLogs();
    const { calls, impl } = fakeFetch(204);
    await dispatchRefresh(ENV, impl);
    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(url).toBe(
      'https://api.github.com/repos/alexwebber/alexanderwebber.com/actions/workflows/refresh.yml/dispatches',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ref: 'main' });
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('User-Agent')).toMatch(/^alexanderwebber\.com-refresh-trigger/);
    expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');
    expect(logs.map((l) => JSON.parse(l))).toEqual([
      { level: 'info', event: 'refresh_dispatched', status: 204, workflow: 'refresh.yml' },
    ]);
  });

  it('accepts any 2xx (the API answers 200 when run details are returned)', async () => {
    captureLogs();
    await expect(dispatchRefresh(ENV, fakeFetch(200).impl)).resolves.toBeUndefined();
  });

  it.each([
    [401, 'token_rejected'],
    [403, 'not_permitted'],
    [404, 'not_permitted'],
    [422, 'rejected'],
    [500, 'transient'],
    [503, 'transient'],
  ])('throws on HTTP %i (%s) and logs the cause without the token', async (status, code) => {
    const logs = captureLogs();
    const error = await dispatchRefresh(ENV, fakeFetch(status).impl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DispatchFailed);
    expect((error as DispatchFailed).code).toBe(code);
    expect((error as DispatchFailed).status).toBe(status);
    expect(logs).toHaveLength(1);
    const line = JSON.parse(logs[0]);
    expect(line).toMatchObject({ level: 'error', event: 'refresh_dispatch_failed', code, status });
    expect(line.likely_cause).toBeTruthy();
    expect(line.action).toBeTruthy();
    expect(logs[0]).not.toContain(TOKEN);
    expect(String(error)).not.toContain(TOKEN);
  });

  it('throws a network failure when fetch itself fails', async () => {
    const logs = captureLogs();
    const error = await dispatchRefresh(ENV, fakeFetch('throws').impl).catch((e: unknown) => e);
    expect((error as DispatchFailed).code).toBe('network');
    expect(JSON.parse(logs[0])).toMatchObject({ code: 'network', status: null });
  });

  it('throws without calling GitHub when the secret is missing', async () => {
    const logs = captureLogs();
    const { calls, impl } = fakeFetch(204);
    const error = await dispatchRefresh({ ...ENV, GITHUB_DISPATCH_TOKEN: '' }, impl).catch((e: unknown) => e);
    expect((error as DispatchFailed).code).toBe('token_missing');
    expect(calls).toEqual([]);
    expect(JSON.parse(logs[0])).toMatchObject({ code: 'token_missing' });
  });

  it('is what the Worker runs on its cron', async () => {
    captureLogs();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const env = {
      ...ENV,
      ASSETS: { fetch: async () => new Response('asset') },
      FRESHNESS: { get: async () => null },
    };
    await worker.scheduled({}, env);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toMatch(/\/actions\/workflows\/refresh\.yml\/dispatches$/);
  });
});
