// approve-story (T087, T090; FR-052, FR-054, SC-007): the written block passes validation, the text
// and comments survive, a new approval moves the hash, the reminder prints, and the text never
// appears in anything the script prints. All text here is made up.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { approveStory, JUSTGIVING_REMINDER, main, StoryError } from '../../scripts/approve-story.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import { today as londonToday } from '../../src/shared/format/dates.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => {
  repo?.cleanup();
  vi.restoreAllMocks();
});

const TODAY = '2026-11-10';
const ID = 'brighton-2027';
const FILE = `data/running/owner/stories/${ID}.yaml`;
const SECRET = 'A-MADE-UP-SENTINEL';
const LONG = `${SECRET} ${'and a line well over eighty characters long, which a default rewrite would fold, '.repeat(3).trim()}`;
const TEXT = `${LONG}\n\nA made-up second paragraph: £1, café, "quotes" and a # that isn't a comment.\n`;
const LITERAL = `# A made-up comment that stays.\ncampaign: ${ID} # and one beside a value\ntext: |\n  ${TEXT.trimEnd().replace('\n\n', '\n\n  ')}\n`;

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const read = () => readFileSync(join(repo.root, FILE), 'utf8');
const written = () => parse(read(), { version: '1.2', schema: 'core' }) as { campaign: string; text: string; approved: { date: string; text_sha256: string } };
const errors = () =>
  validateData(repo.root, { today: TODAY })
    .filter((i) => i.severity === 'error')
    .map(formatIssue);

function setUp(story = LITERAL) {
  repo = tempRepo();
  repo.write('data/running/owner/upcoming-races.yaml', `- { id: ${ID}, name: Made-up Marathon, date: 2027-04-04, distance: marathon }\n`);
  repo.write('data/running/owner/campaigns.yaml', `- { id: ${ID}, race_id: ${ID}, charity: { name: Example hospice }, page_url: https://www.justgiving.com/page/example }\n`);
  repo.write(FILE, story);
}

/** Runs the command line, returning its exit code and everything it printed. */
function run(args: string[]) {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const code = main(args, repo.root);
  const output = [...log.mock.calls, ...error.mock.calls].flat().join('\n');
  log.mockRestore();
  error.mockRestore();
  return { code, output };
}

