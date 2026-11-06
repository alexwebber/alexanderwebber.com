// Post-merge checks for one PR (/after-merge skill): its boxes, its checks, main's Gate run for the
// merge commit followed to the end (deploy included), then live checks on the site. Fast-forwards a
// clean local main and deletes the merged local branch, and any other local branch already merged.
//
//   node scripts/process/after-merge.ts <pr> [--live=/path[=text] ...] [--timeout=<minutes>]
//
// --live may repeat: each path must answer 200, and when `=text` is given, the page must contain it.
// Without --live it checks `/` and `/running/`. Exits 1 when anything needs action.
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { checkboxes, ghJson, run, section, SITE } from './lib.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const git = (...args: string[]) => run('git', args, ROOT).trim();
const POLL_MS = 20_000;

const args = process.argv.slice(2);
const pr = args.find((a) => /^\d+$/.test(a));
if (pr === undefined) {
  console.error('Usage: node scripts/process/after-merge.ts <pr> [--live=/path[=text] ...] [--timeout=<minutes>]');
  process.exit(2);
}
const timeoutMinutes = Number(args.find((a) => a.startsWith('--timeout='))?.slice(10) ?? 30);
const live = args.filter((a) => a.startsWith('--live=')).map((a) => a.slice(7));
if (live.length === 0) live.push('/', '/running/');

let attention = false;
const flag = (ok: boolean, text: string) => {
  if (!ok) attention = true;
  console.log(`${ok ? ' ' : '!'} ${text}`);
};

interface Pr {
  state: string;
  title: string;
  body: string;
  headRefName: string;
  mergeCommit: { oid: string } | null;
  statusCheckRollup: { name?: string; context?: string; conclusion?: string; state?: string }[];
}

const view = ghJson<Pr>(['pr', 'view', pr, '--json', 'state,title,body,headRefName,mergeCommit,statusCheckRollup']);
console.log(`# #${pr} ${view.title}`);
if (view.state !== 'MERGED' || view.mergeCommit === null) {
  console.log(`! Not merged (state ${view.state}).`);
  process.exit(1);
}
const sha = view.mergeCommit.oid;

await section('Confirmation boxes', () => {
  const { ticked, unticked } = checkboxes(view.body);
  flag(unticked.length === 0, `${ticked.length} ticked, ${unticked.length} unticked`);
  for (const box of unticked) console.log(`    - ${box.slice(0, 200)}`);
});

await section("The PR's own checks", () => {
  const bad = view.statusCheckRollup.filter((c) => !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes((c.conclusion ?? c.state ?? '').toUpperCase()));
  flag(bad.length === 0, `${view.statusCheckRollup.length} checks, ${bad.length} not green`);
  for (const c of bad) console.log(`    - ${c.name ?? c.context}: ${c.conclusion ?? c.state}`);
});

await section(`main's Gate for ${sha.slice(0, 7)}`, async () => {
  const deadline = Date.now() + timeoutMinutes * 60_000;
  let id: number | undefined;
  for (;;) {
    // --commit needs the full SHA: a short one matches nothing.
    const runs = ghJson<{ databaseId: number; status: string; conclusion: string }[]>(['run', 'list', '--workflow', 'gate.yml', '--commit', sha, '--json', 'databaseId,status,conclusion']);
    const current = runs[0];
    if (current !== undefined) id = current.databaseId;
    if (current?.status === 'completed') break;
    if (Date.now() > deadline) throw new Error(`still ${current?.status ?? 'not started'} after ${timeoutMinutes} min`);
    await sleep(POLL_MS);
  }
  const done = ghJson<{ conclusion: string; url: string; jobs: { name: string; conclusion: string }[] }>(['run', 'view', String(id), '--json', 'conclusion,url,jobs']);
  flag(done.conclusion === 'success', `Gate: ${done.conclusion} ${done.url}`);
  for (const job of done.jobs) flag(job.conclusion === 'success', `  job ${job.name}: ${job.conclusion}`);
  if (!done.jobs.some((j) => /deploy/i.test(j.name))) flag(false, '  no deploy job in this run');
});

/**
 * Fetches a live page, retrying: Node's fetch failed here twice straight after the Gate wait
 * ("fetch failed") while curl and a rerun moments later got 200 (DECISIONS.md 2026-11-06). The last
 * error keeps its cause's code, so a real fault still says why.
 */
async function fetchLive(url: string): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetch(url, { redirect: 'manual' });
    } catch (error) {
      last = error;
      if (attempt < 3) await new Promise((done) => setTimeout(done, 10_000));
    }
  }
  const cause = (last as { cause?: { code?: string; message?: string } }).cause;
  throw new Error(`${(last as Error).message} after 3 tries (${cause?.code ?? cause?.message ?? 'no cause'})`);
}

await section('Live site', async () => {
  for (const spec of live) {
    const [path, text] = spec.split(/=(.*)/s, 2) as [string, string | undefined];
    const response = await fetchLive(`${SITE}${path}`);
    const body = text === undefined ? '' : await response.text();
    const found = text === undefined || body.includes(text);
    flag(response.status === 200 && found, `${path}: ${response.status}${text === undefined ? '' : found ? ', text found' : ', text NOT found'}`);
  }
});

await section('Local clean-up', () => {
  git('fetch', '--prune', '--quiet');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch === view.headRefName && git('status', '--porcelain') === '') git('checkout', '--quiet', 'main');
  if (git('rev-parse', '--abbrev-ref', 'HEAD') === 'main' && git('status', '--porcelain') === '') {
    git('merge', '--ff-only', '--quiet', 'origin/main');
    console.log('  main fast-forwarded.');
  }
  const local = git('branch', '--list', view.headRefName);
  if (local !== '' && git('rev-parse', '--abbrev-ref', 'HEAD') !== view.headRefName) {
    // -D, not -d: a squash or merge commit leaves the branch "unmerged" to git, though the PR merged.
    git('branch', '-D', view.headRefName);
    console.log(`  Deleted local branch ${view.headRefName}.`);
  }
  // Earlier merged branches too: only those whose tip is on origin/main, or is the commit a merged
  // PR merged, so no unmerged work is lost. Anything else is listed and kept.
  const current = git('rev-parse', '--abbrev-ref', 'HEAD');
  const mergedTips = new Set(
    ghJson<{ headRefOid: string }[]>(['pr', 'list', '--state', 'merged', '--limit', '500', '--json', 'headRefOid']).map((p) => p.headRefOid),
  );
  const deleted: string[] = [];
  const kept: string[] = [];
  for (const line of git('for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads/').split('\n')) {
    const [name, tip] = line.split(' ');
    if (!name || !tip || name === 'main' || name === current) continue;
    let onMain = mergedTips.has(tip);
    if (!onMain) {
      try {
        git('merge-base', '--is-ancestor', tip, 'origin/main');
        onMain = true;
      } catch {
        onMain = false;
      }
    }
    if (onMain) {
      git('branch', '-D', name);
      deleted.push(name);
    } else kept.push(name);
  }
  if (deleted.length > 0) console.log(`  Deleted ${deleted.length} other merged local branch(es).`);
  if (kept.length > 0) console.log(`  Kept ${kept.length} local branch(es) with commits not on main: ${kept.join(', ')}`);
});

console.log(attention ? '\n! Something needs action (lines starting with "!").' : '\nAll post-merge checks passed.');
process.exit(attention ? 1 : 0);
