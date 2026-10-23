// Performance budget check (T045; plan.md Constraints, SC-006). Runs the Lighthouse 13.5.0 CLI
// (mobile, the default form factor) against one page of each type and checks:
// - performance score >= 90, and no failing accessibility (axe) audit
// - Running landing LCP <= 2.5 s
// - same-origin JS <= 10 KB gzip (the race-map script excepted)
// - HTML+CSS+JS <= 150 KB gzip
// - zero third-party requests on load
//
//   node scripts/lighthouse-budget.mjs                        # against astro preview of dist/
//   node scripts/lighthouse-budget.mjs --base-url=https://... # against a deployed site
//
// Page types that don't exist yet (not built, or 404 remotely) are skipped and listed. Results go
// to stdout, and to the job summary when GITHUB_STEP_SUMMARY is set. Non-blocking: quality.yml
// runs it, the build gate doesn't.
import { execFile, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';

const execFileAsync = promisify(execFile);

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const PORT = 4322;
const KB = 1024;
const BUDGET = { performance: 90, landingLcpMs: 2500, jsGzip: 10 * KB, pageGzip: 150 * KB };
// The race page's interactive map loads on click, so it should never be in a load-time trace;
// if it ever is, it doesn't count against the JS budget (plan.md Constraints).
const MAP_SCRIPT = /maplibre|race-map/i;

/** First built page under dist/<dir>/ (e.g. one run page), as a site path. */
function firstBuilt(dir) {
  const full = join(DIST, dir);
  if (!existsSync(full)) return undefined;
  const entry = readdirSync(full, { withFileTypes: true }).find(
    (e) => e.isDirectory() && existsSync(join(full, e.name, 'index.html')),
  );
  return entry ? `/${dir}/${entry.name}/` : undefined;
}

const PAGE_TYPES = [
  { type: 'site home', path: () => '/' },
  { type: 'running landing', path: () => '/running/', landing: true },
  { type: 'goals', path: () => '/running/goals/' },
  { type: 'training', path: () => '/running/training/' },
  { type: 'training year', path: () => firstBuilt('running/training') },
  { type: 'run', path: () => firstBuilt('running/runs') },
  { type: 'races', path: () => '/running/races/' },
  { type: 'race', path: () => firstBuilt('running/races') },
  { type: 'health', path: () => '/running/health/' },
];

async function exists(baseUrl, path, local) {
  if (local) return existsSync(join(DIST, path, 'index.html'));
  const res = await fetchRetrying(new URL(path, baseUrl), { method: 'HEAD', redirect: 'follow' });
  return res.ok;
}

async function startPreview() {
  // CLAUDECODE/AI_AGENT cleared: Astro 7 backgrounds `astro preview` under a coding agent.
  const child = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, CLAUDECODE: '', AI_AGENT: '' },
    stdio: 'ignore',
  });
  const url = `http://localhost:${PORT}/`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => child.kill() };
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`astro preview did not start on ${url}`);
}

// Asynchronous, so the event loop keeps running during the 10-20 s Lighthouse takes. A blocking
// spawnSync froze fetch's keep-alive timers, so the next page's first fetch reused a socket the
// preview server had already closed (5 s idle) and failed with "other side closed".
async function runLighthouse(url) {
  const dir = mkdtempSync(join(tmpdir(), 'lh-'));
  const out = join(dir, 'report.json');
  try {
    await execFileAsync(
      'npx',
      [
        'lighthouse',
        url,
        '--only-categories=performance,accessibility',
        '--output=json',
        `--output-path=${out}`,
        '--chrome-flags=--headless=new --no-sandbox',
        '--quiet',
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * KB * KB },
    ).catch((err) => {
      throw new Error(`lighthouse failed for ${url}:\n${err.stderr ?? err.message}`);
    });
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** fetch, retried on a dropped keep-alive socket (a fresh connection then succeeds). */
async function fetchRetrying(url, init) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (err?.cause?.code !== 'UND_ERR_SOCKET' || attempt === 3) throw err;
    }
  }
}

