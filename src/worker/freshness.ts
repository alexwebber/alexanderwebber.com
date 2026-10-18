// The site's one Worker (T068; contracts/pipeline.md "Freshness endpoint" and "Refresh trigger").
// Its cron (wrangler.jsonc `triggers`) dispatches refresh.yml; see refresh-trigger.ts.
// GET /running/api/freshness reads public/freshness.json from R2 and returns the last successful
// fetch, so a refresh that finds nothing new needs no commit. Static assets serve first; every
// other path that reaches the Worker falls through to them.
//
// The object is re-shaped rather than passed through, so the response holds only the contract's
// fields even if the stored record ever gains more. Anything missing or malformed is a 503: the
// page then keeps its build-time "as of" text.

import { dispatchRefresh, type TriggerEnv } from './refresh-trigger.ts';

export const FRESHNESS_PATH = '/running/api/freshness';
export const FRESHNESS_KEY = 'public/freshness.json';

// The subset of the Workers runtime types this file uses (R2Bucket.get, the assets Fetcher).
interface StoredObject {
  text(): Promise<string>;
}

export interface Env extends TriggerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  FRESHNESS: { get(key: string): Promise<StoredObject | null> };
}

// utcTimestamp in schemas/defs.schema.json: second precision, always Z.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

interface Freshness {
  intervals: { last_success_at: string };
  generated_at: string;
}

function timestamp(value: unknown): string | undefined {
  return typeof value === 'string' && UTC_TIMESTAMP.test(value) ? value : undefined;
}

export function parseFreshness(text: string): Freshness | undefined {
  let record: unknown;
  try {
    record = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof record !== 'object' || record === null) return undefined;
  const { intervals, generated_at } = record as Record<string, unknown>;
  const lastSuccess =
    typeof intervals === 'object' && intervals !== null
      ? timestamp((intervals as Record<string, unknown>).last_success_at)
      : undefined;
  const generated = timestamp(generated_at);
  if (!lastSuccess || !generated) return undefined;
  return { intervals: { last_success_at: lastSuccess }, generated_at: generated };
}

function respond(method: string, status: number, body: string, headers: HeadersInit): Response {
  return new Response(method === 'HEAD' ? null : body, { status, headers });
}

async function freshness(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  let record: Freshness | undefined;
  try {
    const object = await env.FRESHNESS.get(FRESHNESS_KEY);
    record = object ? parseFreshness(await object.text()) : undefined;
  } catch {
    record = undefined;
  }
  if (!record) {
    return respond(request.method, 503, '{"error":"unavailable"}', {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
  }
  return respond(request.method, 200, JSON.stringify(record), {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  });
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === FRESHNESS_PATH) return freshness(request, env);
    return env.ASSETS.fetch(request);
  },
  scheduled(_controller: unknown, env: Env): Promise<void> {
    return dispatchRefresh(env);
  },
};
