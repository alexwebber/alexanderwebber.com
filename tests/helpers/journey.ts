// A made-up journey story tree for tests (spec 003): one chapter, the note and the page wording,
// each approved with journeySha256 exactly as scripts/approve-story.ts --journey would approve it.
// Every word comes from a fixed seed over lorem-style words: never real text (FR-036).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { journeySha256, type JourneyKind } from '../../src/sections/running/data/store/files.ts';
import type { TempRepo } from './temp-repo.ts';

export const JOURNEY = 'data/running/owner/journey';
export const chapterFile = (id: string) => `${JOURNEY}/chapters/${id}/chapter.yaml`;
export const NOTE = `${JOURNEY}/note.yaml`;
export const PAGE = `${JOURNEY}/page.yaml`;
export const CLOSING = `${JOURNEY}/closing.yaml`;
export const APPROVED_ON = '2026-11-01';

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat'.split(' ');

/** `count` lorem-style words from a fixed seed (a linear congruential generator). */
export function lorem(seed: number, count: number): string {
  let state = seed >>> 0;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out.push(WORDS[state % WORDS.length]!);
  }
  const text = out.join(' ');
  return text[0]!.toUpperCase() + text.slice(1);
}

export type Value = Record<string, unknown>;

/** A made-up chapter: two paragraphs, an inline figure, a link and a takeaway. */
export function chapter(id = 'chapter-a', extra: Value = {}): Value {
  return {
    id,
    name: lorem(1, 3),
    when: '2026-03',
    prose: `${lorem(2, 8)} {{fig-a}} ${lorem(3, 6)}.\n\n${lorem(4, 5)} [${lorem(5, 2)}](/running/) ${lorem(6, 4)}.\n`,
    takeaway: `${lorem(7, 10)}.`,
    figures: [{ id: 'fig-a', category: 'weight', label: lorem(8, 1), as_of: '2026-03', text: '12.3 kg', source: 'owner' }],
    ...extra,
  };
}

export const note = (extra: Value = {}): Value => ({ text: `${lorem(9, 12)}.`, ...extra });
export const page = (extra: Value = {}): Value => ({
  title: lorem(10, 3),
  description: `${lorem(11, 10)}.`,
  share_text: lorem(12, 5),
  link_label: lorem(13, 3),
  ...extra,
});
export const closing = (extra: Value = {}): Value => ({ heading: lorem(14, 4), text: `${lorem(15, 9)}.\n\n${lorem(16, 7)}.\n`, ...extra });

/** The value with an `approved` block whose hash is journeySha256's. */
export function approve(kind: JourneyKind, value: Value, photos: ReadonlyMap<string, Uint8Array> = new Map(), date = APPROVED_ON): Value {
  return { ...value, approved: { date, sha256: journeySha256(kind, value, photos) } };
}

export const yaml = (value: Value) => stringify(value, { lineWidth: 0 });

/** Writes a (made-up) photo file's bytes. */
export function writePhoto(repo: TempRepo, file: string, bytes: Uint8Array): void {
  mkdirSync(join(repo.root, file, '..'), { recursive: true });
  writeFileSync(join(repo.root, file), bytes);
}

/** Writes an approved journey file, and a chapter's photos beside it. */
export function writeApproved(repo: TempRepo, file: string, kind: JourneyKind, value: Value, photos: Record<string, Uint8Array> = {}): void {
  const folder = file.slice(0, file.lastIndexOf('/'));
  for (const [name, bytes] of Object.entries(photos)) writePhoto(repo, `${folder}/${name}`, bytes);
  repo.write(file, yaml(approve(kind, value, new Map(Object.entries(photos)))));
}

/** One approved chapter, the note and the page wording: a story that validates. */
export function writeStory(repo: TempRepo, options: { chapter?: Value; photos?: Record<string, Uint8Array> } = {}): void {
  const value = options.chapter ?? chapter();
  writeApproved(repo, chapterFile(String(value.id)), 'chapter', value, options.photos);
  writeApproved(repo, NOTE, 'note', note());
  writeApproved(repo, PAGE, 'page', page());
}
