// The PR routine's checks for the current branch (/pr-ready skill): a private-term search, a dist/
// comparison against the branch's base on main, and the PR's own checks once it exists.
//
//   node scripts/process/pr-ready.ts [--suites[=all]] [--no-dist] [--reuse-dist]
//
// --suites runs the PR routine's suites for what the branch changed (suitesFor in lib.ts; =all runs
// every one): `npm test`, `astro check`, ingest's pytest, a SHELL_PREVIEW=1 build with Playwright on
// both projects (with passed, failed and skipped counts per project), and the gate's commands over a
// deploy build. A failure prints its output's tail.
//
// Private terms: one per line in the file named by PRIVATE_TERMS_FILE (default
// C:\temp\private-terms.txt), kept outside the repo. Added lines, new file names, commit messages
// and the PR body are searched. A match prints its place and the term's number and mask, never the
// term or the line, so the report is safe to keep in a transcript.
//
// dist/: the base commit (merge-base with origin/main, so later bot data doesn't show) is built in a
// temporary worktree under spikes/process/out/ (gitignored), the branch in the repo (skipped with
// --reuse-dist, which keeps the current dist/), both as deploy builds, and every file is compared.
// Exits 1 when a private term is found or a check failed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addedLines, diffTrees, ghJson, hashTree, maskTerm, parseTerms, playwrightCounts, run, section, suitesFor, summarisePaths, tail, termMatchers, type Suite } from './lib.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const git = (...args: string[]) => run('git', args, ROOT);
const TERMS_FILE = process.env.PRIVATE_TERMS_FILE ?? 'C:\\temp\\private-terms.txt';
const WORKTREE = join(ROOT, 'spikes', 'process', 'out', 'base');
const ASTRO = join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const LIST_LIMIT = 15;

const args = new Set(process.argv.slice(2));
let attention = false;
const flag = (ok: boolean, text: string) => {
  if (!ok) attention = true;
  console.log(`${ok ? ' ' : '!'} ${text}`);
};

git('fetch', '--quiet');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
const base = git('merge-base', 'HEAD', 'origin/main').trim();
const commits = Number(git('rev-list', '--count', `${base}..HEAD`).trim());
console.log(`# ${branch}: ${commits} commit(s) on ${base.slice(0, 7)}`);
if (git('status', '--porcelain').trim() !== '') flag(false, 'Uncommitted changes: they are not checked. Commit first.');

interface PrView {
  number: number;
  state: string;
  body: string;
  statusCheckRollup: { name?: string; context?: string; conclusion?: string; status?: string; state?: string }[];
  headRefOid: string;
}
let pr: PrView | undefined;
try {
  pr = ghJson<PrView>(['pr', 'view', branch, '--json', 'number,state,body,statusCheckRollup,headRefOid']);
} catch {
  pr = undefined;
}
// `gh pr view <branch>` falls back to a merged or closed PR from an earlier use of the same branch
// name (the upgrade script's chore-speckit-<version>), whose checks say nothing about this branch.
// A PR merged at this very commit is this branch's own, though: the owner can merge while its checks
// still run, and "no PR yet" then hid a failed check (#135, 2026-11-07). Its checks are still read.
const mergedHere = pr?.state === 'MERGED' && pr.headRefOid === git('rev-parse', 'HEAD').trim();
if (pr && pr.state !== 'OPEN' && !mergedHere) pr = undefined;

await section('Private terms', () => {
  if (!existsSync(TERMS_FILE)) {
    console.log(`  Skipped: no term file at ${TERMS_FILE} (set PRIVATE_TERMS_FILE). Search by hand instead.`);
    return;
  }
  const terms = parseTerms(readFileSync(TERMS_FILE, 'utf8'));
  const matchers = termMatchers(terms);
  const places: { where: string; text: string }[] = [
    ...addedLines(git('diff', '--no-color', '--unified=0', base, 'HEAD')).map((l) => ({ where: `${l.file}:${l.line}`, text: l.text })),
    ...git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean).map((file) => ({ where: `file name ${file}`, text: file })),
  ];
  for (const record of git('log', '--format=%h%x00%B%x1e', `${base}..HEAD`).split('\x1e')) {
    const [hash, message] = record.trim().split('\0');
    if (hash && message) message.split('\n').forEach((text, i) => places.push({ where: `commit ${hash} message line ${i + 1}`, text }));
  }
  if (pr) pr.body.split('\n').forEach((text, i) => places.push({ where: `PR #${pr!.number} body line ${i + 1}`, text }));
  let found = 0;
  for (const place of places) {
    matchers.forEach((re, i) => {
      if (re.test(place.text)) {
        found++;
        console.log(`! ${place.where}: term ${i + 1} (${maskTerm(terms[i]!)})`);
      }
    });
  }
  flag(found === 0, `${terms.length} terms over ${places.length} lines: ${found} match(es)`);
});

/** A deploy build (no test previews); `astro check` is left out, as the gate runs it. */
function deployBuild(cwd: string): void {
  run('node', ['scripts/gen-types.ts'], cwd);
  run('node', [ASTRO, 'build', '--silent'], cwd);
}

// Child processes inherit this environment, and a deploy build must not include the previews.
delete process.env.SHELL_PREVIEW;

