// Writes the made-up CV exports the previews and drills import (specs/004-interactive-cv/contracts/
// routes.md states; plan.md *Scale/Scope*): tests/fixtures/cv-export/<state>/export.json and its PDFs.
// Deterministic (fixed seeds, `\n` line endings); the output is committed. Every word is made up.
//
//   node tests/fixtures/cv-export/generate.ts
//
// - typical: 5 themes, 50 changes, 8 roles, 5 threads, 3 next items, both PDFs.
// - stress: 8 themes, 90 changes, 12 roles, every text at its budget, one long unbroken word, and
//   many changes in one year and one lane.
// - minimal: one theme, one change, no threads, roles, next items or downloads.
// - unlisted-off: typical with listed: true.
// Every `when` form appears in typical and stress.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { exportItem, exportPage, letters, lorem, minimalPdf, SOURCE, APPROVED_ON, writeExport } from '../../helpers/cv.ts';

const HERE = import.meta.dirname;
type Value = Record<string, unknown>;

/** Made-up text of exactly `length` characters, ending in a full stop. */
function exact(seed: number, length: number): string {
  let text = lorem(seed, Math.ceil(length / 3));
  while (text.length < length) text += ` ${lorem(seed + text.length, 8).toLowerCase()}`;
  const body = text.slice(0, length - 1).replace(/ $/, 'x');
  return `${body}.`;
}

/** The seven `when` forms, cycled by `n`, between `from` and the as_of year 2026 (months up to November). */
function when(n: number, from: number): string {
  const y = from + (n % (2025 - from));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
  switch (n % 7) {
    case 0: return `${y}`;
    case 1: return `~${y}`;
    case 2: return `${y}–${Math.min(y + 2, 2025)}`;
    case 3: return `${y}–now`;
    case 4: return `2026 ${months[n % 11]}`;
    case 5: return `2026 ${months[n % 5]}–${months[(n % 5) + 4]}`;
    default: return `${Math.min(y, 2025)}–2026 ${months[n % 11]}`;
  }
}

const PDFS = {
  'pdfs/alexander-webber-cv.pdf': minimalPdf({ text: 'A made-up plain CV for the previews', title: 'A made-up CV' }),
  'pdfs/alexander-webber-cv-visual.pdf': minimalPdf({ text: 'A made-up visual CV for the previews', title: 'A made-up visual CV' }),
};
const DOWNLOADS = [
  { kind: 'plain', file: 'alexander-webber-cv.pdf', title: 'The plain CV (PDF)', path: 'pdfs/alexander-webber-cv.pdf', approved_on: APPROVED_ON },
  { kind: 'visual', file: 'alexander-webber-cv-visual.pdf', title: 'The visual CV (PDF)', path: 'pdfs/alexander-webber-cv-visual.pdf', approved_on: APPROVED_ON },
];

function blocks(stories: number, paragraphLength?: number): Value[] {
  const para = (seed: number) => (paragraphLength ? exact(seed, paragraphLength) : `${lorem(seed, 30)}.`);
  return [
    exportItem('block', 0, { id: 'pitch', heading: 'A made-up pitch', kind: 'pitch', paragraphs: [para(1), para(2)] }),
    exportItem('block', 1, {
      id: 'value',
      heading: 'Made-up value',
      kind: 'value',
      paragraphs: [para(3)],
      stories: Array.from({ length: stories }, (_, i) => ({ id: `story-${letters(i).toLowerCase()}`, title: `Story ${letters(i)}`, text: `${lorem(40 + i, 24)}.` })),
    }),
    ...(['future', 'skills', 'public', 'education'] as const).map((kind, i) =>
      exportItem('block', i + 2, { id: kind, heading: `Made-up ${kind}`, kind, paragraphs: [para(10 + i)] }),
    ),
  ];
}

