// The journey story's text and dates (specs/003-journey-story/data-model.md §5, research.md R6):
// pure functions, no dependency. validate.ts uses them to refuse anything the page couldn't show;
// the story page renders from the same parse, with the display helpers at the end (dates, order,
// Garmin attribution).
//
// Prose is plain text in paragraphs separated by blank lines, with two inline forms only:
// `{{figure-id}}` (a figure: inline inside a sentence, set apart when alone in its paragraph) and
// `[link text](/path/)` (a page of this site). Anything else that looks like markup is an issue
// carrying the paragraph number, never the text (FR-035).

/** A piece of a text paragraph: plain text, an inline figure, or a link to a page of this site. */
export type ParagraphPart = string | { figure: string } | { link: string; text: string };

export type Paragraph = { kind: 'figure'; id: string } | { kind: 'text'; parts: ParagraphPart[] };

export type ProseProblem = 'markup' | 'link' | 'figure';

/** Something in a paragraph the page can't show. Never carries the text. */
export interface ProseIssue {
  /** 1-based. */
  paragraph: number;
  problem: ProseProblem;
  message: string;
}

export interface ParsedText {
  paragraphs: Paragraph[];
  issues: ProseIssue[];
}

export interface ParseOptions {
  /** `{{figure-id}}` placeholders allowed (chapters' prose). Default true. */
  figures?: boolean;
  /** `[text](/path/)` links allowed. Default true. */
  links?: boolean;
}

