// The CV's file map (specs/004-interactive-cv/contracts/content-files.md): reads and schema-validates
// data/cv/page.yaml, blocks.yaml, timeline.yaml and downloads.yaml, and recomputes every item's
// approval hash, the listed PDFs' bytes included (research.md R3). Shared by CvStore, which throws on
// any error, and ../../validate.ts, which adds the rules across items and reports everything at once.
//
// Approvals are checked here, not in validate.ts, because the store and the build's first step load
// through this: no build path can render text that wasn't approved (FR-022).
//
// Messages name the file, the kind and the id (`change change-a`), and the field and rule; they never
// quote a value from the files (contracts/content-files.md *Messages*): the shared schema messages'
// leading value is dropped.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fieldPath, listDataFiles, parseDataFile, SchemaSet, type DataIssue, type SchemaIssue } from '../../../../shared/storage/index.ts';
import { itemSha256, type CvKind } from '../../domain/hashes.ts';
import type { CvBlocks, CvDownloads, CvPage, CvTimeline } from './generated/index.ts';
import { CV_SCHEMAS, type CvSchema } from './schemas.ts';

export const DATA_DIR = 'data/cv';
export const DOWNLOADS_DIR = `${DATA_DIR}/downloads`;
export const PAGE_FILE = `${DATA_DIR}/page.yaml`;
export const BLOCKS_FILE = `${DATA_DIR}/blocks.yaml`;
export const TIMELINE_FILE = `${DATA_DIR}/timeline.yaml`;
export const DOWNLOADS_FILE = `${DATA_DIR}/downloads.yaml`;

export type CvBlock = CvBlocks['blocks'][number];
export type CvStory = NonNullable<CvBlock['stories']>[number];
export type CvTheme = CvTimeline['themes'][number];
export type CvThread = CvTimeline['threads'][number];
export type CvRole = CvTimeline['roles'][number];
export type CvChange = CvTimeline['changes'][number];
export type CvNextItem = CvTimeline['next'][number];
export type CvDownload = CvDownloads['downloads'][number];
export type { CvBlocks, CvDownloads, CvPage, CvTimeline };

/** A download whose PDF is in data/cv/downloads/. `path` is repo-relative. */
export type CvDownloadFile = CvDownload & { path: string };

export interface CvData {
  page: CvPage;
  /** In page order. */
  blocks: CvBlock[];
  timeline: CvTimeline;
  /** The downloads whose PDF is present (a missing one is hidden, with a warning). */
  downloads: CvDownloadFile[];
}

export interface CvLoadResult {
  /** Undefined when there is no data/cv/page.yaml: no CV, whatever else is there. */
  data: CvData | undefined;
  issues: DataIssue[];
}

/** The noun messages use for each kind: `change change-a`, `next item next-a`. */
export const KIND_NOUN: Readonly<Record<CvKind, string>> = {
  page: 'page',
  block: 'block',
  theme: 'theme',
  thread: 'thread',
  role: 'role',
  change: 'change',
  next: 'next item',
  download: 'download',
};

export const FILE_SCHEMA: Readonly<Record<string, Exclude<CvSchema, 'cv/export'>>> = {
  [PAGE_FILE]: 'cv/page',
  [BLOCKS_FILE]: 'cv/blocks',
  [TIMELINE_FILE]: 'cv/timeline',
  [DOWNLOADS_FILE]: 'cv/downloads',
};

