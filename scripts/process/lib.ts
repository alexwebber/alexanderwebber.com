// Shared helpers for the process scripts (session-start, after-merge, pr-ready). They run the same
// in a local Windows session and in a cloud session: Node only, plus `git` and `gh` on the PATH.
// Pure functions are exported for tests/unit/process-lib.test.ts.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { walk } from '../lib/walk.ts';

export const SITE = 'https://alexanderwebber.com';
export const REPO = 'alexwebber/alexanderwebber.com';

/** Runs a command and returns its stdout. Throws with the command's stderr on failure. */
export function run(cmd: string, args: string[], cwd?: string): string {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? '').trim();
    throw new Error(`${cmd} ${args[0] ?? ''} failed: ${firstLine(stderr) || (error as Error).message}`);
  }
}

export function ghJson<T>(args: string[]): T {
  return JSON.parse(run('gh', args)) as T;
}

export function firstLine(text: string): string {
  return text.split(/\r?\n/, 1)[0] ?? '';
}

/** Prints a section heading, then runs `body`; a failure is reported in the section, not thrown. */
export async function section(title: string, body: () => void | Promise<void>): Promise<void> {
  console.log(`\n## ${title}`);
  try {
    await body();
  } catch (error) {
    console.log(`  UNAVAILABLE: ${firstLine((error as Error).message)}`);
  }
}

// --- PR confirmation boxes ---------------------------------------------------------------------

export interface Boxes {
  ticked: string[];
  unticked: string[];
}

/** The task-list boxes in a PR body, outside code fences. */
export function checkboxes(body: string): Boxes {
  const boxes: Boxes = { ticked: [], unticked: [] };
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const match = /^\s*[-*] \[([ xX])\] (.*)$/.exec(line);
    if (match) (match[1] === ' ' ? boxes.unticked : boxes.ticked).push(match[2]!.trim());
  }
  return boxes;
}

// --- Dated triggers (process/triggers.yaml) ----------------------------------------------------