const FIGURE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** One leading `/`, segments each ending in `/`, then an optional `#anchor`: no scheme, query or spaces. */
export const SITE_PATH = /^\/(?:[A-Za-z0-9._~%-]+\/)*(?:#[A-Za-z0-9_-]+)?$/;
/** A placeholder or something link-shaped, in the order they appear. */
const TOKEN = /\{\{([^{}]*)\}\}|\[([^[\]]*)\]\(([^()]*)\)/g;
const TAG = /<[A-Za-z/]/;

export const PROSE_MESSAGES = {
  braces: 'has an unmatched {{ or }}, or a {{…}} that isn\'t a figure id (only {{figure-id}} placeholders are allowed)',
  bracket: 'has [text]( that isn\'t a link of the form [text](/path/)',
  tag: 'has an HTML-like tag (< followed by a letter or /); write plain text',
  emptyLink: 'has a link with no text',
  link: 'has a link that isn\'t a path on this site: use [text](/path/) or [text](/path/#anchor), with no scheme, query or spaces',
  noLinks: 'has a link, which isn\'t allowed here: write plain text',
  noFigures: 'has a figure placeholder, which isn\'t allowed here: figures belong in a chapter\'s prose',
} as const;

/** Splits text into paragraphs at blank lines. Leading and trailing blank lines are ignored. */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n(?:[ \t]*\n)+/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

function strayMarkup(text: string): (keyof typeof PROSE_MESSAGES)[] {
  const found: (keyof typeof PROSE_MESSAGES)[] = [];
  if (text.includes('{{') || text.includes('}}')) found.push('braces');
  if (text.includes('](')) found.push('bracket');
  if (TAG.test(text)) found.push('tag');
  return found;
}

/** Parses a chapter's prose (data-model.md §5). */
export function parseProse(prose: string, options: ParseOptions = {}): ParsedText {
  const figures = options.figures ?? true;
  const links = options.links ?? true;
  const paragraphs: Paragraph[] = [];
  const issues: ProseIssue[] = [];

  splitParagraphs(prose).forEach((text, i) => {
    const paragraph = i + 1;
    const issue = (problem: ProseProblem, key: keyof typeof PROSE_MESSAGES) => {
      if (!issues.some((x) => x.paragraph === paragraph && x.message === PROSE_MESSAGES[key])) {
        issues.push({ paragraph, problem, message: PROSE_MESSAGES[key] });
      }
    };
    const lone = /^\{\{([^{}]*)\}\}$/.exec(text);
    if (lone && FIGURE_ID.test(lone[1]!)) {
      if (!figures) issue('figure', 'noFigures');
      paragraphs.push({ kind: 'figure', id: lone[1]! });
      return;
    }

    const parts: ParagraphPart[] = [];
    let rest = 0;
    const plain = (s: string) => {
      if (s === '') return;
      for (const key of strayMarkup(s)) issue('markup', key);
      const last = parts.at(-1);
      if (typeof last === 'string') parts[parts.length - 1] = last + s;
      else parts.push(s);
    };
    for (const match of text.matchAll(TOKEN)) {
      plain(text.slice(rest, match.index));
      rest = match.index + match[0].length;
      const [whole, id, linkText, target] = match;
      if (id !== undefined) {
        if (!FIGURE_ID.test(id)) {
          issue('markup', 'braces');
          parts.push(whole);
        } else {
          if (!figures) issue('figure', 'noFigures');
          parts.push({ figure: id });
        }
        continue;
      }
      if (!links) {
        issue('link', 'noLinks');
        parts.push(whole);
        continue;
      }
      if (!SITE_PATH.test(target!)) {
        issue('link', 'link');
        parts.push(whole);
        continue;
      }
      if (linkText!.trim() === '') issue('markup', 'emptyLink');
      for (const key of strayMarkup(linkText!)) issue('markup', key);
      parts.push({ link: target!, text: linkText! });
    }
    plain(text.slice(rest));
    paragraphs.push({ kind: 'text', parts });
  });
  return { paragraphs, issues };
}

/** The closing section's text (links, no figures), or with `links: false` a note or takeaway. */
export function parseText(text: string, options: ParseOptions = { figures: false }): ParsedText {
  return parseProse(text, { figures: false, ...options });
}

/** The figure IDs a parse places, in order, with repeats. */
export function placedFigures(parsed: ParsedText): string[] {
  return parsed.paragraphs.flatMap((p) =>
    p.kind === 'figure' ? [p.id] : p.parts.flatMap((part) => (typeof part === 'object' && 'figure' in part ? [part.figure] : [])),
  );
}

/** One end of a `when`: a day or a month, as written, with its first and last day. */
export interface WhenEnd {
  text: string;
  kind: 'day' | 'month';
  first: string;
  last: string;
}

export interface When {
  kind: 'day' | 'month' | 'period';
  /** The first day it covers (YYYY-MM-DD). */
  start: string;
  /** The last day it covers (YYYY-MM-DD). */
  end: string;
  from: WhenEnd;
  /** The same as `from` for a day or a month. */
  to: WhenEnd;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseEnd(text: string): WhenEnd | undefined {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text);
  if (!match) return undefined;
  const [y, m] = [Number(match[1]), Number(match[2])];
  if (m < 1 || m > 12) return undefined;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const month = `${match[1]}-${match[2]}`;
  if (match[3] === undefined) return { text, kind: 'month', first: `${month}-01`, last: `${month}-${pad(daysInMonth)}` };
  const d = Number(match[3]);
  if (d < 1 || d > daysInMonth) return undefined;
  return { text, kind: 'day', first: text, last: text };
}

/**
 * A chapter's `when`: a day (`2001-03-15`), a month (`2001-03`) or a period (`<start>/<end>`, each a
 * day or a month). Undefined when it isn't one, or names a day that doesn't exist. A period whose
 * start isn't before its end still parses: validation refuses it (`startsBeforeEnd`).
 */
export function parseWhen(when: string): When | undefined {
  const ends = when.split('/');
  if (ends.length > 2) return undefined;
  const from = parseEnd(ends[0]!);
  const to = ends.length === 2 ? parseEnd(ends[1]!) : from;
  if (!from || !to) return undefined;
  return { kind: ends.length === 2 ? 'period' : from.kind, start: from.first, end: to.last, from, to };
}

/** A period's start comes before its end (each end compared by its first day). */
export function startsBeforeEnd(when: When): boolean {
  return when.kind !== 'period' || when.from.first < when.to.first;
}

/** Whether a day or month, or a period's end, is after `today`: its first day is (research.md R6). */
export function isAfter(when: When, today: string): boolean {
  return when.to.first > today;
}

// --- Display (data-model.md §10; owner decisions 1 and 2, #105) ---------------------------------

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** One `<time>` element's text and `datetime` value. A period has two, joined by " to ". */
export interface WhenPart {
  text: string;
  /** `YYYY-MM-DD` for a day, `YYYY-MM` for a month: valid HTML `datetime` values. */
  datetime: string;
}

function endText(end: WhenEnd, withYear: boolean): string {
  const [y, m, d] = end.text.split('-');
  const year = withYear ? ` ${y}` : '';
  return end.kind === 'day' ? `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]}${year}` : `${MONTHS_LONG[Number(m) - 1]}${year}`;
}

/**
 * A `when` as shown: "15 Mar 2001" for a day (spec 001's date format), "March 2001" for a month
 * (months in full when there's no day), and a period's two ends joined by " to ", the year said
 * once when both ends share it: "March to September 2001", "March 2001 to February 2002",
 * "15 Mar to 20 Sep 2001". HTML has no `datetime` for a range, so a period is two `<time>`s.
 */
export function whenParts(when: When): WhenPart[] {
  if (when.kind !== 'period') return [{ text: endText(when.from, true), datetime: when.from.text }];
  const sameYear = when.from.text.slice(0, 4) === when.to.text.slice(0, 4);
  return [
    { text: endText(when.from, !sameYear), datetime: when.from.text },
    { text: endText(when.to, true), datetime: when.to.text },
  ];
}

/** `whenParts` as one line of text. */
export function whenText(when: When): string {
  return whenParts(when)
    .map((part) => part.text)
    .join(' to ');
}

/** What `sortChapters` reads of a chapter. */
export interface Sortable {
  id: string;
  when: string;
  order?: number | undefined;
}

/**
 * Chapters oldest first (FR-002): by the first day `when` covers, then `order` (validation makes
 * ties carry distinct ones), then `id`, so every build gives the same order. A `when` that doesn't
 * parse sorts last; validation refuses it before a build.
 */
export function sortChapters<T extends Sortable>(chapters: readonly T[]): T[] {
  const start = (c: T) => parseWhen(c.when)?.start ?? '9999-12-31';
  const order = (c: T) => c.order ?? Number.MAX_SAFE_INTEGER;
  return chapters.toSorted((a, b) => start(a).localeCompare(start(b)) || order(a) - order(b) || a.id.localeCompare(b.id));
}

export const DERIVED_SOURCE = 'derived in part from Garmin device-sourced data';

/**
 * A figure's Garmin attribution as shown beside it (research.md R1, FR-014): "Garmin <device>",
 * "Garmin", or the derived wording for `derived`. Undefined for a figure without `garmin`: the
 * owner's own figure shows nothing extra.
 */
export function sourceText(garmin: string | undefined): string | undefined {
  if (garmin === undefined) return undefined;
  if (garmin === 'Garmin') return 'Garmin';
  if (garmin === 'derived') return DERIVED_SOURCE;
  return `Garmin ${garmin}`;
}
