// The Worker's cron trigger (contracts/pipeline.md "Refresh trigger"): every 2 hours it dispatches
// refresh.yml on main through the GitHub API. GitHub's own `schedule` dropped slots often enough to
// leave 4-hour gaps (2026-10-18), past the 3-hour freshness requirement; Cloudflare cron is
// reliable. refresh.yml keeps a thinner `schedule` as a backup, which skips itself while these
// dispatches arrive and opens an issue when they stop.
//
// The token is a fine-grained GitHub token with Actions: write on this repository only, stored as
// the Worker secret GITHUB_DISPATCH_TOKEN. A failed dispatch throws, so Cloudflare records the
// invocation as failed; the log line holds the status and what to do, never the token.

export interface TriggerEnv {
  GITHUB_DISPATCH_TOKEN?: string;
  REFRESH_REPO: string;
  REFRESH_WORKFLOW: string;
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

const API = 'https://api.github.com';
const USER_AGENT = 'alexanderwebber.com-refresh-trigger (+https://alexanderwebber.com)';
const TIMEOUT_MS = 10_000;

export class DispatchFailed extends Error {
  readonly code: string;
  readonly status: number | undefined;
  readonly likelyCause: string;
  readonly action: string;

  constructor(code: string, status: number | undefined, likelyCause: string, action: string) {
    super(`refresh dispatch failed: ${code}${status === undefined ? '' : ` (HTTP ${status})`}`);
    this.name = 'DispatchFailed';
    this.code = code;
    this.status = status;
    this.likelyCause = likelyCause;
    this.action = action;
  }
}

function failure(status: number): DispatchFailed {
  if (status === 401) {
    return new DispatchFailed(
      'token_rejected',
      status,
      'GITHUB_DISPATCH_TOKEN has expired or been revoked',
      'create a new fine-grained token (Actions: write, this repo only) and run `npx wrangler secret put GITHUB_DISPATCH_TOKEN`',
    );
  }
  if (status === 403 || status === 404) {
    return new DispatchFailed(
      'not_permitted',
      status,
      'the token lacks Actions: write on this repository, or the workflow file was renamed',
      'check the token grants Actions: write on this repo, and REFRESH_REPO/REFRESH_WORKFLOW in wrangler.jsonc',
    );
  }
  if (status === 422) {
    return new DispatchFailed(
      'rejected',
      status,
      'refresh.yml on main has no workflow_dispatch trigger, or the inputs changed',
      'check the workflow_dispatch block in refresh.yml',
    );
  }
  return new DispatchFailed(
    'transient',
    status,
    'GitHub API error or outage',
    'none; the next cron, or the backup schedule, retries',
  );
}

function log(fields: Record<string, unknown>, level: 'info' | 'error' = 'info'): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export async function dispatchRefresh(env: TriggerEnv, fetchImpl: Fetch = fetch): Promise<void> {
  try {
    if (!env.GITHUB_DISPATCH_TOKEN) {
      throw new DispatchFailed(
        'token_missing',
        undefined,
        'the Worker secret GITHUB_DISPATCH_TOKEN is not set',
        'run `npx wrangler secret put GITHUB_DISPATCH_TOKEN`',
      );
    }
    const url = `${API}/repos/${env.REFRESH_REPO}/actions/workflows/${env.REFRESH_WORKFLOW}/dispatches`;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new DispatchFailed('network', undefined, 'GitHub API unreachable or timed out', 'none; the next cron retries');
    }
    if (!response.ok) throw failure(response.status);
    log({ event: 'refresh_dispatched', status: response.status, workflow: env.REFRESH_WORKFLOW });
  } catch (error) {
    if (error instanceof DispatchFailed) {
      log(
        {
          event: 'refresh_dispatch_failed',
          code: error.code,
          status: error.status ?? null,
          likely_cause: error.likelyCause,
          action: error.action,
        },
        'error',
      );
    }
    throw error;
  }
}
