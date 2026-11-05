// check-links over planted dist/ trees (specs/003-journey-story/contracts/gate.md §1, T018): a clean
// tree passes; each dead link fails alone, then together; a chapter's link is reported by its
// chapter, never its text; and the ignore list holds. All text here is made up.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkLinks } from '../../scripts/check-links.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const page = (body: string) => `<!doctype html><html><head><link rel="stylesheet" href="/_astro/Base.abc.css"><link rel="icon" href="/favicon.svg"></head><body>${body}</body></html>`;
const STORY = page('<h1>Lorem</h1><section id="chapter-a"><p>Lorem <a href="/running/" data-chapter-link="chapter-a">ipsum dolor</a>.</p></section>');

/** A small built site: the landing, the story page, a run page, the favicon and the sitemap. */
function site(extra: Record<string, string> = {}) {
  repo?.cleanup();
  repo = tempRepo();
  const files: Record<string, string> = {
    'dist/index.html': page('<a href="/running/">Running</a> <a href="/running/runs/2001-03-15-abcd/">Run</a> <a href="/sitemap-index.xml">Sitemap</a>'),
    'dist/running/index.html': page('<p class="story-link"><a href="/running/story/">Lorem ipsum</a></p><a href="/running/story/#chapter-a">Chapter</a>'),
    'dist/running/story/index.html': STORY,
    'dist/running/runs/2001-03-15-abcd/index.html': page('<a href="/running/">Back</a>'),
    'dist/favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'dist/sitemap-index.xml': '<sitemapindex/>',
    ...extra,
  };
  for (const [file, content] of Object.entries(files)) repo.write(file, content);
  return join(repo.root, 'dist');
}
const messages = (dist: string) => checkLinks(dist).map((i) => `${i.file}: ${i.message}`);

describe('check-links', () => {
  it('passes a clean tree', () => {
    expect(checkLinks(site())).toEqual([]);
  });

  it('fails a dead site link', () => {
    const dist = site({ 'dist/running/runs/2001-03-15-abcd/index.html': page('<a href="/running/goals/">Goals</a>') });
    expect(messages(dist)).toEqual(["dist/running/runs/2001-03-15-abcd/index.html: links to /running/goals/, which the build didn't make"]);
  });

  it("fails a dead chapter link, naming the chapter, not the link's text", () => {
    const dist = site({ 'dist/running/story/index.html': STORY.replace('href="/running/"', 'href="/running/lorem/"') });
    const issues = checkLinks(dist);
    expect(issues).toEqual([
      { file: 'dist/running/story/index.html', path: '/running/lorem/', chapter: 'chapter-a', message: `chapter "chapter-a" links to /running/lorem/, which the build didn't make` },
    ]);
    expect(JSON.stringify(issues)).not.toContain('ipsum dolor');
  });

  it('fails a story_link panel that leads nowhere (no story page built)', () => {
    repo = tempRepo();
    repo.write('dist/running/index.html', page('<p class="story-link"><a href="/running/story/">Lorem ipsum</a></p>'));
    repo.write('dist/favicon.svg', '<svg/>');
    expect(messages(join(repo.root, 'dist'))).toEqual(["dist/running/index.html: links to /running/story/, which the build didn't make"]);
  });

  it('fails a missing #anchor on the story page, and its own #links', () => {
    const dist = site({ 'dist/running/index.html': page('<a href="/running/story/#chapter-z">Chapter</a>') });
    expect(messages(dist)).toEqual(["dist/running/index.html: links to /running/story/#chapter-z, which the build didn't make"]);
    const own = site({ 'dist/running/story/index.html': STORY.replace('</section>', '</section><a href="#chapters">Back to chapters</a>') });
    expect(messages(own)).toEqual(["dist/running/story/index.html: links to /running/story/#chapters, which the build didn't make"]);
  });

  it('reports every dead link at once', () => {
    const dist = site({
      'dist/running/index.html': page('<a href="/running/goals/">Goals</a> <a href="/running/story/#chapter-z">Chapter</a>'),
      'dist/running/story/index.html': STORY.replace('href="/running/"', 'href="/running/lorem/"'),
    });
    expect(messages(dist)).toEqual([
      "dist/running/index.html: links to /running/goals/, which the build didn't make",
      "dist/running/index.html: links to /running/story/#chapter-z, which the build didn't make",
      `dist/running/story/index.html: chapter "chapter-a" links to /running/lorem/, which the build didn't make`,
    ]);
  });

  it('ignores external, mailto:, /_astro/ and /running/api/ links, and fragments on other pages', () => {
    const dist = site({
      'dist/index.html': page(
        [
          '<a href="https://example.org/lorem/">External</a>',
          "<a href='http://example.org/'>Plain</a>",
          '<a href="//example.org/">Protocol-relative</a>',
          '<a href="mailto:lorem@example.org">Mail</a>',
          '<script type="module" src="/_astro/page.abc.js"></script><link rel="preload" href="/_astro/missing.woff2">',
          '<a href="/running/api/refresh">Refresh</a>',
          '<a href="/running/#no-such-id">Anchor elsewhere</a>',
          '<a href="#main">Skip</a>',
        ].join(''),
      ),
    });
    expect(checkLinks(dist)).toEqual([]);
  });

  it('resolves a file path itself, a query and entities, and single-quoted attributes', () => {
    const dist = site({ 'dist/index.html': page(`<a href='/favicon.svg?v=1'>Icon</a><a href="/running/?a=1&amp;b=2">Q</a>`) });
    expect(checkLinks(dist)).toEqual([]);
    const dead = site({ 'dist/index.html': page(`<a href='/running'>No slash</a>`) });
    expect(messages(dead)).toEqual(["dist/index.html: links to /running, which the build didn't make"]);
  });
});