function typical(): Value {
  const themes = Array.from({ length: 5 }, (_, i) => exportItem('theme', i));
  const threads = Array.from({ length: 5 }, (_, i) => exportItem('thread', i));
  const changes = Array.from({ length: 50 }, (_, i) => {
    const extra: Value = { when: when(i, 2007), theme: `theme-${letters(i % 5).toLowerCase()}` };
    // Threads: changes 0-2 of each ten share a thread, in one lane.
    if (i % 10 < 3) {
      extra.thread = `thread-${letters(Math.floor(i / 10)).toLowerCase()}`;
      extra.theme = `theme-${letters(Math.floor(i / 10)).toLowerCase()}`;
    }
    if (i % 10 === 5) extra.value = `story-${letters(Math.floor(i / 20)).toLowerCase()}`;
    return exportItem('change', i, extra);
  });
  const roles = Array.from({ length: 8 }, (_, i) => exportItem('role', i, { when: i === 7 ? '2023–now' : `${2007 + i * 2}–${2009 + i * 2}` }));
  const next = Array.from({ length: 3 }, (_, i) => exportItem('next', i));
  return { format: 1, source: SOURCE, exported: APPROVED_ON, page: exportPage(), blocks: blocks(3), timeline: { themes, threads, roles, changes, next }, downloads: DOWNLOADS };
}

function stress(): Value {
  const themes = Array.from({ length: 8 }, (_, i) => exportItem('theme', i, { name: `Change type ${letters(i)} ${exact(i, 30).slice(0, 30)}`.trim(), line: exact(100 + i, 100) }));
  const threads = Array.from({ length: 6 }, (_, i) => exportItem('thread', i, { name: exact(200 + i, 40), line: exact(300 + i, 100) }));
  const changes = Array.from({ length: 90 }, (_, i) => {
    const extra: Value = { label: exact(400 + i, 72), when: when(i, 2005), theme: `theme-${letters(i % 8).toLowerCase()}`, card: exact(500 + i, 280) };
    // Many changes in one year and one lane.
    if (i >= 60 && i < 75) Object.assign(extra, { when: '2019', theme: 'theme-a' });
    if (i % 15 < 2 && i < 90) {
      extra.thread = `thread-${letters(Math.floor(i / 15)).toLowerCase()}`;
      extra.theme = `theme-${letters(Math.floor(i / 15)).toLowerCase()}`;
    }
    if (i % 12 === 7) extra.value = `story-${letters(i % 4).toLowerCase()}`;
    return exportItem('change', i, extra);
  });
  // One long unbroken word in a label, at the budget.
  (changes[3] as Value).label = 'Lorem'.repeat(14) + 'ip';
  const roles = Array.from({ length: 12 }, (_, i) => exportItem('role', i, { label: exact(600 + i, 48), when: i === 11 ? '2024–now' : `${2005 + i * 2}–${2006 + i * 2}`, card: exact(700 + i, 280) }));
  const next = Array.from({ length: 4 }, (_, i) => exportItem('next', i, { title: exact(800 + i, 72), card: exact(900 + i, 280) }));
  const page = exportPage({ title: exact(1, 60), description: exact(2, 160), headline: exact(3, 120) });
  return { format: 1, source: SOURCE, exported: APPROVED_ON, page, blocks: blocks(4, 600), timeline: { themes, threads, roles, changes, next }, downloads: DOWNLOADS };
}

function minimal(): Value {
  return {
    format: 1,
    source: SOURCE,
    exported: APPROVED_ON,
    page: exportPage({ linkedin: undefined }),
    blocks: [exportItem('block', 0, { id: 'pitch', heading: 'A made-up pitch', kind: 'pitch' })],
    timeline: { themes: [exportItem('theme', 0)], threads: [], roles: [], changes: [exportItem('change', 0, { when: '2014' })], next: [] },
    downloads: [],
  };
}

const STATES: Record<string, { value: Value; pdfs: Record<string, Uint8Array> }> = {
  typical: { value: typical(), pdfs: PDFS },
  stress: { value: stress(), pdfs: PDFS },
  minimal: { value: minimal(), pdfs: {} },
  'unlisted-off': { value: { ...typical(), page: exportPage({ listed: true }) }, pdfs: PDFS },
};

for (const [state, { value, pdfs }] of Object.entries(STATES)) {
  rmSync(join(HERE, state), { recursive: true, force: true });
  writeExport(join(HERE, state), JSON.parse(JSON.stringify(value)), pdfs);
  console.log(`cv-export: ${state}`);
}