async function gzipBytes(url) {
  const res = await fetchRetrying(url, { headers: { 'accept-encoding': 'identity' } });
  return gzipSync(Buffer.from(await res.arrayBuffer())).length;
}

async function checkPage(page, url, lhr) {
  const failures = [];
  const origin = new URL(url).origin;
  const perf = Math.round((lhr.categories.performance.score ?? 0) * 100);
  if (perf < BUDGET.performance) failures.push(`performance ${perf} < ${BUDGET.performance}`);

  const a11y = Math.round((lhr.categories.accessibility.score ?? 0) * 100);
  const a11yFailed = lhr.categories.accessibility.auditRefs
    .filter((ref) => ref.weight > 0 && lhr.audits[ref.id].score === 0)
    .map((ref) => ref.id);
  if (a11yFailed.length > 0) failures.push(`accessibility audits failed: ${a11yFailed.join(', ')}`);

  const lcp = lhr.audits['largest-contentful-paint'].numericValue;
  if (page.landing && lcp > BUDGET.landingLcpMs) failures.push(`LCP ${(lcp / 1000).toFixed(2)} s > 2.5 s`);

  const requests = (lhr.audits['network-requests'].details?.items ?? []).filter((r) => /^https?:/.test(r.url));
  const thirdParty = requests.filter((r) => new URL(r.url).origin !== origin);
  if (thirdParty.length > 0) failures.push(`third-party requests: ${thirdParty.map((r) => new URL(r.url).host).join(', ')}`);

  let js = 0;
  let total = 0;
  for (const r of requests) {
    if (new URL(r.url).origin !== origin || !['Document', 'Stylesheet', 'Script'].includes(r.resourceType)) continue;
    const size = await gzipBytes(r.url);
    total += size;
    if (r.resourceType === 'Script' && !MAP_SCRIPT.test(r.url)) js += size;
  }
  if (js > BUDGET.jsGzip) failures.push(`JS ${(js / KB).toFixed(1)} KB gzip > 10 KB`);
  if (total > BUDGET.pageGzip) failures.push(`HTML+CSS+JS ${(total / KB).toFixed(1)} KB gzip > 150 KB`);

  return { type: page.type, url, perf, a11y, lcp, js, total, thirdParty: thirdParty.length, failures };
}

function report(results, skipped) {
  const lines = [
    '## Lighthouse budget (mobile)',
    '',
    '| Page | Perf | A11y | LCP | JS gzip | HTML+CSS+JS gzip | 3rd-party | Result |',
    '|---|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.type} (\`${new URL(r.url).pathname}\`) | ${r.perf} | ${r.a11y} | ${(r.lcp / 1000).toFixed(2)} s | ` +
        `${(r.js / KB).toFixed(1)} KB | ${(r.total / KB).toFixed(1)} KB | ${r.thirdParty} | ` +
        `${r.failures.length === 0 ? 'pass' : `**fail**: ${r.failures.join('; ')}`} |`,
    ),
  ];
  if (skipped.length > 0) lines.push('', `Not built yet, skipped: ${skipped.join(', ')}.`);
  const text = lines.join('\n') + '\n';
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
}

const baseArg = process.argv.find((a) => a.startsWith('--base-url='))?.slice('--base-url='.length);
const local = !baseArg;
if (local && !existsSync(DIST)) {
  console.error('lighthouse-budget: dist/ not found; run `npm run build` first');
  process.exit(1);
}
const server = local ? await startPreview() : undefined;
const baseUrl = baseArg ?? server.url;
const results = [];
const skipped = [];
try {
  for (const page of PAGE_TYPES) {
    const path = page.path();
    if (!path || !(await exists(baseUrl, path, local))) {
      skipped.push(page.type);
      continue;
    }
    const url = new URL(path, baseUrl).href;
    results.push(await checkPage(page, url, await runLighthouse(url)));
  }
} finally {
  server?.stop();
}
report(results, skipped);
if (results.some((r) => r.failures.length > 0)) process.exit(1);
