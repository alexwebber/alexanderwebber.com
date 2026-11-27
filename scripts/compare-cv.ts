// Compares the built CV page with the export, word for word (specs/004-interactive-cv/contracts/
// content-files.md *scripts/compare-cv.ts*; FR-021, SC-005). Its output goes into the content PR.
//
//   node scripts/compare-cv.ts --from=<export.json> [--dist=dist] [--page=<built html>]
//
// The canonical occurrence of each item carries data-cv-item="<kind>:<id>" (page:page, block:<id>,
// story:<id>, theme:<id>, thread:<id>, role:<id>, change:<id>, next:<id>, download:<kind>), and each
// compared field inside it data-cv-field="<field>" (a block's paragraphs are paragraphs.0,
// paragraphs.1, ...). Field text is compared with whitespace collapsed and entities decoded; tags
// are dropped without adding spaces, so two inline elements with no space between them read as one
// word. The page's title is the <title> text and its description the meta description; the email
// is compared through data-user and data-domain on data-cv-field="email", and LinkedIn through the
// href of data-cv-field="linkedin". A `when` is compared as its words (whenText).
//
// Prints `no differences`, or one line per difference with kind, id and field, never the text, and
// exits 1 on any.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CvExport } from '../src/sections/cv/data/store/index.ts';
import { parseWhen, whenText } from '../src/sections/cv/domain/dates.ts';
import { isMain } from './lib/walk.ts';

export interface Difference {
  kind: string;
  id: string;
  /** Empty for a whole item. */
  field: string;
  problem: 'missing item' | 'extra item' | 'item appears twice' | 'missing field' | 'text differs';
}

export const differenceLine = (d: Difference): string => [`${d.kind} ${d.id}`, d.field, d.problem].filter(Boolean).join(': ');

/** What the page must show: item key ("change:change-a") -> field -> text. */
export function expectedFields(exp: CvExport): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  const put = (key: string, fields: Record<string, string | undefined>) => {
    const map = new Map<string, string>();
    for (const [field, text] of Object.entries(fields)) if (text !== undefined) map.set(field, text);
    out.set(key, map);
  };
  const words = (when: string) => {
    const parsed = parseWhen(when, exp.page.as_of).when;
    return parsed ? whenText(parsed) : when;
  };
  const p = exp.page;
  put('page:page', { name: p.name, headline: p.headline, location: p.location, title: p.title, description: p.description, email: `${p.email_user}@${p.email_domain}`, linkedin: p.linkedin });
  for (const block of exp.blocks) {
    put(`block:${block.id}`, { heading: block.heading, ...Object.fromEntries(block.paragraphs.map((text, i) => [`paragraphs.${i}`, text])) });
    for (const story of block.stories ?? []) put(`story:${story.id}`, { title: story.title, text: story.text });
  }
  for (const t of exp.timeline.themes) put(`theme:${t.id}`, { name: t.name, line: t.line });
  for (const t of exp.timeline.threads) put(`thread:${t.id}`, { name: t.name, line: t.line });
  for (const r of exp.timeline.roles) put(`role:${r.id}`, { label: r.label, when: words(r.when), card: r.card });
  for (const c of exp.timeline.changes) put(`change:${c.id}`, { label: c.label, when: words(c.when), card: c.card });
  for (const n of exp.timeline.next) put(`next:${n.id}`, { title: n.title, card: n.card });
  for (const d of exp.downloads) put(`download:${d.kind}`, { title: d.title });
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the entities Astro writes, in one pass (so `&amp;lt;` stays `&lt;`). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function attributes(tag: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of tag.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    out.set(m[1]!.toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return out;
}

interface Found {
  /** item key -> how many times it appears. */
  counts: Map<string, number>;
  /** item key -> field -> text (the first occurrence's). */
  fields: Map<string, Map<string, string>>;
}

/** Walks the page's tags once, collecting each data-cv-item's data-cv-field text. A scanner, as tests/helpers/html.ts explains. */
export function pageFields(html: string): Found {
  const counts = new Map<string, number>();
  const fields = new Map<string, Map<string, string>>();
  type Open = { name: string; item?: string; field?: { item: string; name: string } };
  const stack: Open[] = [];
  let title: string | undefined;
  let description: string | undefined;
  let titleText = '';
  let inTitle = false;
  const capturing: { item: string; name: string; text: string }[] = [];
  const setField = (item: string, name: string, text: string) => {
    const map = fields.get(item) ?? new Map<string, string>();
    fields.set(item, map);
    if (!map.has(name)) map.set(name, text);
  };
  const currentItem = () => [...stack].reverse().find((o) => o.item)?.item;

  let at = 0;
  while (at < html.length) {
    const open = html.indexOf('<', at);
    const text = html.slice(at, open === -1 ? html.length : open);
    if (text) {
      for (const c of capturing) c.text += text;
      if (inTitle) titleText += text;
    }
    if (open === -1) break;
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open);
      at = end === -1 ? html.length : end + 3;
      continue;
    }
    const close = html.indexOf('>', open);
    if (close === -1) break;
    const tag = html.slice(open + 1, close);
    at = close + 1;
    if (tag.startsWith('/')) {
      const name = tag.slice(1).trim().toLowerCase();
      if (name === 'title' && inTitle) {
        inTitle = false;
        title ??= titleText;
      }
      const index = stack.map((o) => o.name).lastIndexOf(name);
      if (index === -1) continue;
      for (const o of stack.splice(index)) {
        if (o.field) {
          const c = capturing.findLastIndex((x) => x.item === o.field!.item && x.name === o.field!.name);
          if (c !== -1) setField(o.field.item, o.field.name, capturing.splice(c, 1)[0]!.text);
        }
      }
      continue;
    }
    if (tag.startsWith('!') || tag.startsWith('?')) continue;
    const name = (/^[^\s/>]+/.exec(tag)?.[0] ?? '').toLowerCase();
    const attrs = attributes(tag.slice(name.length));
    if (name === 'script' || name === 'style') {
      const end = html.indexOf(`</${name}`, at);
      at = end === -1 ? html.length : html.indexOf('>', end) + 1;
      continue;
    }
    // The document's <title>, not an SVG's.
    if (name === 'title' && stack.every((o) => o.name !== 'svg')) {
      inTitle = true;
      titleText = '';
    }
    if (name === 'meta' && attrs.get('name') === 'description') description = attrs.get('content');
    const item = attrs.get('data-cv-item');
    if (item) counts.set(item, (counts.get(item) ?? 0) + 1);
    const fieldName = attrs.get('data-cv-field');
    const owner = item ?? currentItem();
    const entry: Open = { name, item };
    if (fieldName && owner && (counts.get(owner) ?? 0) <= 1) {
      if (fieldName === 'email') setField(owner, 'email', `${attrs.get('data-user') ?? ''}@${attrs.get('data-domain') ?? ''}`);
      else if (fieldName === 'linkedin') setField(owner, 'linkedin', attrs.get('href') ?? '');
      else if (!VOID.has(name) && !tag.endsWith('/')) {
        entry.field = { item: owner, name: fieldName };
        capturing.push({ item: owner, name: fieldName, text: '' });
      }
    }
    if (!VOID.has(name) && !tag.endsWith('/')) stack.push(entry);
  }
  if (title !== undefined || description !== undefined) {
    const page = fields.get('page:page') ?? new Map<string, string>();
    fields.set('page:page', page);
    if (title !== undefined) page.set('title', title);
    if (description !== undefined) page.set('description', description);
  }
  for (const map of fields.values()) for (const [k, v] of map) map.set(k, collapse(decodeEntities(v)));
  return { counts, fields };
}

