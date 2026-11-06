// The journey story's words as a built page shows them (spec 003 T034; SC-003, SC-005): from the story
// page's HTML, each chapter's plain text in reading order (name, when, each paragraph with its
// figures' text and sources, takeaway), then the closing section's (heading, paragraphs) and the
// note's. Only whitespace is normalised, so the result can be compared character for character with
// the approved text. tests/e2e/story.spec.ts uses it on the previews; the content PR runs the same
// function over dist/running/story/index.html from a scratchpad script (T080).
//
// It reads the markup of contracts/routes.md *The page* (StoryChapter, StoryProse, StoryFigure,
// StoryClosing, StoryNote), our own build output, not arbitrary HTML. The page's own labels ("What I
// learned") are structure, not story text, so they're left out.
//
// The other side of the comparison is approvedText(): the approved files' words as the page must show
// them, read from a data tree by readJourney() (a preview's fixture, or a drill's scratch copy,
// tests/e2e/story-launch.spec.ts).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { parseProse, parseText, parseWhen, sourceText, whenText } from '../../src/sections/running/domain/journey.ts';

interface FigureFile {
  id: string;
  label: string;
  as_of: string;
  text: string;
  garmin?: string;
}
interface ChapterFile {
  id: string;
  name: string;
  when: string;
  order?: number;
  prose: string;
  takeaway: string;
  figures?: FigureFile[];
  /** Photos: not story text here (alt text and captions are checked in tests/e2e/story.spec.ts). */
  photos?: { file: string; description: string; caption: string }[];
}
/** A journey's approved files, as written. */
export interface JourneyFiles {
  chapters: ChapterFile[];
  closing?: { heading: string; text: string };
  note: { text: string };
}

/** The journey files under `root`'s data/running/owner/journey/. */
export function readJourney(root: string): JourneyFiles {
  const dir = join(root, 'data/running/owner/journey');
  const read = <T,>(file: string): T | undefined => (existsSync(file) ? (parse(readFileSync(file, 'utf8')) as T) : undefined);
  const chapters = readdirSync(join(dir, 'chapters')).map((id) => read<ChapterFile>(join(dir, 'chapters', id, 'chapter.yaml'))!);
  const closing = read<JourneyFiles['closing']>(join(dir, 'closing.yaml'));
  return { chapters, ...(closing ? { closing } : {}), note: read<JourneyFiles['note']>(join(dir, 'note.yaml'))! };
}

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

/** A figure as the approved text reads once its placeholder is replaced: "12.3 kg (Garmin Example S1)". */
export const inlineFigure = (figure: FigureFile) => [figure.text, ...(sourceText(figure.garmin) ? [`(${sourceText(figure.garmin)})`] : [])].join(' ');

/**
 * The approved text with each placeholder replaced by its figure (and source) and each link by its
 * text (SC-003): what the page must show, character for character once whitespace is normalised.
 * `order` is the chapters' IDs as the page shows them.
 */
export function approvedText(data: JourneyFiles, order: string[]): StoryText {
  const byId = new Map(data.chapters.map((c) => [c.id, c]));
  const chapters = order.map((id) => {
    const chapter = byId.get(id)!;
    const figures = new Map((chapter.figures ?? []).map((f) => [f.id, f]));
    const paragraphs = parseProse(chapter.prose).paragraphs.map((p) => {
      if (p.kind === 'figure') {
        const figure = figures.get(p.id)!;
        return `${figure.label}, ${whenText(parseWhen(figure.as_of)!)}: ${inlineFigure(figure)}`;
      }
      return p.parts.map((part) => (typeof part === 'string' ? part : 'figure' in part ? inlineFigure(figures.get(part.figure)!) : part.text)).join('');
    });
    return { id, name: norm(chapter.name), when: whenText(parseWhen(chapter.when)!), paragraphs: paragraphs.map(norm), takeaway: norm(chapter.takeaway) };
  });
  const closing = data.closing && {
    heading: norm(data.closing.heading),
    paragraphs: parseText(data.closing.text).paragraphs.map((p) => norm(p.kind === 'text' ? p.parts.map((part) => (typeof part === 'string' ? part : 'text' in part ? part.text : '')).join('') : '')),
  };
  return { chapters, ...(closing ? { closing } : {}), note: norm(data.note.text) };
}