export interface Trigger {
  /** First day the follow-up is due (YYYY-MM-DD). */
  due: string;
  task: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTriggers(text: string): Trigger[] {
  const data: unknown = parse(text, { version: '1.2', schema: 'core' }) ?? [];
  if (!Array.isArray(data)) throw new Error('process/triggers.yaml must be a list');
  return data.map((item: unknown, i) => {
    const entry = item as Partial<Trigger> | null;
    if (typeof entry?.due !== 'string' || !DATE.test(entry.due)) throw new Error(`trigger ${i + 1}: "due" must be a YYYY-MM-DD date`);
    if (typeof entry.task !== 'string' || entry.task.trim() === '') throw new Error(`trigger ${i + 1}: "task" is missing`);
    return { due: entry.due, task: entry.task.trim() };
  });
}

/** Triggers due on or before `today`, and those due within `aheadDays` after it. */
export function dueTriggers(triggers: Trigger[], today: string, aheadDays: number): { due: Trigger[]; soon: Trigger[] } {
  const horizon = addDays(today, aheadDays);
  const sorted = [...triggers].sort((a, b) => a.due.localeCompare(b.due));
  return {
    due: sorted.filter((t) => t.due <= today),
    soon: sorted.filter((t) => t.due > today && t.due <= horizon),
  };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- Skill candidates (process/skill-candidates.yaml) ------------------------------------------

export interface SkillCandidate {
  /** The repeated task, in a few words. */
  task: string;
  /** How many times it has been done by hand (without a skill). */
  times: number;
  /** Where its skill would live. */
  home: 'project' | 'playbook';
  /** The planned work that will next need it, if known: build the skill before that work. */
  next?: string;
}

export function parseCandidates(text: string): SkillCandidate[] {
  const data: unknown = parse(text, { version: '1.2', schema: 'core' }) ?? [];
  if (!Array.isArray(data)) throw new Error('process/skill-candidates.yaml must be a list');
  return data.map((item: unknown, i) => {
    const entry = item as Partial<SkillCandidate> | null;
    if (typeof entry?.task !== 'string' || entry.task.trim() === '') throw new Error(`candidate ${i + 1}: "task" is missing`);
    if (!Number.isInteger(entry.times) || entry.times! < 1) throw new Error(`candidate ${i + 1}: "times" must be a whole number, at least 1`);
    if (entry.home !== 'project' && entry.home !== 'playbook') throw new Error(`candidate ${i + 1}: "home" must be project or playbook`);
    if (entry.next !== undefined && (typeof entry.next !== 'string' || entry.next.trim() === '')) throw new Error(`candidate ${i + 1}: "next" must be text`);
    return { task: entry.task.trim(), times: entry.times!, home: entry.home, ...(entry.next ? { next: entry.next.trim() } : {}) };
  });
}

// --- The PR routine's suites (pr-ready --suites) ------------------------------------------------

export type Suite = 'unit' | 'astro-check' | 'pytest' | 'e2e' | 'gate';

const SUITE_RULES: [Suite, RegExp][] = [
  ['unit', /^(src|scripts|tests|schemas|data|public|\.github)\/|^[^/]+\.(json|ts|mjs)$/],
  ['astro-check', /^(src|scripts|tests|schemas)\/|^[^/]+\.(json|ts|mjs)$/],
  ['pytest', /^(schemas|ingest)\//],
  ['e2e', /^(src|public|data|schemas|tests\/(e2e|a11y|fixtures|helpers))\/|^(astro\.config\.mjs|playwright\.config\.ts|package(-lock)?\.json)$/],
  ['gate', /^(src|public|data|schemas|scripts)\/|^\.github\/actions\/gate\/|^(astro\.config\.mjs|package(-lock)?\.json)$/],
];

/** The suites the PR routine runs for a branch that changed `files` (repo-relative), in run order. */
export function suitesFor(files: string[]): Suite[] {
  return SUITE_RULES.filter(([, pattern]) => files.some((file) => pattern.test(file))).map(([suite]) => suite);
}

/** The last `count` non-blank lines of a command's output, for a failure report. */
export function tail(text: string, count: number): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(-count);
}

// --- Private-term search -----------------------------------------------------------------------

/** One term per line; blank lines and `#` comments are skipped. */
export function parseTerms(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/** A compiled matcher per term: case-insensitive, and not inside a longer word ("Ann" misses "Annual"). */
export function termMatchers(terms: string[]): RegExp[] {
  return terms.map((term) => new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu'));
}

/** Masks a term for output: its first letter and length only, so a log never carries it. */
export function maskTerm(term: string): string {
  return `${term.slice(0, 1)}${'*'.repeat(Math.max(term.length - 1, 0))}`;
}

export interface AddedLine {
  file: string;
  line: number;
  text: string;
}

/** The added lines of a unified diff (`git diff`), with their line numbers in the new file. */
export function addedLines(diff: string): AddedLine[] {
  const out: AddedLine[] = [];
  let file = '';
  let line = 0;
  for (const raw of diff.split('\n')) {
    const text = raw.replace(/\r$/, '');
    if (text.startsWith('+++ ')) {
      file = text.startsWith('+++ b/') ? text.slice(6) : text.slice(4);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (text.startsWith('+')) out.push({ file, line: line++, text: text.slice(1) });
    else if (text.startsWith(' ')) line++;
  }
  return out;
}

// --- dist/ comparison ----------------------------------------------------------------------------

/** sha256 of every file under `dir`, keyed by its path relative to `dir`. */
export function hashTree(dir: string): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const rel of walk(dir, '.')) {
    hashes.set(rel.slice(2), createHash('sha256').update(readFileSync(`${dir}/${rel}`)).digest('hex'));
  }
  return hashes;
}

export interface TreeDiff {
  added: string[];
  removed: string[];
  changed: string[];
  same: number;
}

export function diffTrees(before: Map<string, string>, after: Map<string, string>): TreeDiff {
  const diff: TreeDiff = { added: [], removed: [], changed: [], same: 0 };
  for (const [path, hash] of after) {
    const old = before.get(path);
    if (old === undefined) diff.added.push(path);
    else if (old === hash) diff.same++;
    else diff.changed.push(path);
  }
  for (const path of before.keys()) if (!after.has(path)) diff.removed.push(path);
  for (const list of [diff.added, diff.removed, diff.changed]) list.sort();
  return diff;
}

/** Groups paths for a short report: up to `limit` listed, then a count by extension. */
export function summarisePaths(paths: string[], limit: number): string[] {
  if (paths.length <= limit) return paths;
  const byExt = new Map<string, number>();
  for (const path of paths) {
    const ext = /\.[^./]+$/.exec(path)?.[0] ?? '(none)';
    byExt.set(ext, (byExt.get(ext) ?? 0) + 1);
  }
  const counts = [...byExt].sort((a, b) => b[1] - a[1]).map(([ext, n]) => `${n} ${ext}`);
  return [...paths.slice(0, limit), `... and ${paths.length - limit} more (all: ${counts.join(', ')})`];
}

// --- Small formatting ----------------------------------------------------------------------------

/** "3.2 h ago" from an ISO instant. */
export function hoursAgo(iso: string, now: Date = new Date()): string {
  return `${((now.getTime() - Date.parse(iso)) / 3_600_000).toFixed(1)} h ago`;
}
