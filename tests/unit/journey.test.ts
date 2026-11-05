// The journey story's pure parsing (specs/003-journey-story/data-model.md §5, research.md R6):
// every prose form, each stray-markup case with its paragraph number, the closing and note
// variants, and `when` in each form; then the display half (Phase 2): chapter order, dates as shown
// and Garmin attribution text. All text here is made up.
import { describe, expect, it } from 'vitest';
import {
  DERIVED_SOURCE,
  isAfter,
  parseProse,
  parseText,
  parseWhen,
  placedFigures,
  PROSE_MESSAGES,
  sortChapters,
  sourceText,
  startsBeforeEnd,
  whenParts,
  whenText,
} from '../../src/sections/running/domain/journey.ts';

const problems = (prose: string, options = {}) => parseProse(prose, options).issues.map((i) => [i.paragraph, i.problem, i.message]);

describe('parseProse', () => {
  it('splits paragraphs at blank lines, ignoring leading and trailing blank lines', () => {
    const { paragraphs, issues } = parseProse('\n\nLorem ipsum.\nDolor sit.\n\n  \n\nAmet consectetur.\n\n\n');
    expect(issues).toEqual([]);
    expect(paragraphs).toEqual([
      { kind: 'text', parts: ['Lorem ipsum.\nDolor sit.'] },
      { kind: 'text', parts: ['Amet consectetur.'] },
    ]);
    expect(parseProse('Lorem.\r\n\r\nIpsum.\r\n').paragraphs).toHaveLength(2);
  });

  it('reads an inline figure, a lone figure, and links with and without an anchor', () => {
    const { paragraphs, issues } = parseProse(
      'Lorem {{fig-a}} ipsum.\n\n{{fig-b}}\n\nDolor [sit amet](/running/fundraising/) and [elit](/running/story/#chapter-a).\n',
    );
    expect(issues).toEqual([]);
    expect(paragraphs).toEqual([
      { kind: 'text', parts: ['Lorem ', { figure: 'fig-a' }, ' ipsum.'] },
      { kind: 'figure', id: 'fig-b' },
      { kind: 'text', parts: ['Dolor ', { link: '/running/fundraising/', text: 'sit amet' }, ' and ', { link: '/running/story/#chapter-a', text: 'elit' }, '.'] },
    ]);
    expect(placedFigures(parseProse('Lorem {{fig-a}}.\n\n{{fig-b}}\n\n{{fig-a}} ipsum.'))).toEqual(['fig-a', 'fig-b', 'fig-a']);
    expect(parseProse('[Home](/)').issues).toEqual([]);
  });

  it('reports each stray-markup case with its paragraph number, never the text', () => {
    expect(problems('Lorem.\n\nIpsum {{ dolor.')).toEqual([[2, 'markup', PROSE_MESSAGES.braces]]);
    expect(problems('Lorem }} ipsum.')).toEqual([[1, 'markup', PROSE_MESSAGES.braces]]);
    expect(problems('Lorem {{Not An Id}} ipsum.')).toEqual([[1, 'markup', PROSE_MESSAGES.braces]]);
    expect(problems('Lorem.\n\nIpsum.\n\nDolor [sit](https://example.org/) amet.')).toEqual([[3, 'link', PROSE_MESSAGES.link]]);
    expect(problems('Lorem [sit](/path?q=1) amet.')).toEqual([[1, 'link', PROSE_MESSAGES.link]]);
    expect(problems('Lorem [sit](path/) amet.')).toEqual([[1, 'link', PROSE_MESSAGES.link]]);
    expect(problems('Lorem [sit](/path) amet.')).toEqual([[1, 'link', PROSE_MESSAGES.link]]);
    expect(problems('Lorem [sit](/a b/) amet.')).toEqual([[1, 'link', PROSE_MESSAGES.link]]);
    expect(problems('Lorem [sit](//example.org/) amet.')).toEqual([[1, 'link', PROSE_MESSAGES.link]]);
    expect(problems('Lorem ](/x/ amet.')).toEqual([[1, 'markup', PROSE_MESSAGES.bracket]]);
    expect(problems('Lorem <b>ipsum</b>.')).toEqual([[1, 'markup', PROSE_MESSAGES.tag]]);
    expect(problems('Lorem.\n\nIpsum </p> dolor.')).toEqual([[2, 'markup', PROSE_MESSAGES.tag]]);
    expect(problems('Lorem [](/running/) ipsum.')).toEqual([[1, 'markup', PROSE_MESSAGES.emptyLink]]);
    expect(problems('Lorem [<i>x</i>](/running/) ipsum.')).toEqual([[1, 'markup', PROSE_MESSAGES.tag]]);
    for (const [, , message] of problems('Zorblax {{ <b>Zorblax</b> [Zorblax](https://zorblax.example/)')) expect(String(message)).not.toContain('orblax');
  });

  it('lets a plain < and a bracket without a link through', () => {
    expect(problems('Lorem < ipsum, 3 < 4, and [dolor] sit (amet).')).toEqual([]);
  });

  it('refuses figures in the closing variant, and links too where none are allowed', () => {
    expect(parseText('Lorem [ipsum](/running/).\n\nDolor.').issues).toEqual([]);
    expect(problems('Lorem.\n\nIpsum {{fig-a}} dolor.', { figures: false })).toEqual([[2, 'figure', PROSE_MESSAGES.noFigures]]);
    expect(parseText('{{fig-a}}').issues.map((i) => i.problem)).toEqual(['figure']);
    expect(parseText('Lorem [ipsum](/running/).', { links: false }).issues.map((i) => [i.paragraph, i.problem])).toEqual([[1, 'link']]);
  });
});