/** Every difference between the built page and the export. Empty when they agree. */
export function compareCv(html: string, exp: CvExport): Difference[] {
  const expected = expectedFields(exp);
  const { counts, fields } = pageFields(html);
  const out: Difference[] = [];
  const split = (key: string) => {
    const i = key.indexOf(':');
    return { kind: key.slice(0, i), id: key.slice(i + 1) };
  };
  for (const [key, want] of expected) {
    const { kind, id } = split(key);
    const count = key === 'page:page' ? Math.max(counts.get(key) ?? 0, fields.has(key) ? 1 : 0) : (counts.get(key) ?? 0);
    if (count === 0) {
      out.push({ kind, id, field: '', problem: 'missing item' });
      continue;
    }
    if (count > 1) out.push({ kind, id, field: '', problem: 'item appears twice' });
    const got = fields.get(key) ?? new Map<string, string>();
    for (const [field, text] of want) {
      if (!got.has(field)) out.push({ kind, id, field, problem: 'missing field' });
      else if (got.get(field) !== collapse(text)) out.push({ kind, id, field, problem: 'text differs' });
    }
  }
  for (const key of counts.keys()) {
    if (!expected.has(key)) out.push({ ...split(key), field: '', problem: 'extra item' });
  }
  return out;
}

function main(): void {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const from = arg('from');
  if (!from) {
    console.error('usage: node scripts/compare-cv.ts --from=<export.json> [--dist=dist] [--page=<built html>]');
    process.exit(2);
  }
  const page = arg('page') ?? join(arg('dist') ?? 'dist', 'cv', 'index.html');
  const differences = compareCv(readFileSync(resolve(page), 'utf8'), JSON.parse(readFileSync(resolve(from), 'utf8')) as CvExport);
  if (differences.length === 0) {
    console.log('no differences');
    return;
  }
  for (const d of differences) console.error(differenceLine(d));
  console.error(`compare-cv: ${differences.length} difference(s)`);
  process.exit(1);
}

if (isMain(import.meta.url)) main();
