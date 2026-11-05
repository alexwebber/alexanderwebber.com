// The journey story's pure parsing (specs/003-journey-story/data-model.md §5, research.md R6):
// every prose form, each stray-markup case with its paragraph number, the closing and note
// variants, and `when` in each form. All text here is made up.
import { describe, expect, it } from 'vitest';
import { isAfter, parseProse, parseText, parseWhen, placedFigures, PROSE_MESSAGES, startsBeforeEnd } from '../../src/sections/running/domain/journey.ts';

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
