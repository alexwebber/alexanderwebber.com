// Imports the CV from the private career record's export (specs/004-interactive-cv/contracts/
// content-files.md *scripts/import-cv.ts*, research.md R4; FR-021 to FR-023). The only way text
// reaches data/cv/:
//
//   node scripts/import-cv.ts --from=<export.json> --rules-checked=<YYYY-MM-DD> [--dry-run] [--root=<dir>]
//
// 1. Validates the export against schemas/cv/export.schema.json.
// 2. Refuses: an item without approved_on; a phone number in any text (PDF text comes in slice 5,
//    T090); text over budget; a dangling reference; a thread with fewer than two changes; a change,
//    role or next item without a card; months outside the as_of year; an export without
//    page.sharing_rules_confirmed, and --rules-checked earlier than it (FR-023); and anything else
//    the CV's own files would fail (their schemas and the rules across items), checked on the files
//    as they would be written, before anything is.
// 3. Writes page.yaml, blocks.yaml, timeline.yaml and downloads.yaml, each item with
//    approved: {date: approved_on, source, sha256}, and copies the PDFs into data/cv/downloads/,
//    replacing older versions at the same names (FR-020) and removing any the export no longer lists.
//    Then re-reads what it wrote through the store and fails if anything doesn't load.
// 4. Prints counts per kind and the files written. On refusal, exits 1 with one line per refusal:
//    file, kind, id and reason, never the text (contracts/content-files.md *Messages*).
//
// --dry-run stops after the checks and writes nothing. --root (default: this repository) lets the
// preview generator and drills write into another folder; the schemas are always this repository's.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { stringify } from 'yaml';
import {
  BLOCKS_FILE,
  cvSchemas,
  DOWNLOADS_DIR,
  DOWNLOADS_FILE,
  FILE_SCHEMA,
  itemName,
  loadCvData,
  locate,
  NO_APPROVAL,
  NO_CARD,
  PAGE_FILE,
  schemaMessage,
  TIMELINE_FILE,
  type CvData,
  type CvDownloadFile,
} from '../src/sections/cv/data/store/files.ts';
import { itemSha256, type CvKind } from '../src/sections/cv/domain/hashes.ts';
import { crossItemIssues } from '../src/sections/cv/validate.ts';
import type { CvExport } from '../src/sections/cv/data/store/index.ts';
import { isMain } from './lib/walk.ts';

const REPO = resolve(import.meta.dirname, '..');
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const STAND_IN_DATE = '2000-01-01';
const HEADER = "# Written by scripts/import-cv.ts from the career record's export. Don't edit it by hand: an edit\n# breaks the item's approval, and the build refuses it (specs/004-interactive-cv).\n";

export interface ImportOptions {
  /** The export file. */
  from: string;
  /** The day the owner last re-confirmed the sharing rules, as told to the import (YYYY-MM-DD). */
  rulesChecked: string;
  dryRun?: boolean;
  /** Where data/cv/ is written. Default: this repository. */
  root?: string;
}

export interface ImportResult {
  ok: boolean;
  /** Counts and files written, or one line per refusal. Never CV text. */
  lines: string[];
}

interface Refusal {
  file: string;
  entry: string;
  field: string;
  message: string;
}

const line = (r: Refusal) => [r.file, r.entry, r.field, r.message].filter(Boolean).join(': ');

/** Where an export path's item goes, for messages: `timeline.changes[3]` -> timeline.yaml, `change <id>`. */
function locateInExport(value: unknown, path: (string | number)[]): Omit<Refusal, 'message'> {
  const [top, ...rest] = path;
  if (top === 'page') return { file: PAGE_FILE, ...locate(PAGE_FILE, at(value, 'page'), rest) };
  if (top === 'blocks') return { file: BLOCKS_FILE, ...locate(BLOCKS_FILE, { blocks: at(value, 'blocks') }, path) };
  if (top === 'timeline') return { file: TIMELINE_FILE, ...locate(TIMELINE_FILE, at(value, 'timeline'), rest) };
  if (top === 'downloads') return { file: DOWNLOADS_FILE, ...locate(DOWNLOADS_FILE, { downloads: at(value, 'downloads') }, path) };
  return { file: 'export', entry: '', field: path.join('.') };
}

