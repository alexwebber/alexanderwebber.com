// scripts/compare-cv.ts over planted HTML (spec 004, T032; contracts/content-files.md *Compared
// fields*): identical text gives no differences; whitespace and entities don't count; a changed word,
// a missing item, an extra item and a missing field are each reported by kind, id and field, without
// text; two inline elements with no space between them are a difference (testing tips).
import { describe, expect, it } from 'vitest';
import { compareCv, differenceLine } from '../../scripts/compare-cv.ts';
import type { CvExport } from '../../src/sections/cv/data/store/index.ts';
import { smallExport } from '../helpers/cv.ts';

const exp = smallExport();
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** A page built by hand the way the CV page marks its canonical items. */
function page(e: CvExport, edit: (html: string) => string = (h) => h): string {
  const p = e.page;
  const t = e.timeline;
  const field = (name: string, text: string, tag = 'p') => `<${tag} data-cv-field="${name}">${esc(text)}</${tag}>`;
  const html = [
    `<!doctype html><html><head><title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}"></head><body>`,
    `<header data-cv-item="page:page">${field('name', p.name, 'h1')}${field('headline', p.headline)}${field('location', p.location)}`,
    `<span data-cv-field="email" data-user="${p.email_user}" data-domain="${p.email_domain}">${p.email_user} at ${p.email_domain}</span>`,
    `<a data-cv-field="linkedin" href="${p.linkedin}">LinkedIn</a></header>`,
    ...e.blocks.map(
      (b) =>
        `<section data-cv-item="block:${b.id}">${field('heading', b.heading, 'h2')}${b.paragraphs.map((x, i) => field(`paragraphs.${i}`, x)).join('')}</section>` +
        (b.stories ?? []).map((s) => `<div data-cv-item="story:${s.id}">${field('title', s.title, 'h3')}${field('text', s.text)}</div>`).join(''),
    ),
    ...t.themes.map((x) => `<div data-cv-item="theme:${x.id}">${field('name', x.name)}${field('line', x.line)}</div>`),
    ...t.threads.map((x) => `<div data-cv-item="thread:${x.id}">${field('name', x.name)}${field('line', x.line)}</div>`),
    // Tiles and SVG labels repeat a label without the attributes: not compared.
    `<svg><title>A label repeated</title><text>${esc(t.changes[0]!.label)}</text></svg>`,
    ...t.roles.map((x) => `<article data-cv-item="role:${x.id}">${field('label', x.label, 'h3')}<p data-cv-field="when"><time>2012</time> to now</p>${field('card', x.card!)}</article>`),
    ...t.changes.map((x, i) => `<article data-cv-item="change:${x.id}">${field('label', x.label, 'h3')}${field('when', ['2013 to 2016', '2017', 'October 2026'][i]!)}${field('card', x.card!)}</article>`),
    ...t.next.map((x) => `<article data-cv-item="next:${x.id}">${field('title', x.title, 'h3')}${field('card', x.card!)}</article>`),
    ...e.downloads.map((d) => `<a data-cv-item="download:${d.kind}" href="/cv/${d.file}"><span data-cv-field="title">${esc(d.title)}</span></a>`),
    '<script>const x = "<div data-cv-item=\\"change:change-z\\">";</script></body></html>',
  ].join('\n');
  return edit(html);
}
const lines = (html: string) => compareCv(html, exp).map(differenceLine);

describe('compareCv', () => {
  it('finds no differences in a faithful page', () => {
    expect(lines(page(exp))).toEqual([]);
  });

  it("doesn't count extra whitespace or entities", () => {
    const html = page(exp, (h) => h.replace('data-cv-field="card">', 'data-cv-field="card">\n    ').replace(/ made-up/, '&#32;made-up'));
    expect(lines(html)).toEqual([]);
  });

  it('reports a changed word by kind, id and field, without text', () => {
    const card = exp.timeline.changes[1]!.card!;
    const html = page(exp, (h) => h.replace(esc(card), esc(card.replace(/\w+/, 'other'))));
    expect(lines(html)).toEqual(['change change-b: card: text differs']);
  });

  it('reports a missing item, an extra item and a missing field', () => {
    const withoutNext = page(exp, (h) => h.replace(/<article data-cv-item="next:next-a">.*?<\/article>/, ''));
    expect(lines(withoutNext)).toEqual(['next next-a: missing item']);
    const extra = page(exp, (h) => h.replace('</body>', '<div data-cv-item="change:change-x"></div></body>'));
    expect(lines(extra)).toEqual(['change change-x: extra item']);
    const noLine = page(exp, (h) => h.replace(/<p data-cv-field="line">[^<]*<\/p><\/div>\n<div data-cv-item="theme:theme-b">/, '</div>\n<div data-cv-item="theme:theme-b">'));
    expect(lines(noLine)).toEqual(['theme theme-a: line: missing field']);
  });

  it('reports an item that appears twice', () => {
    const html = page(exp, (h) => h.replace('</body>', '<div data-cv-item="theme:theme-a"></div></body>'));
    expect(lines(html)).toEqual(['theme theme-a: item appears twice']);
  });

  it('counts two inline elements with no space between them as one word', () => {
    const label = exp.timeline.changes[0]!.label;
    const [first, ...rest] = label.split(' ');
    const html = page(exp, (h) => h.replace(`<h3 data-cv-field="label">${esc(label)}</h3>`, `<h3 data-cv-field="label"><span>${first}</span><span>${rest.join(' ')}</span></h3>`));
    expect(lines(html)).toEqual(['change change-a: label: text differs']);
  });

  it('compares the title, the description, the email parts and the LinkedIn link', () => {
    const html = page(exp, (h) =>
      h
        .replace(`<title>${esc(exp.page.title)}`, '<title>Another title')
        .replace(`content="${esc(exp.page.description)}"`, 'content="Another description."')
        .replace(`data-domain="${exp.page.email_domain}"`, 'data-domain="example.org"')
        .replace(`href="${exp.page.linkedin}"`, 'href="https://www.linkedin.com/in/someone-else/"'),
    );
    expect(lines(html)).toEqual(['page page: title: text differs', 'page page: description: text differs', 'page page: email: text differs', 'page page: linkedin: text differs']);
  });

  it('compares a `when` as its words', () => {
    const html = page(exp, (h) => h.replace('data-cv-field="when">October 2026', 'data-cv-field="when">2026 Oct'));
    expect(lines(html)).toEqual(['change change-c: when: text differs']);
  });
});
