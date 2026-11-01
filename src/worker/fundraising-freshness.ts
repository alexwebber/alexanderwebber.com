// GET /running/api/fundraising-freshness (T044, FR-004; specs/002-fundraising/contracts/pipeline.md
// "Freshness route"): when each active campaign's figures were last seen to match the site, from
// public/fundraising-freshness.json, so a read that finds nothing new needs no commit.
//
// It has its own record and route, so neither freshness can fail the other (FR-003). The record is
// re-shaped rather than passed through: an entry with a bad campaign ID or timestamp is dropped,
// and only the contract's fields reach the response. A record that is missing or isn't this shape
// is a 503, and the card keeps its build-time text.
import { serveRecord, timestamp, type FreshnessBucket } from './respond.ts';

export const FUNDRAISING_FRESHNESS_PATH = '/running/api/fundraising-freshness';
export const FUNDRAISING_FRESHNESS_KEY = 'public/fundraising-freshness.json';

// slug in schemas/defs.schema.json.
const CAMPAIGN_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface FundraisingFreshness {
  campaigns: Record<string, { last_read_at: string }>;
  generated_at: string;
}

export function parseFundraisingFreshness(text: string): FundraisingFreshness | undefined {
  let record: unknown;
  try {
    record = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof record !== 'object' || record === null) return undefined;
  const { campaigns, generated_at } = record as Record<string, unknown>;
  const generated = timestamp(generated_at);
  if (!generated || typeof campaigns !== 'object' || campaigns === null || Array.isArray(campaigns)) return undefined;
  const shaped: FundraisingFreshness['campaigns'] = {};
  for (const [id, entry] of Object.entries(campaigns)) {
    const readAt = typeof entry === 'object' && entry !== null ? timestamp((entry as Record<string, unknown>).last_read_at) : undefined;
    if (readAt && CAMPAIGN_ID.test(id)) shaped[id] = { last_read_at: readAt };
  }
  return { campaigns: shaped, generated_at: generated };
}

export function fundraisingFreshness(request: Request, bucket: FreshnessBucket): Promise<Response> {
  return serveRecord(request, bucket, FUNDRAISING_FRESHNESS_KEY, parseFundraisingFreshness);
}