export interface ChapterText {
  id: string;
  name: string;
  when: string;
  /** Prose paragraphs, set-apart figures included, in order. */
  paragraphs: string[];
  takeaway: string;
}

export interface StoryText {
  chapters: ChapterText[];
  closing?: { heading: string; paragraphs: string[] };
  note?: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decodes the character references Astro's escaping produces (named, decimal and hex). */
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') return String.fromCodePoint(ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : Number(ref.slice(1)));
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/**
 * An element's text as a reader sees it: tags dropped without adding a space (everything inside a
 * paragraph is inline, so a missing space between a figure and its source shows up here as it does
 * on the page), references decoded, whitespace collapsed. A scanner rather than a regex replace,
 * as html.ts's stripTags explains.
 */
export function plainText(html: string): string {
  let text = '';
  let at = 0;
  for (let open = html.indexOf('<'); open !== -1; open = html.indexOf('<', at)) {
    text += html.slice(at, open);
    const end = html.indexOf('>', open);
    if (end === -1) break;
    at = end + 1;
  }
  if (html.indexOf('<', at) === -1) text += html.slice(at);
  return decode(text).replace(/\s+/g, ' ').trim();
}

/** The inner HTML of each top-level `<tag ...>` in `html` matching `open` (no nesting of the same tag). */
function elements(html: string, tag: string, open: RegExp = new RegExp(`<${tag}(\\s[^>]*)?>`, 'g')): { attrs: string; inner: string }[] {
  const found: { attrs: string; inner: string }[] = [];
  for (const match of html.matchAll(open)) {
    const start = match.index + match[0].length;
    const end = html.indexOf(`</${tag}>`, start);
    if (end === -1) break;
    found.push({ attrs: match[1] ?? '', inner: html.slice(start, end) });
  }
  return found;
}

export function storyText(html: string): StoryText {
  const main = /<main[\s>][\s\S]*<\/main>/.exec(html)?.[0] ?? html;
  const sections = elements(main, 'section');

  const chapters: ChapterText[] = [];
  let closing: StoryText['closing'];
  for (const { attrs, inner } of sections) {
    if (/\bclass="story-chapter"/.test(attrs)) {
      const id = /\bid="([^"]+)"/.exec(attrs)?.[1] ?? '';
      const takeawayAt = inner.indexOf('<div class="story-takeaway"');
      const body = takeawayAt === -1 ? inner : inner.slice(0, takeawayAt);
      const takeaway = takeawayAt === -1 ? '' : (elements(inner.slice(takeawayAt), 'p')[0]?.inner ?? '');
      const paragraphs = elements(body, 'p');
      const when = paragraphs.find((p) => /\bclass="story-when"/.test(p.attrs));
      chapters.push({
        id,
        name: plainText(elements(inner, 'h2')[0]?.inner ?? ''),
        when: plainText(when?.inner ?? ''),
        paragraphs: paragraphs.filter((p) => p !== when).map((p) => plainText(p.inner)),
        takeaway: plainText(takeaway),
      });
    } else if (/\bclass="story-closing"/.test(attrs)) {
      closing = { heading: plainText(elements(inner, 'h2')[0]?.inner ?? ''), paragraphs: elements(inner, 'p').map((p) => plainText(p.inner)) };
    }
  }
  const note = elements(main, 'p', /<p(\s[^>]*\bclass="story-note"[^>]*)>/g)[0];
  return { chapters, ...(closing ? { closing } : {}), ...(note ? { note: plainText(note.inner) } : {}) };
}

/** A chapter's text as one string, in reading order. */
export const chapterText = (chapter: ChapterText): string => [chapter.name, chapter.when, ...chapter.paragraphs, chapter.takeaway].join('\n');
