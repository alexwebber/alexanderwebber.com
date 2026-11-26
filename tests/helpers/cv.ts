// Made-up CV exports for tests and previews (spec 004): every word from a fixed seed over lorem-style
// words, labels like "Change A" and "A made-up role", the domain example.com. Never real text, and
// nothing from the private career record (tasks.md *Privacy*).
//
// - exportItem(kind, extra): one export item of a kind, with approved_on.
// - smallExport(): a small export with one of everything, which a test edits to plant one problem.
// - writeExport(dir, value, pdfs): writes export.json and its PDFs beside it.
// - minimalPdf({text, title, author}): a small valid PDF written by hand (one page, a standard font,
//   a correct cross-reference table), so a test can plant a phone number in a PDF's text or metadata
//   without a new dependency.
// - writeCv(root, export, pdfs): writes data/cv/ straight from an export, each item approved with its
//   real hash but none of the import's checks, so a test can plant one problem the import would
//   refuse and see the store and validation catch it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import type { CvExport } from '../../src/sections/cv/data/store/index.ts';
import { itemSha256, type CvKind } from '../../src/sections/cv/domain/hashes.ts';
import { lorem } from './journey.ts';

export { lorem };

export const APPROVED_ON = '2026-12-01';
export const RULES_CONFIRMED = '2026-11-30';
export const SOURCE = '0a1b2c3d';

export type ExportKind = 'block' | 'theme' | 'thread' | 'role' | 'change' | 'next';
type Value = Record<string, unknown>;

/** Letters for labels: 0 -> A, 25 -> Z, 26 -> AA. */
export function letters(n: number): string {
  let out = '';
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) out = String.fromCharCode(65 + ((i - 1) % 26)) + out;
  return out;
}

/** One export item of `kind`, numbered `n` (its id and label follow from it), with approved_on. */
export function exportItem(kind: ExportKind, n = 0, extra: Value = {}): Value {
  const tag = letters(n);
  const id = `${kind}-${tag.toLowerCase()}`;
  const seed = n * 31 + kind.length;
  const base: Record<ExportKind, Value> = {
    block: { id, heading: `Made-up block ${tag}`, kind: 'other', paragraphs: [`${lorem(seed, 14)}.`] },
    theme: { id, name: `Change type ${tag}`, line: `${lorem(seed, 8)}.`, colour: `lane-${(n % 8) + 1}` },
    thread: { id, name: `Thread ${tag}`, line: `${lorem(seed, 7)}.` },
    role: { id, label: `A made-up role ${tag}`, when: '2012–now', card: `${lorem(seed, 18)}.` },
    change: { id, label: `Change ${tag}`, when: '2014', theme: 'theme-a', card: `${lorem(seed, 20)}.` },
    next: { id, title: `A made-up direction ${tag}`, card: `${lorem(seed, 16)}.` },
  };
  return { ...base[kind], ...extra, approved_on: APPROVED_ON };
}

/** The page of a made-up export. */
export function exportPage(extra: Value = {}): Value {
  return {
    name: 'Ada Example',
    headline: 'A made-up headline for a made-up person',
    location: 'Somewhere, Nowhere',
    title: 'Ada Example: a made-up CV',
    description: 'A made-up description of a made-up career, for tests and previews.',
    email_user: 'ada',
    email_domain: 'example.com',
    linkedin: 'https://www.linkedin.com/in/ada-example/',
    as_of: '2026-11',
    listed: false,
    sharing_rules_confirmed: RULES_CONFIRMED,
    approved_on: APPROVED_ON,
    ...extra,
  };
}

