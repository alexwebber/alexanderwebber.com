// The site's one Worker (T068; contracts/pipeline.md "Freshness endpoint" and "Refresh trigger").
// Its cron (wrangler.jsonc `triggers`) dispatches refresh.yml; see refresh-trigger.ts.
// GET /running/api/freshness reads public/freshness.json from R2 and returns the last successful
// fetch, so a refresh that finds nothing new needs no commit. GET /running/api/fundraising-freshness
// does the same for fundraising, in fundraising-freshness.ts. Static assets serve first; every
// other path that reaches the Worker falls through to them.
//
// The object is re-shaped rather than passed through, so the response holds only the contract's
// fields even if the stored record ever gains more. Anything missing or malformed is a 503: the
// page then keeps its build-time "as of" text.

import { fundraisingFreshness, FUNDRAISING_FRESHNESS_PATH } from './fundraising-freshness.ts';
import { dispatchRefresh, type TriggerEnv } from './refresh-trigger.ts';
import { serveRecord, timestamp, type FreshnessBucket } from './respond.ts';

export const FRESHNESS_PATH = '/running/api/freshness';
export const FRESHNESS_KEY = 'public/freshness.json';

// The subset of the Workers runtime types this file uses (the assets Fetcher; R2 in respond.ts).
export interface Env extends TriggerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  FRESHNESS: FreshnessBucket;
}

interface Freshness {
  intervals: { last_success_at: string };
  generated_at: string;
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

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === FRESHNESS_PATH) return serveRecord(request, env.FRESHNESS, FRESHNESS_KEY, parseFreshness);
    if (pathname === FUNDRAISING_FRESHNESS_PATH) return fundraisingFreshness(request, env.FRESHNESS);
    return env.ASSETS.fetch(request);
  },
  scheduled(_controller: unknown, env: Env): Promise<void> {
    return dispatchRefresh(env);
  },
};
