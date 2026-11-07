// Session-start checks, in one report (/session-start skill). Read-only, except that it fetches and
// fast-forwards a clean local `main`, so the auto-loaded PROJECT_MEMORY.md is current.
//
//   node scripts/process/session-start.ts
//
// Sections: git, main's workflows, open issues, security alerts, PRs (open, and recently merged with
// unticked boxes), live freshness, versions, dated triggers, skill candidates. A section that can't
// run (e.g. no `gh api` in a cloud session) says UNAVAILABLE and the rest carry on. Lines needing
// action start with "!".
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { today as londonToday } from '../../src/shared/format/dates.ts';
import { checkboxes, dueTriggers, ghJson, hoursAgo, parseCandidates, parseTriggers, REPO, run, section, SITE } from './lib.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const git = (...args: string[]) => run('git', args, ROOT).trim();

/** Core npm packages whose new releases we adopt (PROJECT_MEMORY.md working norms). */
const CORE_NPM = ['astro', '@astrojs/check', 'wrangler', 'satori', 'maplibre-gl', 'typescript'];
/** Deliberate holds (DECISIONS.md): shown with the reason instead of a "!". Remove one when it ends. */
const HOLDS: Record<string, string> = {
  typescript: 'deliberate pin while @astrojs/check excludes TypeScript 7',
  wrangler: 'held at 4.152.0: newer releases depend on a miniflare 5 beta',
};
/** Merged PRs whose unticked boxes the owner answered elsewhere (DECISIONS.md): shown as settled, not a "!". */
const SETTLED: Record<number, string> = {
  101: 'photos box answered in a comment, 2026-11-01',
  125: 'list look kept as is, owner at session start, 2026-11-06',
  133: 'phone fine, desktop title fixed in a small PR, owner at the guided review, 2026-11-07',
};
const STALE_HOURS = 6;
const TRIGGER_LOOKAHEAD_DAYS = 14;
const RECENT_MERGE_DAYS = 7;

interface Run {
  workflowName: string;
  status: string;
  conclusion: string;
  createdAt: string;
  url: string;
}

/** A package's registry URL; a scoped name's slash is encoded, as the registry expects. */
function npmUrl(name: string, version: string): string {
  return `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
}

async function npmLatest(name: string): Promise<{ version: string; dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }> {
  const response = await fetch(npmUrl(name, 'latest'));
  if (!response.ok) throw new Error(`npm registry answered ${response.status} for ${name}`);
  return response.json() as Promise<{ version: string }>;
}

async function npmVersion(name: string, version: string): Promise<{ dependencies?: Record<string, string> }> {
  const response = await fetch(npmUrl(name, version));
  if (!response.ok) throw new Error(`npm registry answered ${response.status} for ${name}@${version}`);
  return response.json() as Promise<{ dependencies?: Record<string, string> }>;
}

await section('Git', () => {
  git('fetch', '--prune', '--quiet');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const dirty = git('status', '--porcelain') !== '';
  const behind = Number(git('rev-list', '--count', `${branch}..origin/main`));
  if (branch === 'main' && !dirty && behind > 0) {
    git('merge', '--ff-only', '--quiet', 'origin/main');
    console.log(`  main fast-forwarded by ${behind} commit(s). If PROJECT_MEMORY.md changed, re-read its Next session block.`);
  } else if (branch === 'main') {
    console.log(behind === 0 ? '  main is up to date.' : `! main is ${behind} behind origin/main and has local changes: not fast-forwarded.`);
  } else {
    const ahead = Number(git('rev-list', '--count', `origin/main..${branch}`));
    console.log(`  On ${branch}${dirty ? ' (uncommitted changes)' : ''}: ${ahead} ahead of origin/main, ${behind} behind.`);
  }
});

await section("main's workflows", () => {
  const runs = ghJson<Run[]>(['run', 'list', '--branch', 'main', '--limit', '80', '--json', 'workflowName,status,conclusion,createdAt,url']);
  const latest = new Map<string, Run>();
  for (const r of runs) if (r.status === 'completed' && !latest.has(r.workflowName)) latest.set(r.workflowName, r);
  for (const [name, r] of [...latest].sort()) {
    const ok = r.conclusion === 'success' || r.conclusion === 'skipped';
    console.log(`${ok ? ' ' : '!'} ${name}: ${r.conclusion} (${r.createdAt})${ok ? '' : ` ${r.url}`}`);
  }
  const running = runs.filter((r) => r.status !== 'completed');
  if (running.length > 0) console.log(`  In progress: ${running.map((r) => r.workflowName).join(', ')}`);
  const since = Date.now() - 24 * 3_600_000;
  const refreshes = runs.filter((r) => r.workflowName === 'Refresh' && Date.parse(r.createdAt) >= since);
  const failed = refreshes.filter((r) => r.status === 'completed' && r.conclusion !== 'success');
  console.log(`${refreshes.length < 8 || failed.length > 0 ? '!' : ' '} Refresh runs in the last 24 h: ${refreshes.length} (about 12 expected), ${failed.length} not green.`);
});

await section('Open issues', () => {
  const issues = ghJson<{ number: number; title: string }[]>(['issue', 'list', '--state', 'open', '--json', 'number,title']);
  if (issues.length === 0) console.log('  None.');
  for (const i of issues) console.log(`! #${i.number} ${i.title}`);
});