const TIMELINE_LISTS: [keyof CvExport['timeline'], CvKind][] = [['themes', 'theme'], ['threads', 'thread'], ['roles', 'role'], ['changes', 'change'], ['next', 'next']];

/** Runs the import. Never throws for a refused export: `ok` is false and `lines` say why. */
export function importCv(options: ImportOptions): ImportResult {
  const root = resolve(options.root ?? REPO);
  const fromPath = resolve(options.from);
  const refusals: Refusal[] = [];
  const refuse = (file: string, entry: string, field: string, message: string) => refusals.push({ file, entry, field, message });
  const refused = (): ImportResult => ({ ok: false, lines: refusals.map(line) });

  if (!DATE.test(options.rulesChecked)) return { ok: false, lines: ['--rules-checked: is not a date (expected YYYY-MM-DD)'] };
  if (!existsSync(fromPath)) return { ok: false, lines: ['--from: no such file'] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(fromPath, 'utf8'));
  } catch {
    return { ok: false, lines: ['export: is not valid JSON'] };
  }

  // 1. The export's schema.
  const schemas = cvSchemas(REPO);
  for (const problem of schemas.validate('cv/export', raw)) {
    const where = locateInExport(raw, problem.path);
    refuse(where.file, where.entry, where.field, schemaMessage(raw, problem));
  }
  if (refusals.length > 0) return refused();
  const exp = raw as CvExport;

  // 2. What only the export can lack: approvals, cards, the sharing rules' date, the PDFs.
  const approvalOf = (file: string, kind: CvKind, item: { approved_on?: string }, index: number) => {
    if (item.approved_on === undefined) refuse(file, itemName(kind, item, index), '', NO_APPROVAL);
  };
  approvalOf(PAGE_FILE, 'page', exp.page, 0);
  exp.blocks.forEach((b, i) => approvalOf(BLOCKS_FILE, 'block', b, i));
  for (const [list, kind] of TIMELINE_LISTS) {
    (exp.timeline[list] as { approved_on?: string; card?: string }[]).forEach((item, i) => {
      approvalOf(TIMELINE_FILE, kind, item, i);
      if ((kind === 'change' || kind === 'role' || kind === 'next') && item.card === undefined) refuse(TIMELINE_FILE, itemName(kind, item, i), '', NO_CARD);
    });
  }
  exp.downloads.forEach((d, i) => approvalOf(DOWNLOADS_FILE, 'download', d, i));
  const confirmed = exp.page.sharing_rules_confirmed;
  if (confirmed === undefined) refuse(PAGE_FILE, 'page', 'sharing_rules_confirmed', 'is missing: the export must carry the day the owner last re-confirmed the sharing rules (FR-023)');
  else if (options.rulesChecked < confirmed) refuse(PAGE_FILE, 'page', 'sharing_rules_confirmed', 'is later than --rules-checked: check the sharing rules with the owner again (FR-023)');

  const exportDir = dirname(fromPath);
  const pdfs = new Map<string, Uint8Array>();
  exp.downloads.forEach((d, i) => {
    const path = resolve(exportDir, d.path);
    if (!`${path}${sep}`.startsWith(`${exportDir}${sep}`) || !existsSync(path)) refuse(DOWNLOADS_FILE, itemName('download', d, i), 'path', "isn't a file beside the export");
    else pdfs.set(d.file, readFileSync(path));
  });

  // 3. The files as they would be written, through the CV's own schemas and rules.
  const source = exp.source;
  const approve = <T extends { approved_on?: string }>(kind: CvKind, item: T, bytes?: Uint8Array) => {
    const { approved_on, ...fields } = item;
    // An item already refused (no approval, no PDF) gets a stand-in, so it isn't refused twice.
    const date = approved_on ?? STAND_IN_DATE;
    const sha256 = kind === 'download' && !bytes ? '0'.repeat(64) : itemSha256(kind, fields, bytes);
    return { ...fields, approved: { date, source, sha256 } };
  };
  const page = { ...approve('page', exp.page), sharing_rules_confirmed: confirmed ?? STAND_IN_DATE };
  const files: Record<string, unknown> = {
    [PAGE_FILE]: reorderPage(page),
    [BLOCKS_FILE]: { blocks: exp.blocks.map((b) => approve('block', b)) },
    [TIMELINE_FILE]: Object.fromEntries(TIMELINE_LISTS.map(([list, kind]) => [list, (exp.timeline[list] as { approved_on?: string }[]).map((item) => approve(kind, item))])),
    [DOWNLOADS_FILE]: { downloads: exp.downloads.map(({ path: _path, ...d }) => approve('download', d, pdfs.get(d.file))) },
  };
  const reported = new Set(refusals.map(line));
  let schemaClean = true;
  for (const [file, value] of Object.entries(files)) {
    for (const problem of schemas.validate(FILE_SCHEMA[file]!, value)) {
      schemaClean = false;
      const message = schemaMessage(value, problem);
      const r = { file, ...locate(file, value, problem.path), message };
      // Already refused above, in the export's own words.
      if (message === NO_APPROVAL || message === NO_CARD || reported.has(line(r))) continue;
      refusals.push(r);
    }
  }
  if (schemaClean) {
    const data: CvData = {
      page: files[PAGE_FILE] as CvData['page'],
      blocks: (files[BLOCKS_FILE] as { blocks: CvData['blocks'] }).blocks,
      timeline: files[TIMELINE_FILE] as CvData['timeline'],
      downloads: (files[DOWNLOADS_FILE] as { downloads: CvDownloadFile[] }).downloads.map((d) => ({ ...d, path: `${DOWNLOADS_DIR}/${d.file}` })),
    };
    for (const issue of crossItemIssues(data)) refuse(issue.file, issue.entry, issue.field, issue.message);
  }
  if (refusals.length > 0) return refused();

  const counts = [
    'page 1',
    `blocks ${exp.blocks.length}`,
    ...TIMELINE_LISTS.map(([list]) => `${list === 'next' ? 'next items' : list} ${exp.timeline[list].length}`),
    `downloads ${exp.downloads.length}`,
  ].join(', ');
  if (options.dryRun) return { ok: true, lines: [`import-cv: dry run, nothing written: ${counts}`] };

  // 4. Write, then read it all back through the store.
  const written: string[] = [];
  mkdirSync(join(root, DOWNLOADS_DIR), { recursive: true });
  for (const [file, value] of Object.entries(files)) {
    writeFileSync(join(root, file), HEADER + stringify(value, { lineWidth: 0 }));
    written.push(file);
  }
  for (const [name, bytes] of pdfs) {
    writeFileSync(join(root, DOWNLOADS_DIR, name), bytes);
    written.push(`${DOWNLOADS_DIR}/${name}`);
  }
  for (const name of readdirSync(join(root, DOWNLOADS_DIR))) {
    if (!pdfs.has(name)) {
      rmSync(join(root, DOWNLOADS_DIR, name));
      written.push(`${DOWNLOADS_DIR}/${name} (removed: no longer in the export)`);
    }
  }
  const check = loadCvData(root, REPO);
  const errors = check.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0 || !check.data) {
    return { ok: false, lines: ['import-cv: what was written does not load; data/cv/ needs restoring from git', ...errors.map((i) => line({ file: i.file, entry: i.entry, field: i.field, message: i.message }))] };
  }
  return { ok: true, lines: [`import-cv: ${counts}`, ...written.map((f) => `wrote ${relative(root, join(root, f)).split(sep).join('/')}`)] };
}

/** page.yaml in the order of data-model.md, with the two settings before the approval. */
function reorderPage(page: Record<string, unknown>): Record<string, unknown> {
  const { approved, listed, sharing_rules_confirmed, ...fields } = page;
  return { ...fields, listed, sharing_rules_confirmed, approved };
}

function at(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function main(): void {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const from = arg('from');
  const rulesChecked = arg('rules-checked');
  if (!from || !rulesChecked) {
    console.error('usage: node scripts/import-cv.ts --from=<export.json> --rules-checked=<YYYY-MM-DD> [--dry-run] [--root=<dir>]');
    process.exit(2);
  }
  const result = importCv({ from, rulesChecked, dryRun: process.argv.includes('--dry-run'), root: arg('root') });
  for (const out of result.lines) (result.ok ? console.log : console.error)(out);
  if (!result.ok) process.exit(1);
}

if (isMain(import.meta.url)) main();