describe('parseWhen', () => {
  it('reads a day, a month and a period, by first and last day', () => {
    expect(parseWhen('2001-03-15')).toMatchObject({ kind: 'day', start: '2001-03-15', end: '2001-03-15' });
    expect(parseWhen('2001-02')).toMatchObject({ kind: 'month', start: '2001-02-01', end: '2001-02-28' });
    expect(parseWhen('2004-02')).toMatchObject({ end: '2004-02-29' });
    expect(parseWhen('2001-03/2001-09')).toMatchObject({ kind: 'period', start: '2001-03-01', end: '2001-09-30' });
    expect(parseWhen('2001-11/2002-02')).toMatchObject({ kind: 'period', start: '2001-11-01', end: '2002-02-28' });
    expect(parseWhen('2001-03-15/2001-04')).toMatchObject({ kind: 'period', start: '2001-03-15', end: '2001-04-30' });
  });

  it("refuses what isn't a day, a month or a period", () => {
    for (const when of ['2001-02-30', '2001-13', '2001', '2001-03/2001-04/2001-05', 'lorem', '2001-3']) expect(parseWhen(when)).toBeUndefined();
  });

  it('knows a period whose start is after its end', () => {
    expect(startsBeforeEnd(parseWhen('2001-09/2001-03')!)).toBe(false);
    expect(startsBeforeEnd(parseWhen('2001-03/2001-03')!)).toBe(false);
    expect(startsBeforeEnd(parseWhen('2001-12/2002-01')!)).toBe(true);
    expect(startsBeforeEnd(parseWhen('2001-03')!)).toBe(true);
  });

  it("is after today when its end's first day is", () => {
    expect(isAfter(parseWhen('2026-11')!, '2026-11-10')).toBe(false);
    expect(isAfter(parseWhen('2026-12')!, '2026-11-10')).toBe(true);
    expect(isAfter(parseWhen('2026-11-11')!, '2026-11-10')).toBe(true);
    expect(isAfter(parseWhen('2026-01/2026-11')!, '2026-11-10')).toBe(false);
  });
});

describe('sortChapters (FR-002)', () => {
  const ids = (chapters: { id: string; when: string; order?: number }[]) => sortChapters(chapters).map((c) => c.id);

  it('puts chapters oldest first by the first day they cover', () => {
    expect(ids([
      { id: 'c', when: '2003-01' },
      { id: 'a', when: '2001-03-15' },
      { id: 'b', when: '2002-06/2004-01' },
    ])).toEqual(['a', 'b', 'c']);
  });

  it('puts a month before a later day in the same month, and a period by its start', () => {
    expect(ids([
      { id: 'day', when: '2001-03-02' },
      { id: 'month', when: '2001-03' },
      { id: 'period', when: '2001-02/2001-12' },
    ])).toEqual(['period', 'month', 'day']);
  });

  it('breaks a tie by order, whatever the ids or the input order', () => {
    const tied = [
      { id: 'a', when: '2001-03-01', order: 2 },
      { id: 'b', when: '2001-03', order: 1 },
    ];
    expect(ids(tied)).toEqual(['b', 'a']);
    expect(ids(tied.toReversed())).toEqual(['b', 'a']);
  });

  it('gives the same order on every run, and leaves its input alone', () => {
    const chapters = [
      { id: 'b', when: '2001-03' },
      { id: 'a', when: '2001-03' },
      { id: 'c', when: '2000-01' },
    ];
    const once = ids(chapters);
    expect(ids(chapters.toReversed())).toEqual(once);
    expect(once).toEqual(['c', 'a', 'b']);
    expect(chapters.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('whenText and whenParts (owner decision 2, FR-077)', () => {
  it.each([
    ['2001-03-15', '15 Mar 2001', ['2001-03-15']],
    ['2001-03-05', '5 Mar 2001', ['2001-03-05']],
    ['2001-03', 'March 2001', ['2001-03']],
    ['2001-03/2001-09', 'March to September 2001', ['2001-03', '2001-09']],
    ['2001-03/2002-02', 'March 2001 to February 2002', ['2001-03', '2002-02']],
    ['2001-03-15/2001-09-20', '15 Mar to 20 Sep 2001', ['2001-03-15', '2001-09-20']],
    ['2001-03-15/2002-01', '15 Mar 2001 to January 2002', ['2001-03-15', '2002-01']],
    ['2001-03/2001-09-20', 'March to 20 Sep 2001', ['2001-03', '2001-09-20']],
  ])('%s reads "%s", with datetime values %j', (when, text, datetimes) => {
    const parsed = parseWhen(when)!;
    expect(whenText(parsed)).toBe(text);
    expect(whenParts(parsed).map((p) => p.datetime)).toEqual(datetimes);
    expect(whenParts(parsed).map((p) => p.text).join(' to ')).toBe(text);
  });
});

describe('sourceText (owner decision 1, research.md R1)', () => {
  it('names the device, plain Garmin, or the derived wording', () => {
    expect(sourceText('Example S1')).toBe('Garmin Example S1');
    expect(sourceText('Garmin')).toBe('Garmin');
    expect(sourceText('derived')).toBe(DERIVED_SOURCE);
    expect(DERIVED_SOURCE).toBe('derived in part from Garmin device-sourced data');
  });

  it("shows nothing for the owner's own figure", () => {
    expect(sourceText(undefined)).toBeUndefined();
  });
});
