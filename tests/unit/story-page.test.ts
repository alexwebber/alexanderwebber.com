// The journey story page (spec 003 T036; US1, US2, FR-002 to FR-008, FR-010, FR-011, FR-014, FR-053,
// FR-071), rendered with Astro's container API over the data loader and made-up journeys: a
// chapter's parts in order, inline and set-apart figures with their sources, escaped text, links,
// the heading outline, and what the page never shows. Also loadJourney's own contract (FR-042, and
// its refusals naming no text). Browser checks (layout, widths, no JavaScript, axe) are in
// tests/e2e/story.spec.ts and tests/a11y/story.spec.ts. All text here is made up.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ImageMetadata } from 'astro';
import StoryPage from '../../src/sections/running/components/StoryPage.astro';
import { CHAPTER_LIST_AT, loadJourney, showChapterList, type JourneyView } from '../../src/sections/running/data/journey.ts';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
import type { PhotoFiles } from '../../src/sections/running/data/photos.ts';
import type { Journey, JourneyChapter, JourneyClosing, JourneyNote, JourneyPage, RunningStore } from '../../src/sections/running/data/store/index.ts';
import { DataValidationError } from '../../src/shared/storage/errors.ts';
import { approve, chapter, closing, lorem, note, page, type Value } from '../helpers/journey.ts';
import { emptyOwner } from '../helpers/owner-data.ts';
import { plainText, storyText } from '../helpers/story-text.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com' } });
});
afterEach(() => setRunningStore(undefined));

function store(journey: Partial<Journey>): RunningStore {
  return {
    listRuns: async () => [],
    getRun: async () => undefined,
    getRaceTrack: async () => undefined,
    getHealthSeries: async () => [],
    getRefreshRecord: async () => undefined,
    getCampaignFigures: async () => [],
    getOwner: async () => emptyOwner({ journey: { chapters: [], ...journey } }),
  };
}

const asChapter = (value: Value) => approve('chapter', value) as unknown as JourneyChapter;
const NOTE = approve('note', note()) as unknown as JourneyNote;
const PAGE = approve('page', page()) as unknown as JourneyPage;
const CLOSING = approve('closing', closing({ text: `${lorem(40, 6)} [${lorem(41, 2).toLowerCase()}](/running/goals/) ${lorem(42, 3).toLowerCase()}.\n` })) as unknown as JourneyClosing;

/** A chapter with an inline Garmin figure, then a set-apart one after its paragraph. */
const FIGURES = chapter('chapter-b', {
  name: lorem(20, 2),
  when: '2026-05-15',
  prose: `${lorem(21, 7)} {{fig-a}} ${lorem(22, 4).toLowerCase()}.\n\n{{fig-b}}\n\n${lorem(23, 6)}.\n`,
  figures: [
    { id: 'fig-a', category: 'weight', label: lorem(24, 1), as_of: '2026-05', text: '12.3 kg', source: 'owner', garmin: 'Example S1' },
    { id: 'fig-b', category: 'vo2_max', label: 'VO2 max', as_of: '2026-05-15', text: '11', source: 'owner', garmin: 'Garmin' },
  ],
});

async function render(journey: Partial<Journey>): Promise<string> {
  const from = store({ note: NOTE, page: PAGE, ...journey });
  setRunningStore(from);
  const view = await loadJourney(from);
  return renderView(view!);
}

async function renderView(view: JourneyView): Promise<string> {
  const html = await container.renderToString(StoryPage, { props: { journey: view, image: '/og/running-story.png' }, request: new Request('https://alexanderwebber.com/running/story/') });
  return html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
}

const main = (html: string) => /<main[\s\S]*<\/main>/.exec(html)![0];
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
const chapterHtml = (html: string, id: string) => new RegExp(`<section class="story-chapter" id="${id}"[\\s\\S]*?</section>`).exec(html)![0];