describe('approve-story', () => {
  it('writes a block that passes validation, with the date and the hash of the text as parsed', () => {
    setUp();
    expect(errors()[0]).toContain("needs the owner's approval");
    expect(approveStory({ root: repo.root, campaign: ID, date: '2026-10-30' })).toEqual({ file: FILE, date: '2026-10-30' });
    expect(written().approved).toEqual({ date: '2026-10-30', text_sha256: sha256(TEXT) });
    expect(errors()).toEqual([]);
  });

  it('leaves the text byte-identical, with long lines unfolded, and keeps comments', () => {
    setUp();
    approveStory({ root: repo.root, campaign: ID, date: '2026-10-30' });
    expect(written().text).toBe(TEXT);
    expect(read().startsWith(LITERAL)).toBe(true);
  });

  it.each([
    ['a plain scalar', `campaign: ${ID}\ntext: ${LONG}\n`],
    ['a double-quoted scalar', `campaign: ${ID}\ntext: "${LONG}\\n\\nSecond."\n`],
    ['a folded scalar', `campaign: ${ID}\ntext: >\n  ${LONG}\n\n  Second.\n`],
    ['a block that keeps its trailing lines', `campaign: ${ID}\ntext: |+\n  ${LONG}\n\n`],
  ])('keeps the parsed text of %s', (_, story) => {
    setUp(story);
    const before = parse(story, { version: '1.2', schema: 'core' }).text as string;
    approveStory({ root: repo.root, campaign: ID, date: '2026-10-30' });
    expect(written().text).toBe(before);
    expect(errors()).toEqual([]);
  });

  it('gives the same hash for a CRLF file, which then passes as LF or CRLF', () => {
    setUp(LITERAL.replaceAll('\n', '\r\n'));
    approveStory({ root: repo.root, campaign: ID, date: '2026-10-30' });
    expect(written().approved.text_sha256).toBe(sha256(TEXT));
    expect(errors()).toEqual([]);
    repo.write(FILE, read().replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
    expect(errors()).toEqual([]);
  });

  it('moves the hash on re-approval after an edit, keeping a comment in the block', () => {
    setUp(`${LITERAL}approved:\n  date: 2026-11-01\n  text_sha256: "${'a'.repeat(64)}" # a made-up comment\n`);
    expect(errors()).toEqual([expect.stringContaining('the text has changed since it was approved')]);
    approveStory({ root: repo.root, campaign: ID, date: '2026-10-30' });
    expect(errors()).toEqual([]);
    const first = written().approved.text_sha256;
    expect(read()).toContain('# a made-up comment');

    repo.write(FILE, read().replace('second paragraph', 'changed paragraph'));
    expect(errors()).toEqual([expect.stringContaining('the text has changed since it was approved')]);
    approveStory({ root: repo.root, campaign: ID, date: '2026-10-31' });
    expect(written().approved.date).toBe('2026-10-31');
    expect(written().approved.text_sha256).not.toBe(first);
    expect(errors()).toEqual([]);
  });

  it('replaces an approved value that is not a block', () => {
    setUp(`${LITERAL}approved: true\n`);
    approveStory({ root: repo.root, campaign: ID, date: '2026-10-30' });
    expect(errors()).toEqual([]);
  });

  it('dates the approval today in Europe/London by default', () => {
    setUp();
    expect(approveStory({ root: repo.root, campaign: ID }).date).toBe(londonToday());
  });

  it('refuses a future date, a bad date, an unknown story and an id that is not a campaign id', () => {
    setUp();
    const before = read();
    const refused = (campaign: string, date?: string) => () => approveStory({ root: repo.root, campaign, ...(date ? { date } : {}) });
    expect(refused(ID, '2999-01-01')).toThrow(StoryError);
    expect(refused(ID, '9 Nov 2026')).toThrow(StoryError);
    expect(refused('hove-2027')).toThrow('does not exist');
    expect(refused('../../owner/campaigns')).toThrow('is not a campaign id');
    expect(read()).toBe(before);
  });

  it('refuses a story with no text', () => {
    setUp(`campaign: ${ID}\ntext: "  "\n`);
    expect(() => approveStory({ root: repo.root, campaign: ID })).toThrow('has no text to approve');
  });
});

describe('what it prints', () => {
  it('names the file and date and gives the JustGiving reminder, and never the text', () => {
    setUp();
    const { code, output } = run([ID, '--date=2026-10-30']);
    expect(code).toBe(0);
    expect(output).toContain(FILE);
    expect(output).toContain('2026-10-30');
    expect(output).toContain(JUSTGIVING_REMINDER);
    expect(JUSTGIVING_REMINDER).toContain('JustGiving');
    expect(output).not.toContain(SECRET);
    expect(output).not.toContain(sha256(TEXT));
    expect(output).not.toContain('paragraph');
  });

  it('prints usage with no campaign, and changes nothing', () => {
    setUp();
    const { code, output } = run([]);
    expect(code).toBe(2);
    expect(output).toContain('usage:');
    expect(read()).toBe(LITERAL);
  });

  it('never quotes the file when it can\'t parse it', () => {
    setUp(`campaign: ${ID}\ntext: [${SECRET} unclosed\n`);
    const { code, output } = run([ID]);
    expect(code).toBe(1);
    expect(output).toBe(`error: ${FILE} is not valid YAML`);
  });

  it('never quotes the text in any refusal', () => {
    setUp();
    for (const args of [[ID, '--date=2999-01-01'], [ID, '--date=soon'], ['hove-2027']]) {
      const { code, output } = run(args);
      expect(code).toBe(1);
      expect(output).not.toContain(SECRET);
    }
  });
});