/** The list keys of each file and the kind of their items. */
const LISTS: Readonly<Record<string, Readonly<Record<string, CvKind>>>> = {
  [BLOCKS_FILE]: { blocks: 'block' },
  [TIMELINE_FILE]: { themes: 'theme', threads: 'thread', roles: 'role', changes: 'change', next: 'next' },
  [DOWNLOADS_FILE]: { downloads: 'download' },
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PDF_NAME = /^data\/cv\/downloads\/[^/]+$/;

export const NO_APPROVAL = 'has no approval';
export const STALE_APPROVAL = "approval doesn't match";
export const NO_CARD = 'has no card';

/** How an item is named in messages: `change change-a`, or its position when its id isn't usable. */
export function itemName(kind: CvKind, item: unknown, index?: number): string {
  if (kind === 'page') return 'page';
  const id = kind === 'download' ? at(item, 'kind') : at(item, 'id');
  if (typeof id === 'string' && SLUG.test(id)) return `${KIND_NOUN[kind]} ${id}`;
  return index === undefined ? KIND_NOUN[kind] : `${KIND_NOUN[kind]} ${index + 1}`;
}

/** Splits a JSON path in one of the CV's files into the message's entry (kind and id) and field. */
export function locate(file: string, value: unknown, path: (string | number)[]): { entry: string; field: string } {
  if (file === PAGE_FILE) return { entry: 'page', field: fieldPath(path) };
  const [list, index, ...rest] = path;
  const kind = typeof list === 'string' ? LISTS[file]?.[list] : undefined;
  if (kind && typeof index === 'number') return { entry: itemName(kind, at(at(value, list as string), index), index), field: fieldPath(rest) };
  return { entry: '', field: fieldPath(path) };
}

/** The shared schema messages can start with the offending value; it's dropped, and a missing approval or card says so plainly. */
export function schemaMessage(value: unknown, problem: SchemaIssue): string {
  const last = problem.path.at(-1);
  if (problem.message === 'is required' && last === 'approved') return NO_APPROVAL;
  if (problem.message === 'is required' && last === 'card') return NO_CARD;
  const offending = problem.path.reduce<unknown>((v, k) => at(v, k), value);
  if (offending === null || offending === undefined || typeof offending === 'object') return problem.message;
  // As the shared messages write it (quotes around the raw string, no escaping), so a value with a
  // line break or a quote in it is found and dropped too.
  const shown = typeof offending === 'string' ? `"${offending}" ` : `${String(offending)} `;
  return problem.message.startsWith(shown) ? problem.message.slice(shown.length) : problem.message;
}

const schemaSets = new Map<string, SchemaSet<CvSchema>>();
export function cvSchemas(root: string): SchemaSet<CvSchema> {
  let set = schemaSets.get(root);
  if (!set) {
    set = new SchemaSet(join(root, 'schemas'), CV_SCHEMAS);
    schemaSets.set(root, set);
  }
  return set;
}

/** True when the CV exists: data/cv/page.yaml is there. Checked from files without loading them (research.md R1). */
export function cvExists(root: string = process.cwd()): boolean {
  return existsSync(join(root, PAGE_FILE));
}

/**
 * Loads data/cv/ under `root`, against the schemas under `schemaRoot`. Items whose approval is
 * missing or stale are reported and kept in `data`, so validate.ts can report every other rule too;
 * CvStore refuses to return anything while any error stands.
 */
export function loadCvData(root: string, schemaRoot: string = root): CvLoadResult {
  if (!cvExists(root)) return { data: undefined, issues: [] };
  const schemas = cvSchemas(schemaRoot);
  const issues: DataIssue[] = [];
  const add = (file: string, entry: string, field: string, message: string, severity: DataIssue['severity'] = 'error') =>
    issues.push({ file, entry, field, message, severity });

  const files = listDataFiles(root, DATA_DIR);
  const values = new Map<string, unknown>();
  for (const file of Object.keys(FILE_SCHEMA)) {
    if (!files.includes(file)) {
      if (file !== DOWNLOADS_FILE) add(file, '', '', 'is missing: the import writes it with page.yaml');
      continue;
    }
    const parsed = parseDataFile(file, readFileSync(join(root, file), 'utf8'));
    if ('error' in parsed) {
      add(file, '', '', parsed.error);
      continue;
    }
    const problems = schemas.validate(FILE_SCHEMA[file]!, parsed.value);
    for (const problem of problems) {
      const { entry, field } = locate(file, parsed.value, problem.path);
      add(file, entry, field, schemaMessage(parsed.value, problem));
    }
    if (problems.length === 0) values.set(file, parsed.value);
  }

  const page = values.get(PAGE_FILE) as CvPage | undefined;
  const blocks = values.get(BLOCKS_FILE) as CvBlocks | undefined;
  const timeline = values.get(TIMELINE_FILE) as CvTimeline | undefined;
  const downloadList = (values.get(DOWNLOADS_FILE) as CvDownloads | undefined) ?? { downloads: [] };

  // Every file under data/cv/ is one of the four, or a PDF downloads.yaml lists.
  const listed = new Set(downloadList.downloads.map((d) => `${DOWNLOADS_DIR}/${d.file}`));
  for (const file of files) {
    if (FILE_SCHEMA[file]) continue;
    if (PDF_NAME.test(file) && listed.has(file)) continue;
    const reason = PDF_NAME.test(file) && values.has(DOWNLOADS_FILE) ? "is not listed in downloads.yaml" : 'is not an expected CV file (the import writes data/cv/)';
    add(file, '', '', reason);
  }

  const check = (file: string, kind: CvKind, item: unknown, index?: number, bytes?: Uint8Array) => {
    if (at(at(item, 'approved'), 'sha256') !== itemSha256(kind, item, bytes)) add(file, itemName(kind, item, index), '', STALE_APPROVAL);
  };
  if (page) check(PAGE_FILE, 'page', page);
  blocks?.blocks.forEach((block, i) => check(BLOCKS_FILE, 'block', block, i));
  if (timeline) {
    for (const [list, kind] of Object.entries(LISTS[TIMELINE_FILE]!)) {
      (timeline[list as keyof CvTimeline] as unknown[]).forEach((item, i) => check(TIMELINE_FILE, kind, item, i));
    }
  }
  const downloads: CvDownloadFile[] = [];
  downloadList.downloads.forEach((download, i) => {
    const path = `${DOWNLOADS_DIR}/${download.file}`;
    if (!existsSync(join(root, path))) {
      add(DOWNLOADS_FILE, itemName('download', download, i), 'file', "is listed but isn't in data/cv/downloads/: its download is hidden", 'warning');
      return;
    }
    check(DOWNLOADS_FILE, 'download', download, i, readFileSync(join(root, path)));
    downloads.push({ ...download, path });
  });

  const data = page && blocks && timeline ? { page, blocks: blocks.blocks, timeline, downloads } : undefined;
  return { data, issues };
}

function at(value: unknown, key: string | number): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string | number, unknown>)[key] : undefined;
}