/** A small export with one of everything: a pitch and a value block with a story, two themes, a thread of two changes, a role, a next item and both PDFs. */
export function smallExport(): CvExport {
  return {
    format: 1,
    source: SOURCE,
    exported: APPROVED_ON,
    page: exportPage(),
    blocks: [
      exportItem('block', 0, { id: 'pitch', heading: 'A made-up pitch', kind: 'pitch' }),
      exportItem('block', 1, { id: 'value', heading: 'Made-up value', kind: 'value', stories: [{ id: 'story-a', title: 'Story A', text: `${lorem(7, 12)}.` }] }),
    ],
    timeline: {
      themes: [exportItem('theme', 0), exportItem('theme', 1)],
      threads: [exportItem('thread', 0)],
      roles: [exportItem('role', 0)],
      changes: [
        exportItem('change', 0, { when: '2013–2016', thread: 'thread-a', value: 'story-a' }),
        exportItem('change', 1, { when: '2017', theme: 'theme-b', thread: 'thread-a' }),
        exportItem('change', 2, { when: '2026 Oct' }),
      ],
      next: [exportItem('next', 0)],
    },
    downloads: [
      { kind: 'plain', file: 'alexander-webber-cv.pdf', title: 'The plain CV (PDF)', path: 'pdfs/alexander-webber-cv.pdf', approved_on: APPROVED_ON },
      { kind: 'visual', file: 'alexander-webber-cv-visual.pdf', title: 'The visual CV (PDF)', path: 'pdfs/alexander-webber-cv-visual.pdf', approved_on: APPROVED_ON },
    ],
  } as CvExport;
}

/** The made-up PDFs smallExport() names, keyed by their path beside the export. */
export function smallPdfs(): Record<string, Uint8Array> {
  return {
    'pdfs/alexander-webber-cv.pdf': minimalPdf({ text: 'A made-up plain CV', title: 'A made-up CV' }),
    'pdfs/alexander-webber-cv-visual.pdf': minimalPdf({ text: 'A made-up visual CV', title: 'A made-up visual CV' }),
  };
}

/** Writes `dir`/export.json (`\n` line endings) and each PDF at its path under `dir`. Returns the export's path. */
export function writeExport(dir: string, value: unknown, pdfs: Record<string, Uint8Array> = {}): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'export.json');
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  for (const [rel, bytes] of Object.entries(pdfs)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), bytes);
  }
  return path;
}

const pdfString = (text: string) => `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;

/** A one-page PDF with `text` in Helvetica, and the title and author in its metadata. Latin-1 text only. */
export function minimalPdf({ text, title = 'A made-up document', author = 'A made-up author' }: { text: string; title?: string; author?: string }): Uint8Array {
  const content = `BT /F1 12 Tf 72 720 Td ${pdfString(text)} Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    `<< /Title ${pdfString(title)} /Author ${pdfString(author)} >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

const LISTS: [string, CvKind][] = [['themes', 'theme'], ['threads', 'thread'], ['roles', 'role'], ['changes', 'change'], ['next', 'next']];

/** The four data files for `exp`, as values: each item approved over its real hash, with no other check. */
export function cvValues(exp: CvExport, pdfs: Record<string, Uint8Array> = {}): Record<string, Value> {
  const approve = (kind: CvKind, item: Value, bytes?: Uint8Array): Value => {
    const { approved_on, path: _path, ...fields } = item;
    if (approved_on === undefined) return fields;
    // A download without its PDF can't be hashed: a stand-in, as the store hides it unchecked.
    const sha256 = kind === 'download' && !bytes ? '0'.repeat(64) : itemSha256(kind, fields, bytes);
    return { ...fields, approved: { date: approved_on, source: exp.source, sha256 } };
  };
  const { approved, ...page } = approve('page', exp.page as Value);
  const timeline = exp.timeline as unknown as Record<string, Value[]>;
  return {
    'data/cv/page.yaml': { ...page, approved },
    'data/cv/blocks.yaml': { blocks: (exp.blocks as Value[]).map((b) => approve('block', b)) },
    'data/cv/timeline.yaml': Object.fromEntries(LISTS.map(([list, kind]) => [list, (timeline[list] ?? []).map((i) => approve(kind, i))])),
    'data/cv/downloads.yaml': { downloads: (exp.downloads as Value[]).map((d) => approve('download', d, pdfs[String(d.path)])) },
  };
}

/** Writes data/cv/ under `root` from `exp` (see cvValues) and its PDFs into data/cv/downloads/. */
export function writeCv(root: string, exp: CvExport, pdfs: Record<string, Uint8Array> = smallPdfs()): void {
  for (const [file, value] of Object.entries(cvValues(exp, pdfs))) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), stringify(value, { lineWidth: 0 }));
  }
  for (const download of exp.downloads) {
    const bytes = pdfs[download.path];
    if (bytes) {
      mkdirSync(join(root, 'data/cv/downloads'), { recursive: true });
      writeFileSync(join(root, 'data/cv/downloads', download.file), bytes);
    }
  }
}