describe('a chapter (US1.1, FR-003, FR-004)', () => {
  it('has its parts in order: name, when, prose, then the takeaway', async () => {
    const html = chapterHtml(await render({ chapters: [asChapter(chapter())] }), 'chapter-a');
    expect(html).toMatch(/^<section class="story-chapter" id="chapter-a" aria-labelledby="chapter-a-title">/);
    const at = (s: string) => html.indexOf(s);
    const parts = ['<h2 id="chapter-a-title">', '<p class="story-when"><time datetime="2026-03">March 2026</time></p>', '<p>', '<div class="story-takeaway">', '<h3 id="chapter-a-learned">What I learned</h3>'];
    for (const part of parts) expect(at(part), part).toBeGreaterThan(-1);
    expect(parts.map(at)).toEqual(parts.map(at).toSorted((a, b) => a - b));
    expect(html).toContain(`<h3 id="chapter-a-learned">What I learned</h3><p>${chapter().takeaway}</p></div>`);
  });

  it('renders an inline figure, then a space, then its source in brackets (owner decision 1)', async () => {
    const html = await render({ chapters: [asChapter(FIGURES)] });
    expect(html).toContain('<span class="story-figure">12.3 kg</span> <span class="story-source">(Garmin Example S1)</span> ');
  });

  it("shows nothing after the owner's own figure", async () => {
    const html = await render({ chapters: [asChapter(chapter())] });
    expect(html).toMatch(/<span class="story-figure">12\.3 kg<\/span> [A-Za-z]/);
    expect(html).not.toContain('story-source');
  });

  it('sets a lone figure apart, after the paragraph before it, with its label, date and source', async () => {
    const html = await render({ chapters: [asChapter(FIGURES)] });
    expect(html).toMatch(/<\/p><p class="story-figure-block">VO2 max, 15 May 2026: <strong>11<\/strong> <span class="story-source">\(Garmin\)<\/span><\/p><p>/);
  });

  it('puts nothing figure-like before the first prose (US1.2)', async () => {
    const html = main(await render({ chapters: [asChapter(FIGURES)] }));
    const firstProse = html.indexOf('<p>');
    expect(firstProse).toBeGreaterThan(-1);
    for (const marker of ['story-figure', '<strong', '<svg', 'role="meter"', '<progress', '<figure']) {
      const at = html.indexOf(marker);
      if (at !== -1) expect(at, marker).toBeGreaterThan(firstProse);
    }
  });

  it('carries the chapter id on its links, so check-links names the chapter (FR-015)', async () => {
    const html = await render({ chapters: [asChapter(chapter())] });
    expect(html).toMatch(/<a href="\/running\/" data-chapter-link="chapter-a">[A-Za-z ]+<\/a>/);
  });

  it('renders no empty wrapper for figures or photos, and nothing in the reserved video place (US1.4, FR-053)', async () => {
    const html = chapterHtml(await render({ chapters: [asChapter(chapter('chapter-a', { figures: undefined, prose: `${lorem(30, 9)}.\n` }))] }), 'chapter-a');
    expect(html).toMatch(/<\/time><\/p><p>[^<]*<\/p><div class="story-takeaway">/);
    expect(html).not.toMatch(/<figure|<video|<!--/);
  });
});

