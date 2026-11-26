// The CV's approval hashes (spec 004, T026; contracts/content-files.md *Hashed fields*): what moves
// a hash and what doesn't. Made-up values only.
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { canonicalJson, HASHED_FIELDS, itemSha256, sha256Hex, type CvKind } from '../../src/sections/cv/domain/hashes.ts';

const change = { id: 'change-a', label: 'Change A', when: '2013–2016', theme: 'theme-a', thread: 'thread-a', value: 'story-a', card: 'A made-up card.' };
const page = {
  name: 'Ada Example',
  headline: 'A made-up headline',
  location: 'Somewhere',
  title: 'A made-up title',
  description: 'A made-up description.',
  email_user: 'ada',
  email_domain: 'example.com',
  linkedin: 'https://www.linkedin.com/in/ada-example/',
  as_of: '2026-11',
  listed: false,
  sharing_rules_confirmed: '2026-11-30',
};

describe('canonicalJson', () => {
  it('sorts keys at every level and adds no whitespace', () => {
    expect(canonicalJson({ b: [{ d: 1, c: 2 }], a: 'x' })).toBe('{"a":"x","b":[{"c":2,"d":1}]}');
  });
  it('hashes NFC and NFD forms of the same text alike', () => {
    expect(itemSha256('change', { ...change, label: 'Café' })).toBe(itemSha256('change', { ...change, label: 'Café' }));
  });
  it('leaves out an absent field rather than hashing null', () => {
    const { thread: _thread, ...without } = change;
    expect(canonicalJson(without)).not.toContain('thread');
    expect(itemSha256('change', without)).not.toBe(itemSha256('change', { ...without, thread: null }));
  });
});

describe('itemSha256', () => {
  it('ignores key order', () => {
    const reversed = Object.fromEntries(Object.entries(change).reverse());
    expect(itemSha256('change', reversed)).toBe(itemSha256('change', change));
  });

  it("doesn't move for a field outside the kind's list, the approval, listed or sharing_rules_confirmed", () => {
    expect(itemSha256('change', { ...change, colour: 'lane-1', approved: { date: '2026-12-01' } })).toBe(itemSha256('change', change));
    expect(itemSha256('page', { ...page, listed: true, sharing_rules_confirmed: '2027-01-01' })).toBe(itemSha256('page', page));
  });

  const items: Record<CvKind, Record<string, unknown>> = {
    page,
    block: { id: 'value', heading: 'Made up', kind: 'value', paragraphs: ['One.', 'Two.'], stories: [{ id: 'story-a', title: 'Story A', text: 'Made up.' }] },
    theme: { id: 'theme-a', name: 'Type A', line: 'A made-up line.', colour: 'lane-1' },
    thread: { id: 'thread-a', name: 'Thread A', line: 'A made-up line.' },
    role: { id: 'role-a', label: 'A made-up role', when: '2012–now', card: 'Made up.' },
    change,
    next: { id: 'next-a', title: 'A made-up direction', card: 'Made up.' },
    download: { kind: 'plain', file: 'alexander-webber-cv.pdf', title: 'The plain CV (PDF)' },
  };
  const pdf = new TextEncoder().encode('%PDF-1.4 made up');
  for (const kind of Object.keys(HASHED_FIELDS) as CvKind[]) {
    for (const field of HASHED_FIELDS[kind]) {
      it(`${kind}: one character changed in ${field} moves the hash`, () => {
        const item = items[kind];
        const value = item[field];
        const changed = typeof value === 'string' ? `${value}x` : JSON.parse(JSON.stringify(value).replace(/[a-y]/, 'z'));
        const bytes = kind === 'download' ? pdf : undefined;
        expect(itemSha256(kind, { ...item, [field]: changed }, bytes)).not.toBe(itemSha256(kind, item, bytes));
      });
    }
  }

  it("a PDF's bytes changed by one byte move the download's hash", () => {
    const other = new Uint8Array(pdf);
    other[other.length - 1]! ^= 1;
    expect(itemSha256('download', items.download, other)).not.toBe(itemSha256('download', items.download, pdf));
  });

  it('hashes a download over kind, file, title and the sha256 of its bytes', () => {
    const expected = sha256Hex(canonicalJson({ ...items.download, bytes: sha256Hex(pdf) }));
    expect(itemSha256('download', items.download, pdf)).toBe(expected);
    expect(() => itemSha256('download', items.download)).toThrow();
  });

  it("a YAML file's line endings and comments don't move a parsed item's hash", () => {
    const lf = 'id: change-a\nlabel: Change A\nwhen: 2013–2016\ntheme: theme-a\ncard: A made-up card.\n';
    const crlf = `# a comment\r\n${lf.replace(/\n/g, '\r\n')}`;
    const read = (text: string) => parse(text, { version: '1.2', schema: 'core' });
    expect(itemSha256('change', read(crlf))).toBe(itemSha256('change', read(lf)));
  });
});
