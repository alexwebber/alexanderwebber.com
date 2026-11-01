// Records the owner's approval of a campaign's story (T087; FR-050, FR-052, FR-054, SC-007). Run only
// after the owner's explicit yes: it writes the `approved` block (the date and the sha256 of the text
// as parsed) into data/running/owner/stories/<campaign-id>.yaml, keeping the text and any comments.
// validate-data then refuses the story if the text changes without a new approval.
//
//   node scripts/approve-story.ts <campaign-id> [--date=YYYY-MM-DD]
//
// It never prints the text, and its errors never quote the file: a YAML parser's message would.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isMap, parseDocument } from 'yaml';
import { today as londonToday } from '../src/shared/format/dates.ts';
import { storySha256 } from '../src/sections/running/data/store/files.ts';
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

/** The command line: returns the exit code. Everything it prints goes through here. */
export function main(args: string[], root: string): number {
  const campaign = args.find((a) => !a.startsWith('--'));
  const date = args.find((a) => a.startsWith('--date='))?.slice('--date='.length);
  if (!campaign) {
    console.error('usage: node scripts/approve-story.ts <campaign-id> [--date=YYYY-MM-DD]');
    return 2;
  }
  try {
    const approved = approveStory({ root, campaign, ...(date === undefined ? {} : { date }) });
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
