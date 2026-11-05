// The journey story page (spec 003 T036; US1, US2, FR-002 to FR-008, FR-010, FR-011, FR-014, FR-053,
// FR-071), rendered with Astro's container API over the data loader and made-up journeys: a
// chapter's parts in order, inline and set-apart figures with their sources, escaped text, links,
// the heading outline, and what the page never shows. Also loadJourney's own contract (FR-042, and
// its refusals naming no text). Browser checks (layout, widths, no JavaScript, axe) are in
// tests/e2e/story.spec.ts and tests/a11y/story.spec.ts. All text here is made up.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import StoryPage from '../../src/sections/running/components/StoryPage.astro';
import { loadJourney, type JourneyView } from '../../src/sections/running/data/journey.ts';
import { setRunningStore } from '../../src/sections/running/data/load.ts';
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
    expect(html).not.toMatch(/<b>|<i>|<script>/);
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
    expect(html).not.toContain('<script');
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