// Photos (T068; FR-060, FR-063, FR-064, research.md R10): the generated gradients of the `photos`
// preview, under made-up names, so astro:assets has real files to size.
describe('a chapter with photos (US5)', () => {
  const generated = Object.values(import.meta.glob<ImageMetadata>('/tests/fixtures/story-preview/data/photos/**/*.jpg', { eager: true, import: 'default' }));
  const landscape = generated.find((image) => image.width > image.height)!;
  const portrait = generated.find((image) => image.height > image.width)!;
  const FOLDER = '/made-up/chapters';
  const files: PhotoFiles = { [`${FOLDER}/chapter-a/one.jpg`]: landscape, [`${FOLDER}/chapter-a/two.jpg`]: portrait, [`${FOLDER}/chapter-a/three.jpg`]: landscape };
  const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const listed = [
    { file: 'one.jpg', description: `${lorem(100, 6)} <b>bold</b> & co`, caption: `${lorem(101, 4)} <i>x</i> & y.` },
    { file: 'two.jpg', description: `${lorem(102, 6)}.`, caption: `${lorem(103, 4)}.` },
    { file: 'three.jpg', description: `${lorem(104, 6)}.`, caption: `${lorem(105, 4)}.` },
  ];

  async function renderPhotos(photos: Value[], photoFiles: PhotoFiles = files): Promise<string> {
    // The fake store hands over what it's given: the loader checks hashes, and its tests cover photos.
    const unhashed = (value: Value) => ({ ...value, approved: { date: '2026-11-01', sha256: '0'.repeat(64) } }) as unknown as JourneyChapter;
    const from = store({ note: NOTE, page: PAGE, chapters: [unhashed(chapter('chapter-a', { photos })), asChapter(chapter('chapter-b', { when: '2026-04' }))] });
    setRunningStore(from);
    const view = (await loadJourney(from))!;
    const html = await container.renderToString(StoryPage, {
      props: { journey: view, image: '/og/running-story.png', photoFiles, photoFolder: FOLDER },
      request: new Request('https://alexanderwebber.com/running/story/'),
    });
    return html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
  }

  it('renders each photo as a <figure> with its alt text and a visible caption, after the prose and before the takeaway', async () => {
    const html = chapterHtml(await renderPhotos(listed), 'chapter-a');
    const figures = [...html.matchAll(/<figure class="([^"]+)">([\s\S]*?)<\/figure>/g)];
    expect(figures.map((f) => f[1])).toEqual(['story-photo', 'story-photo story-photo-portrait', 'story-photo']);
    for (const [i, [, , inner]] of figures.entries()) {
      // Attribute values may hold < and > (Astro escapes only & and "), so tags are matched attribute by attribute.
      const tag = (start: string) => `<${start}(?:[^>"]|"[^"]*")*>`;
      expect(inner).toMatch(new RegExp(`^<picture>${tag('source (?:[^>"]|"[^"]*")*type="image/avif"')}${tag('source (?:[^>"]|"[^"]*")*type="image/webp"')}${tag('img ')}</picture><figcaption>`));
      const img = new RegExp(tag('img ')).exec(inner!)![0];
      expect(img).toMatch(/ loading="lazy"/);
      expect(img).toMatch(/ width="\d+"/);
      expect(img).toMatch(/ height="\d+"/);
      // 640 and 1280 px wide (FR-064).
      expect(inner).toMatch(/srcset="[^"]*640w[^"]*1280w/);
      expect(img).toMatch(/ alt="[^"]+"/);
      expect(inner).toContain(`<figcaption>${escape(listed[i]!.caption)}</figcaption>`);
    }
    // In place: the last paragraph, the photos, then the takeaway.
    expect(html).toMatch(/<\/p><figure class="story-photo">[\s\S]*<\/figure><div class="story-takeaway">/);
  });

  it('gives each photo its own alt text, escaped, never markup', async () => {
    const html = chapterHtml(await renderPhotos(listed), 'chapter-a');
    const alts = [...html.matchAll(/<img [^>]*\balt="([^"]*)"/g)].map((m) => m[1]!.replace(/&(lt|gt|amp|#38|#60|#62);/g, (_, name: string) => ({ lt: '<', gt: '>', amp: '&', '#38': '&', '#60': '<', '#62': '>' })[name]!));
    expect(alts).toEqual(listed.map((p) => p.description));
    // Markup in the alt text stays inside its attribute and the caption's is escaped: no element made.
    expect(html.replace(/="[^"]*"/g, '=""')).not.toMatch(/<(b|i)[\s>]/i);
  });

  it('renders a chapter with no photos with no frame, heading or gap (FR-060)', async () => {
    const html = chapterHtml(await renderPhotos(listed), 'chapter-b');
    expect(html).not.toMatch(/<figure|<picture|<img/);
    expect(html).toMatch(/<\/p><div class="story-takeaway">/);
  });

  it('leaves out a listed photo whose file is missing (validate-data reports it), and renders the rest', async () => {
    const html = chapterHtml(await renderPhotos(listed, { [`${FOLDER}/chapter-a/one.jpg`]: landscape }), 'chapter-a');
    expect(html.match(/<figure /g)).toHaveLength(1);
    expect(html).toContain(`<figcaption>${escape(listed[0]!.caption)}</figcaption>`);
  });
});

describe('the text is exactly as approved (US2)', () => {
  it('escapes markup and ampersands in the text, never rendering them', async () => {
    const view = (await (async () => {
      const from = store({ note: NOTE, page: PAGE, chapters: [asChapter(chapter())] });
      setRunningStore(from);
      return loadJourney(from);
    })())!;
    const tricky: JourneyView = {
      ...view,
      chapters: [{ ...view.chapters[0]!, paragraphs: [{ kind: 'text', parts: ['Lorem <b>ipsum</b> & dolor'] }], takeaway: 'Sit <i>amet</i> & co' }],
      note: 'Note <script>x</script> & more',
    };
    const html = main(await renderView(tricky));
    expect(html).toContain('<p>Lorem &lt;b&gt;ipsum&lt;/b&gt; &amp; dolor</p>');
    expect(html).toContain('<p>Sit &lt;i&gt;amet&lt;/i&gt; &amp; co</p>');
    expect(html).toContain('<p class="story-note">Note &lt;script&gt;x&lt;/script&gt; &amp; more</p>');
    expect(html).not.toMatch(/<(b|i|script)[\s>]/i);
  });
});

describe('the page (FR-002, FR-005, FR-007, FR-008, FR-071)', () => {
  it('has one h1, an h2 per chapter and for the closing section, and an h3 per takeaway', async () => {
    const html = await render({ chapters: [asChapter(chapter()), asChapter(FIGURES)], closing: CLOSING });
    expect(count(html, /<h1[\s>]/)).toBe(1);
    expect(html).toMatch(new RegExp(`<h1>${PAGE.title}</h1>`));
    expect(count(main(html), /<h2[\s>]/)).toBe(3);
    expect(count(main(html), /<h3[\s>]/)).toBe(2);
    expect(html).toContain(`<section class="story-closing" aria-labelledby="story-closing-title"><h2 id="story-closing-title">${CLOSING.heading}</h2>`);
  });

  it('puts chapters oldest first, then the closing section, then the note once', async () => {
    const html = main(await render({ chapters: [asChapter(FIGURES), asChapter(chapter())], closing: CLOSING }));
    const at = (s: string) => html.indexOf(s);
    expect(at('id="chapter-a"')).toBeLessThan(at('id="chapter-b"'));
    expect(at('id="chapter-b"')).toBeLessThan(at('class="story-closing"'));
    expect(html).toMatch(/<\/section><p class="story-note">[^<]+<\/p><\/div>/);
    expect(count(html, /class="story-note"/)).toBe(1);
  });

  it('takes links in the closing section, with no chapter id', async () => {
    const html = await render({ chapters: [asChapter(chapter())], closing: CLOSING });
    expect(html).toMatch(/<a href="\/running\/goals\/">[a-z ]+<\/a>/);
  });

  it('with no closing section, puts the note straight after the last chapter (FR-007)', async () => {
    const html = main(await render({ chapters: [asChapter(chapter())] }));
    expect(html).not.toContain('story-closing');
    expect(html).toMatch(/<\/div><\/section><p class="story-note">/);
  });

  it('leads with the h1 and the first chapter: no "Last updated", no Garmin line, no script', async () => {
    const html = await render({ chapters: [asChapter(FIGURES)] });
    expect(main(html)).toMatch(/<\/h1><\/header><div class="story-page"><section class="story-chapter"/);
    expect(html).not.toMatch(/data-last-updated|Last updated|data-garmin-attribution/);
    // The menu's inline script (the current page's link scrolled into view) is the only one.
    expect(html.match(/<script\b[^>]*>/gi)).toEqual(['<script data-nav-scroll>']);
    expect(html).toContain('<title>' + PAGE.title + ' · Running · Alexander Webber</title>');
    expect(html).toContain(`<meta name="description" content="${PAGE.description}">`);
  });

  it('with one chapter, shows no list, numbering, "coming soon" or placeholder (US1.7)', async () => {
    const html = main(await render({ chapters: [asChapter(chapter())] }));
    expect(html).not.toMatch(/<details|<ol|<ul|Chapters|Chapter 1|coming soon|placeholder|\{\{/i);
  });

  it('has no Donate, fundraising card, chart or progress bar anywhere (FR-002)', async () => {
    const html = main(await render({ chapters: [asChapter(chapter()), asChapter(FIGURES)], closing: CLOSING }));
    expect(html).not.toMatch(/Donate|fundraising-card|<svg|chart|role="meter"|<progress/i);
  });
});

describe('the chapter list and "Back to chapters" (FR-052, SC-010, research.md R7)', () => {
  /** `count` made-up chapters, a month apart, given newest first so the page must sort them. */
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) => asChapter(chapter(`chapter-${String.fromCharCode(97 + i)}`, { name: lorem(60 + i, 2 + (i % 3)), when: `2025-${String(12 - i).padStart(2, '0')}` })));
  const list = (html: string) => /<details class="story-chapters">[\s\S]*?<\/details>/.exec(html)?.[0];

  it('shows from four chapters on, a named constant', () => {
    expect(CHAPTER_LIST_AT).toBe(4);
    expect(showChapterList({ chapters: new Array(3) })).toBe(false);
    expect(showChapterList({ chapters: new Array(4) })).toBe(true);
  });

  it('shows no list and no back links at three chapters', async () => {
    const html = main(await render({ chapters: many(3) }));
    expect(html).not.toMatch(/<details|<ul|story-chapter-list|Back to chapters|>Chapters</);
  });

  it('at four, puts a closed "Chapters" list between the h1 and the first chapter, names in chapter order, unnumbered', async () => {
    const chapters = many(4);
    const html = main(await render({ chapters }));
    const details = list(html)!;
    expect(details).toBeDefined();
    // Closed by default: no `open` attribute.
    expect(details).toMatch(/^<details class="story-chapters"><summary>Chapters<\/summary><ul id="story-chapter-list">/);
    expect(html).toMatch(/<\/h1><\/header><div class="story-page"><details class="story-chapters">/);
    expect(html).toMatch(/<\/details><section class="story-chapter"/);
    expect(details).not.toMatch(/<ol|\d/);
    const links = [...details.matchAll(/<li><a href="#([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => [m[1], m[2]]);
    const shown = [...html.matchAll(/<section class="story-chapter" id="([^"]+)"/g)].map((m) => m[1]);
    expect(shown).toEqual(['chapter-d', 'chapter-c', 'chapter-b', 'chapter-a']);
    expect(links).toEqual(shown.map((id) => [id, chapters.find((c) => c.id === id)!.name]));
    expect(count(html, /<details/)).toBe(1);
  });

  it('every list link and back link has its target on the page', async () => {
    const html = main(await render({ chapters: many(12), closing: CLOSING }));
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const targets = [...html.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]!);
    expect(targets).toHaveLength(12 + 12);
    for (const target of targets) expect(ids.has(target), target).toBe(true);
  });

  it('ends each chapter with "Back to chapters" after its takeaway, and nothing else gains one', async () => {
    const html = main(await render({ chapters: many(4), closing: CLOSING }));
    expect(count(html, /<p class="story-back"><a href="#story-chapter-list">Back to chapters<\/a><\/p><\/section>/)).toBe(4);
    for (const id of ['chapter-a', 'chapter-b', 'chapter-c', 'chapter-d']) expect(chapterHtml(html, id)).toMatch(/<\/div><p class="story-back">/);
    expect(count(html, /Back to chapters/)).toBe(4);
    expect(/<section class="story-closing"[\s\S]*?<\/section>/.exec(html)![0]).not.toContain('story-back');
  });

  it('leaves the text the story-text helper reads unchanged', async () => {
    const chapters = many(4);
    const text = storyText(await render({ chapters }));
    expect(text.chapters.map((c) => c.takeaway)).toEqual(text.chapters.map((c) => chapters.find((x) => x.id === c.id)!.takeaway));
    expect(text.chapters.every((c) => c.paragraphs.every((p) => !p.includes('Back to chapters')))).toBe(true);
  });
});

describe('loadJourney (FR-042, FR-008, FR-039, FR-035)', () => {
  const SENTINEL = 'zzsentinelzz';

  it('is undefined until a chapter exists, whatever else is there', async () => {
    expect(await loadJourney(store({}))).toBeUndefined();
    expect(await loadJourney(store({ note: NOTE, page: PAGE, closing: CLOSING }))).toBeUndefined();
  });

  it('refuses chapters without the note or the page wording, naming the file and quoting no text', async () => {
    const chapters = [asChapter(chapter('chapter-a', { name: SENTINEL, takeaway: `${SENTINEL}.` }))];
    for (const [journey, file] of [
      [{ chapters, page: PAGE }, 'data/running/owner/journey/note.yaml'],
      [{ chapters, note: NOTE }, 'data/running/owner/journey/page.yaml'],
    ] as const) {
      const error = await loadJourney(store(journey)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DataValidationError);
      expect((error as DataValidationError).file).toBe(file);
      expect((error as DataValidationError).message).not.toContain(SENTINEL);
    }
  });

  it('refuses a placeholder naming no figure, or stray markup, naming the chapter and quoting no text', async () => {
    const bad = asChapter(chapter('chapter-a', { prose: `${SENTINEL} {{nope}} ${SENTINEL}.\n\n${SENTINEL} <b>${SENTINEL}</b>.\n` }));
    const error = (await loadJourney(store({ chapters: [bad], note: NOTE, page: PAGE })).catch((e: unknown) => e)) as DataValidationError;
    expect(error).toBeInstanceOf(DataValidationError);
    expect(error.issues.map((i) => [i.file, i.entry, i.field])).toEqual([
      ['data/running/owner/journey/chapters/chapter-a/chapter.yaml', 'chapter "chapter-a"', 'prose, paragraph 2'],
      ['data/running/owner/journey/chapters/chapter-a/chapter.yaml', 'chapter "chapter-a"', 'prose'],
    ]);
    expect(error.message).not.toContain(SENTINEL);
  });

  it('gives each chapter its date parts and figures by id, oldest first', async () => {
    const view = (await loadJourney(store({ chapters: [asChapter(FIGURES), asChapter(chapter())], note: NOTE, page: PAGE })))!;
    expect(view.chapters.map((c) => c.id)).toEqual(['chapter-a', 'chapter-b']);
    expect(view.chapters[1]!.when).toEqual([{ text: '15 May 2026', datetime: '2026-05-15' }]);
    expect(view.chapters[1]!.figures['fig-a']).toEqual({ id: 'fig-a', label: lorem(24, 1), asOf: 'May 2026', text: '12.3 kg', source: 'Garmin Example S1' });
    expect(view.chapters[0]!.figures['fig-a']).not.toHaveProperty('source');
    expect(view.note).toBe(NOTE.text);
    expect(view.closing).toBeUndefined();
  });
});

describe('the story-text helper (T034) over the rendered page', () => {
  it('reads each chapter in reading order, figures and sources included, then the closing section and note', async () => {
    const html = await render({ chapters: [asChapter(FIGURES)], closing: CLOSING });
    const text = storyText(html);
    expect(text.chapters).toHaveLength(1);
    const [only] = text.chapters;
    expect(only!.id).toBe('chapter-b');
    expect(only!.name).toBe(FIGURES.name);
    expect(only!.when).toBe('15 May 2026');
    expect(only!.paragraphs).toEqual([
      `${lorem(21, 7)} 12.3 kg (Garmin Example S1) ${lorem(22, 4).toLowerCase()}.`,
      'VO2 max, 15 May 2026: 11 (Garmin)',
      `${lorem(23, 6)}.`,
    ]);
    expect(only!.takeaway).toBe(FIGURES.takeaway);
    expect(text.closing?.heading).toBe(CLOSING.heading);
    expect(text.closing?.paragraphs).toHaveLength(1);
    expect(text.note).toBe(NOTE.text);
  });

  it('keeps a missing space missing, and decodes what Astro escaped', () => {
    expect(plainText('<span class="story-figure">12.3 kg</span><span class="story-source">(Garmin)</span>')).toBe('12.3 kg(Garmin)');
    expect(plainText('a &lt;b&gt; &amp; &#39;c&#x27;\n  d')).toBe("a <b> & 'c' d");
  });
});