/** Runs a shell command (fixed text, never input); prints pass or fail, and the output's tail on failure. */
function step(label: string, command: string, cwd: string = ROOT, env: NodeJS.ProcessEnv = process.env): boolean {
  const started = Date.now();
  const result = spawnSync(command, { cwd, env, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const ok = result.status === 0;
  flag(ok, `${label}: ${ok ? 'passed' : `failed (exit ${result.status ?? result.signal})`}, ${Math.round((Date.now() - started) / 1000)} s`);
  if (!ok) for (const line of tail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`, 15)) console.log(`      ${line}`);
  return ok;
}

const BUILD = `node scripts/gen-types.ts && node "${ASTRO}" build --silent`;
const suitesArg = [...args].find((a) => a === '--suites' || a.startsWith('--suites='));
const ALL_SUITES: Suite[] = ['unit', 'astro-check', 'pytest', 'e2e', 'gate'];
const suites: Suite[] = !suitesArg ? [] : suitesArg === '--suites=all' ? ALL_SUITES : suitesFor(git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean));
/** What dist/ holds now: unknown until this run builds it. */
let dist: 'unknown' | 'preview' | 'deploy' = 'unknown';

if (suitesArg) {
  await section('Suites', () => {
    console.log(`  For this branch's changes: ${suites.join(', ') || 'none'}${suites.includes('gate') ? ' (the gate runs after the dist/ comparison)' : ''}`);
    if (suites.includes('unit')) step('npm test', 'npm test');
    if (suites.includes('astro-check')) step('astro check', `node "${ASTRO}" check`);
    if (suites.includes('pytest')) step('pytest', 'uv run pytest -q', join(ROOT, 'ingest'));
    if (suites.includes('e2e')) {
      // A running preview server blocks Playwright's, even on another port.
      spawnSync(`node "${ASTRO}" preview stop`, { cwd: ROOT, shell: true, stdio: 'ignore' });
      dist = 'preview';
      if (step('preview build (SHELL_PREVIEW=1)', BUILD, ROOT, { ...process.env, SHELL_PREVIEW: '1' })) {
        // The JSON report gives the counts per project; `line` keeps the failure output readable.
        const report = join(tmpdir(), 'pr-ready-playwright.json');
        rmSync(report, { force: true });
        step('Playwright, both projects', 'npx playwright test --reporter=line,json', ROOT, { ...process.env, SHELL_PREVIEW: '1', PLAYWRIGHT_JSON_OUTPUT_FILE: report });
        if (existsSync(report)) for (const line of playwrightCounts(JSON.parse(readFileSync(report, 'utf8')))) console.log(`      ${line}`);
      }
    }
  });
}

if (!args.has('--no-dist')) {
  await section(`dist/ against ${base.slice(0, 7)}`, () => {
    if (existsSync(WORKTREE)) git('worktree', 'remove', '--force', WORKTREE);
    git('worktree', 'add', '--detach', '--quiet', WORKTREE, base);
    try {
      deployBuild(WORKTREE);
      if (dist === 'preview' || !args.has('--reuse-dist') || !existsSync(join(ROOT, 'dist'))) deployBuild(ROOT);
      dist = 'deploy';
      const diff = diffTrees(hashTree(join(WORKTREE, 'dist')), hashTree(join(ROOT, 'dist')));
      console.log(`  ${diff.same} identical, ${diff.changed.length} changed, ${diff.added.length} added, ${diff.removed.length} removed`);
      for (const [label, paths] of [['Changed', diff.changed], ['Added', diff.added], ['Removed', diff.removed]] as const) {
        if (paths.length === 0) continue;
        console.log(`  ${label}:`);
        for (const line of summarisePaths(paths, LIST_LIMIT)) console.log(`    ${line}`);
      }
    } finally {
      git('worktree', 'remove', '--force', WORKTREE);
      rmSync(join(ROOT, 'spikes', 'process'), { recursive: true, force: true });
    }
  });
}

if (suites.includes('gate')) {
  await section('Gate commands (deploy build)', () => {
    if (dist !== 'deploy' && !step('deploy build', BUILD)) return;
    const scripts = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
    // In the gate's order (.github/actions/gate/action.yml).
    for (const name of ['validate-data', 'scan-images', 'check-boundaries', 'check-links', 'scan-privacy']) {
      if (scripts[name]) step(name, `npm run ${name} --silent`);
    }
  });
}

await section('PR checks', () => {
  if (!pr) {
    console.log('  No PR for this branch yet: run again after `gh pr create`, until every check is green.');
    return;
  }
  if (mergedHere) console.log(`  #${pr.number} is already merged at this commit; its checks still count:`);
  const pending = pr.statusCheckRollup.filter((c) => (c.status ?? '').toUpperCase() !== 'COMPLETED' && c.state === undefined);
  const bad = pr.statusCheckRollup.filter((c) => !pending.includes(c) && !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes((c.conclusion ?? c.state ?? '').toUpperCase()));
  if (pr.statusCheckRollup.length === 0) {
    flag(false, `#${pr.number}: no checks yet (just pushed?): run again in a minute.`);
    return;
  }
  flag(bad.length === 0 && pending.length === 0, `#${pr.number}: ${pr.statusCheckRollup.length} checks, ${pending.length} pending, ${bad.length} not green`);
  for (const c of [...pending, ...bad]) console.log(`    - ${c.name ?? c.context}: ${c.conclusion || c.status || c.state}`);
});

console.log(attention ? '\n! Something needs action (lines starting with "!").' : '\nReady: no private terms, checks green.');
process.exit(attention ? 1 : 0);
