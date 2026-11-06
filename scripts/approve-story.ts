// Records the owner's approval of story text. Run only after the owner's explicit yes.
//
// Campaign mode (spec 002: T087; FR-050, FR-052, FR-054, SC-007) writes the `approved` block (the
// date and the sha256 of the text as parsed) into data/running/owner/stories/<campaign-id>.yaml.
//
// Journey mode (spec 003: T011; FR-032, FR-033, research.md R3) writes `approved.date` and
// `approved.sha256`, the file's approval hash (journeySha256: its hashed fields, photos' bytes
// included), into a journey file: `<chapter-id>` is
// data/running/owner/journey/chapters/<chapter-id>/chapter.yaml, and `closing`, `note` and `page`
// are data/running/owner/journey/<target>.yaml.
//
//   node scripts/approve-story.ts <campaign-id> [--date=YYYY-MM-DD]
//   node scripts/approve-story.ts --journey=<chapter-id|closing|note|page> [--date=YYYY-MM-DD]
//
// Both keep the text and any comments, and refuse to write unless what they would write re-parses
// with the text and the block unchanged; the file is untouched on any refusal. validate-data then
// refuses the file if its text changes without a new approval. It never prints the text, and its
// errors never quote the file: a YAML parser's message would. The JustGiving reminder is for
// campaign stories only.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isMap, parseDocument } from 'yaml';
import { today as londonToday } from '../src/shared/format/dates.ts';
import { chapterPhotoBytes, journeySha256, OWNER_DIR, storySha256, type JourneyKind } from '../src/sections/running/data/store/files.ts';
import { isMain } from './lib/walk.ts';

const YAML_OPTIONS = { version: '1.2', schema: 'core' } as const;
const CAMPAIGN_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const JUSTGIVING_REMINDER = 'Reminder: the JustGiving page must carry the same text. Update it to match (FR-054).';

export class StoryError extends Error {}

export interface ApproveStory {
  /** Repo root (holding data/). */
  root: string;
  campaign: string;
  /** Defaults to today in Europe/London. */
  date?: string;
}

export interface ApprovedStory {
  /** Repo-relative path of the story. */
  file: string;
  date: string;
}

export function approveStory({ root, campaign, date = londonToday() }: ApproveStory): ApprovedStory {
  if (!CAMPAIGN_ID.test(campaign)) throw new StoryError(`"${campaign}" is not a campaign id`);
  if (!DATE.test(date)) throw new StoryError(`"${date}" is not a date (expected YYYY-MM-DD)`);
  if (date > londonToday()) throw new StoryError(`${date} is in the future`);
  const file = `data/running/owner/stories/${campaign}.yaml`;
  const path = join(root, file);
  if (!existsSync(path)) throw new StoryError(`${file} does not exist: write the approved text there first`);

  const doc = parseDocument(readFileSync(path, 'utf8'), YAML_OPTIONS);
  if (doc.errors.length > 0) throw new StoryError(`${file} is not valid YAML`);
  const text = doc.get('text');
  if (typeof text !== 'string' || text.trim() === '') throw new StoryError(`${file} has no text to approve`);

  const sha256 = storySha256(text);
  if (isMap(doc.get('approved'))) {
    doc.setIn(['approved', 'date'], date);
    doc.setIn(['approved', 'text_sha256'], sha256);
  } else {
    doc.set('approved', doc.createNode({ date, text_sha256: sha256 }));
  }

  // lineWidth 0: the default re-folds long lines. The check below is what guarantees the text.
  const written = doc.toString({ lineWidth: 0 });
  const check = parseDocument(written, YAML_OPTIONS).toJS() as { text?: unknown; approved?: { date?: unknown; text_sha256?: unknown } };
  if (check.text !== text || check.approved?.date !== date || check.approved.text_sha256 !== sha256) {
    throw new StoryError(`${file} would not survive being rewritten unchanged; it was not touched`);
  }
  writeFileSync(path, written);
  return { file, date };
}

export interface ApproveJourney {
  /** Repo root (holding data/). */
  root: string;
  /** A chapter ID, or `closing`, `note` or `page`. */
  target: string;
  /** Defaults to today in Europe/London. */
  date?: string;
}

const JOURNEY_FILES: Record<string, JourneyKind> = { closing: 'closing', note: 'note', page: 'page' };

