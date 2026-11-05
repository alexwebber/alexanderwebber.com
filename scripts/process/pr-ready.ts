// The PR routine's checks for the current branch (/pr-ready skill): a private-term search, a dist/
// comparison against the branch's base on main, and the PR's own checks once it exists.
//
//   node scripts/process/pr-ready.ts [--no-dist] [--reuse-dist]
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
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { addedLines, diffTrees, ghJson, hashTree, maskTerm, parseTerms, run, section, summarisePaths, termMatchers } from './lib.ts';

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
  body: string;
  statusCheckRollup: { name?: string; context?: string; conclusion?: string; status?: string; state?: string }[];
}
let pr: PrView | undefined;
try {
  pr = ghJson<PrView>(['pr', 'view', branch, '--json', 'number,body,statusCheckRollup']);
} catch {
  pr = undefined;
}

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

if (!args.has('--no-dist')) {
  await section(`dist/ against ${base.slice(0, 7)}`, () => {
    if (existsSync(WORKTREE)) git('worktree', 'remove', '--force', WORKTREE);
    git('worktree', 'add', '--detach', '--quiet', WORKTREE, base);
    try {
      deployBuild(WORKTREE);
      if (!args.has('--reuse-dist') || !existsSync(join(ROOT, 'dist'))) deployBuild(ROOT);
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

await section('PR checks', () => {
  if (!pr) {
    console.log('  No PR for this branch yet: run again after `gh pr create`, until every check is green.');
    return;
  }
  const pending = pr.statusCheckRollup.filter((c) => (c.status ?? '').toUpperCase() !== 'COMPLETED' && c.state === undefined);
  const bad = pr.statusCheckRollup.filter((c) => !pending.includes(c) && !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes((c.conclusion ?? c.state ?? '').toUpperCase()));
  flag(bad.length === 0 && pending.length === 0, `#${pr.number}: ${pr.statusCheckRollup.length} checks, ${pending.length} pending, ${bad.length} not green`);
  for (const c of [...pending, ...bad]) console.log(`    - ${c.name ?? c.context}: ${c.conclusion || c.status || c.state}`);
});

console.log(attention ? '\n! Something needs action (lines starting with "!").' : '\nReady: no private terms, checks green.');
process.exit(attention ? 1 : 0);
