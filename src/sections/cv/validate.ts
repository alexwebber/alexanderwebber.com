// Validates data/cv/ (specs/004-interactive-cv/contracts/gate.md): the store's schemas and approvals
// (data/store/files.ts), then the rules across items of data-model.md *Rules across entities*.
// scripts/validate-data.ts runs it in the gate and the build's first hook. Every issue names the
// file, the kind and the id, and the field and rule; none quotes CV text (contracts/content-files.md
// *Messages*). No data/cv/page.yaml gives no issues.
import type { DataIssue } from '../../shared/storage/index.ts';
import { BLOCKS_FILE, DOWNLOADS_FILE, itemName, loadCvData, PAGE_FILE, TIMELINE_FILE, type CvData } from './data/store/files.ts';
import { overBudget, overBudgetMessage } from './domain/budgets.ts';
import { parseWhen } from './domain/dates.ts';
import type { CvKind } from './domain/hashes.ts';
import { findPhone } from './domain/phone.ts';

export interface ValidateOptions {
  /** Accepted for validate-data's common signature; the CV has no "not in the future" rule. */
  today?: string;
  /** Where schemas/ is, when not under `root`. */
  schemaRoot?: string;
}

export const PHONE_NUMBER = 'has a phone number';

export function validateCv(root: string, options: ValidateOptions = {}): DataIssue[] {
  const { data, issues } = loadCvData(root, options.schemaRoot ?? root);
  if (data) issues.push(...crossItemIssues(data));
  return issues;
}

interface Item {
  file: string;
  kind: CvKind;
  item: Record<string, unknown>;
  index: number;
}

/** Every item of the CV with its file and kind, in file order. */
export function cvItems(data: CvData): Item[] {
  const items: Item[] = [{ file: PAGE_FILE, kind: 'page', item: data.page as unknown as Record<string, unknown>, index: 0 }];
  data.blocks.forEach((item, index) => items.push({ file: BLOCKS_FILE, kind: 'block', item: item as unknown as Record<string, unknown>, index }));
  const lists: [keyof CvData['timeline'], CvKind][] = [['themes', 'theme'], ['threads', 'thread'], ['roles', 'role'], ['changes', 'change'], ['next', 'next']];
  for (const [list, kind] of lists) {
    (data.timeline[list] as unknown as Record<string, unknown>[]).forEach((item, index) => items.push({ file: TIMELINE_FILE, kind, item, index }));
  }
  data.downloads.forEach((item, index) => {
    const { path: _path, ...download } = item;
    items.push({ file: DOWNLOADS_FILE, kind: 'download', item: download as unknown as Record<string, unknown>, index });
  });
  return items;
}

/** Every text field of an item, as dotted paths, leaving out its approval. */
export function textFields(item: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') out.push([path, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  for (const [key, value] of Object.entries(item)) if (key !== 'approved') walk(value, key);
  return out;
}

/** The rules across items, over a loaded (or, in scripts/import-cv.ts, a not yet written) CV. */
export function crossItemIssues(data: CvData): DataIssue[] {
  const issues: DataIssue[] = [];
  const add = (file: string, entry: string, field: string, message: string) => issues.push({ file, entry, field, message, severity: 'error' });
  const items = cvItems(data);

  for (const { file, kind, item, index } of items) {
    const name = itemName(kind, item, index);
    for (const [field, text] of textFields(item)) if (findPhone(text).length > 0) add(file, name, field, PHONE_NUMBER);
    for (const over of overBudget(kind, item)) add(file, name, over.field, overBudgetMessage(over));
    if ((kind === 'change' || kind === 'role') && typeof item.when === 'string') {
      for (const problem of parseWhen(item.when, data.page.as_of).issues) add(file, name, 'when', problem);
    }
  }

  // Unique ids within a kind, and value story ids across the value blocks.
  const seen = new Map<string, Set<string>>();
  for (const { file, kind, item, index } of items) {
    if (kind === 'page' || kind === 'download') continue;
    const ids = seen.get(kind) ?? new Set<string>();
    seen.set(kind, ids);
    if (ids.has(String(item.id))) add(file, itemName(kind, item, index), 'id', `is used by another ${kind === 'next' ? 'next item' : kind}`);
    ids.add(String(item.id));
  }
  const stories = new Set<string>();
  data.blocks.forEach((block, index) => {
    for (const [i, story] of (block.stories ?? []).entries()) {
      if (stories.has(story.id)) add(BLOCKS_FILE, itemName('block', block, index), `stories[${i}].id`, 'is used by another value story');
      stories.add(story.id);
    }
  });

  const pitches = data.blocks.filter((b) => b.kind === 'pitch').length;
  if (pitches !== 1) add(BLOCKS_FILE, '', '', `has ${pitches} pitch blocks (needs exactly 1)`);

  // References: change -> theme, thread, value story; a thread needs two changes.
  const themes = new Set(data.timeline.themes.map((t) => t.id));
  const threads = new Set(data.timeline.threads.map((t) => t.id));
  data.timeline.changes.forEach((change, index) => {
    const name = itemName('change', change, index);
    if (!themes.has(change.theme)) add(TIMELINE_FILE, name, 'theme', 'names no theme in the file');
    if (change.thread !== undefined && !threads.has(change.thread)) add(TIMELINE_FILE, name, 'thread', 'names no thread in the file');
    if (change.value !== undefined && !stories.has(change.value)) add(TIMELINE_FILE, name, 'value', 'names no value story in blocks.yaml');
  });
  data.timeline.threads.forEach((thread, index) => {
    const count = data.timeline.changes.filter((c) => c.thread === thread.id).length;
    if (count < 2) add(TIMELINE_FILE, itemName('thread', thread, index), '', `thread has ${count} change${count === 1 ? '' : 's'} (needs 2)`);
  });

  const kinds = new Map<string, number>();
  for (const download of data.downloads) kinds.set(download.kind, (kinds.get(download.kind) ?? 0) + 1);
  for (const [kind, count] of kinds) if (count > 1) add(DOWNLOADS_FILE, `download ${kind}`, '', `lists ${count} ${kind} downloads (at most 1)`);

  return issues;
}