/** The journey file a target names, and its kind. Undefined for anything else. */
export function journeyTarget(target: string): { file: string; kind: JourneyKind } | undefined {
  const kind = JOURNEY_FILES[target];
  if (kind) return { file: `${OWNER_DIR}/journey/${target}.yaml`, kind };
  if (CAMPAIGN_ID.test(target)) return { file: `${OWNER_DIR}/journey/chapters/${target}/chapter.yaml`, kind: 'chapter' };
  return undefined;
}

export function approveJourney({ root, target, date = londonToday() }: ApproveJourney): ApprovedStory {
  const named = journeyTarget(target);
  if (!named) throw new StoryError('the target is not a chapter id, closing, note or page');
  if (!DATE.test(date)) throw new StoryError(`"${date}" is not a date (expected YYYY-MM-DD)`);
  if (date > londonToday()) throw new StoryError(`${date} is in the future`);
  const { file, kind } = named;
  const path = join(root, file);
  if (!existsSync(path)) throw new StoryError(`${file} does not exist: write the approved text there first`);

  const doc = parseDocument(readFileSync(path, 'utf8'), YAML_OPTIONS);
  if (doc.errors.length > 0) throw new StoryError(`${file} is not valid YAML`);
  if (!isMap(doc.contents)) throw new StoryError(`${file} has nothing to approve`);
  let value: unknown;
  try {
    value = doc.toJS();
  } catch {
    // An alias naming no anchor (`*word`) throws, quoting the word: the file's text (FR-035).
    throw new StoryError(`${file} is not valid YAML`);
  }
  const { bytes, missing } = kind === 'chapter' ? chapterPhotoBytes(root, file, value) : { bytes: new Map<string, Uint8Array>(), missing: [] };
  if (missing.length > 0) throw new StoryError(`${file}: photos[${missing[0]}].file is listed but isn't in the chapter's folder`);

  const sha256 = journeySha256(kind, value, bytes);
  if (isMap(doc.get('approved'))) {
    doc.setIn(['approved', 'date'], date);
    doc.setIn(['approved', 'sha256'], sha256);
  } else {
    doc.set('approved', doc.createNode({ date, sha256 }));
  }

  // lineWidth 0: the default re-folds long lines. The check below is what guarantees the text: the
  // re-parsed file must hash the same, so every hashed field survived, and carry the block.
  const written = doc.toString({ lineWidth: 0 });
  const reparsed = parseDocument(written, YAML_OPTIONS);
  const check = reparsed.toJS() as { approved?: { date?: unknown; sha256?: unknown } } | null;
  if (reparsed.errors.length > 0 || check?.approved?.date !== date || check.approved.sha256 !== sha256 || journeySha256(kind, check, bytes) !== sha256) {
    throw new StoryError(`${file} would not survive being rewritten unchanged; it was not touched`);
  }
  writeFileSync(path, written);
  return { file, date };
}

const USAGE = [
  'usage: node scripts/approve-story.ts <campaign-id> [--date=YYYY-MM-DD]',
  '       node scripts/approve-story.ts --journey=<chapter-id|closing|note|page> [--date=YYYY-MM-DD]',
].join('\n');

/** The command line: returns the exit code. Everything it prints goes through here. */
export function main(args: string[], root: string): number {
  const campaign = args.find((a) => !a.startsWith('--'));
  const journey = args.find((a) => a.startsWith('--journey='))?.slice('--journey='.length);
  const date = args.find((a) => a.startsWith('--date='))?.slice('--date='.length);
  if ((campaign === undefined) === (journey === undefined)) {
    console.error(USAGE);
    return 2;
  }
  try {
    if (journey !== undefined) {
      const approved = approveJourney({ root, target: journey, ...(date === undefined ? {} : { date }) });
      console.log(`approve-story: recorded the owner's approval in ${approved.file}, dated ${approved.date}`);
      return 0;
    }
    const approved = approveStory({ root, campaign: campaign!, ...(date === undefined ? {} : { date }) });
    console.log(`approve-story: recorded the owner's approval in ${approved.file}, dated ${approved.date}`);
    console.log(JUSTGIVING_REMINDER);
    return 0;
  } catch (error) {
    if (!(error instanceof StoryError)) throw error;
    console.error(`error: ${error.message}`);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2), resolve(import.meta.dirname, '..')));