await section('Security alerts (open)', () => {
  for (const kind of ['dependabot', 'code-scanning', 'secret-scanning']) {
    const alerts = ghJson<unknown[]>(['api', `repos/${REPO}/${kind}/alerts?state=open&per_page=100`]);
    const flag = alerts.length === 0 ? ' ' : '!';
    console.log(`${flag} ${kind}: ${alerts.length}${kind === 'secret-scanning' && alerts.length > 0 ? ' (raise with the owner at once)' : ''}`);
  }
});

await section('Pull requests', () => {
  const open = ghJson<{ number: number; title: string; headRefName: string }[]>(['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName']);
  for (const pr of open) console.log(`  Open: #${pr.number} ${pr.title} (${pr.headRefName})`);
  if (open.length === 0) console.log('  No open PRs.');
  const merged = ghJson<{ number: number; title: string; mergedAt: string; body: string }[]>(['pr', 'list', '--state', 'merged', '--limit', '20', '--json', 'number,title,mergedAt,body']);
  const since = Date.now() - RECENT_MERGE_DAYS * 86_400_000;
  for (const pr of merged.filter((p) => Date.parse(p.mergedAt) >= since)) {
    const { unticked } = checkboxes(pr.body);
    if (unticked.length === 0) continue;
    if (SETTLED[pr.number]) {
      console.log(`  #${pr.number}: ${unticked.length} unticked box(es), settled (${SETTLED[pr.number]})`);
      continue;
    }
    console.log(`! #${pr.number} merged with ${unticked.length} unticked box(es): ask the owner before building on them.`);
    for (const box of unticked) console.log(`    - ${box.slice(0, 160)}`);
  }
});

await section('Live freshness', async () => {
  const running = (await (await fetch(`${SITE}/running/api/freshness`)).json()) as { intervals?: { last_success_at?: string } };
  const fundraising = (await (await fetch(`${SITE}/running/api/fundraising-freshness`)).json()) as { campaigns?: Record<string, { last_read_at?: string }> };
  const stale = (iso: string | undefined) => iso === undefined || Date.now() - Date.parse(iso) > STALE_HOURS * 3_600_000;
  const last = running.intervals?.last_success_at;
  console.log(`${stale(last) ? '!' : ' '} Running data: last success ${last ? hoursAgo(last) : 'missing'}`);
  for (const [id, c] of Object.entries(fundraising.campaigns ?? {})) {
    console.log(`${stale(c.last_read_at) ? '!' : ' '} Fundraising ${id}: last read ${c.last_read_at ? hoursAgo(c.last_read_at) : 'missing'}`);
  }
});

await section('Versions', async () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const pins = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of CORE_NPM) {
    const latest = await npmLatest(name);
    const ours = pins[name] ?? '(not a dependency)';
    const current = ours === latest.version;
    const hold = current ? undefined : HOLDS[name];
    console.log(`${current || hold ? ' ' : '!'} ${name}: ours ${ours}, latest ${latest.version}${hold ? ` (${hold})` : ''}`);
    if (name === '@astrojs/check') console.log(`    its TypeScript peer range: ${latest.peerDependencies?.typescript ?? '(none)'}`);
  }
  // The two npm overrides stay until the packages that pin the vulnerable versions ship fixed ones.
  const satori = await npmLatest('satori');
  console.log(`  Override fflate 0.7.5: latest satori pins fflate ${satori.dependencies?.fflate ?? '(none)'}`);
  const wrangler = await npmLatest('wrangler');
  const miniflare = wrangler.dependencies?.miniflare;
  const undici = miniflare ? (await npmVersion('miniflare', miniflare)).dependencies?.undici : undefined;
  console.log(`  Override undici 7.30.1: latest wrangler uses miniflare ${miniflare ?? '?'}, which pins undici ${undici ?? '?'}`);

  const checkVersions = 'C:\\Projects\\software-factory\\scripts\\check-versions.ps1';
  if (process.platform === 'win32' && existsSync(checkVersions)) {
    const out = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', checkVersions]);
    for (const line of out.split(/\r?\n/).filter((l) => /\S/.test(l))) console.log(`    ${line.trimEnd()}`);
  } else {
    console.log('  check-versions.ps1: not run here (needs the local Windows checkout of software-factory).');
  }
});

await section('Dated triggers (process/triggers.yaml)', () => {
  const today = londonToday();
  const { due, soon } = dueTriggers(parseTriggers(readFileSync(join(ROOT, 'process', 'triggers.yaml'), 'utf8')), today, TRIGGER_LOOKAHEAD_DAYS);
  if (due.length === 0) console.log('  Nothing due.');
  for (const t of due) console.log(`! Due since ${t.due}: ${t.task}`);
  for (const t of soon) console.log(`  Coming ${t.due}: ${t.task}`);
});

await section('Skill candidates (process/skill-candidates.yaml)', () => {
  const candidates = parseCandidates(readFileSync(join(ROOT, 'process', 'skill-candidates.yaml'), 'utf8'));
  const planned = candidates.filter((c) => c.next);
  console.log(`  ${candidates.length} tasks done by hand without a skill; build each before the work it names.`);
  for (const c of planned) console.log(`  ${c.task} (${c.times}x, ${c.home}): before ${c.next}`);
});
