// The journey story page in a real browser (spec 003 T037, T039; US1, US2, SC-001, SC-003, FR-002 to
// FR-008, FR-010, FR-011, FR-014, FR-071, FR-072; quickstart.md §3), and the chapter list at four or
// more chapters (T058; US4, FR-052, SC-010, research.md R7), over the test-only previews
// (SHELL_PREVIEW=1, tests/fixtures/story-preview/): made-up chapters through the real StoryPage. Every
// expectation comes from the preview's own files, never a pinned list. The real page arrives in
// Phase 3 and its words in Phase 7.
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { journeyChapterIds } from '../../src/sections/running/data/store/files.ts';
import { parseProse, parseWhen } from '../../src/sections/running/domain/journey.ts';
import { PREVIEW_STATES as STATES, type PreviewState as State } from '../fixtures/story-preview/store.ts';
import { approvedText, inlineFigure as inline, readJourney, storyText, type JourneyFiles } from '../helpers/story-text.ts';

/** The chapter list and back links show from four chapters on (FR-052): long, figures and four-chapters. */
const LIST_AT = 4;
const REPO = resolve(import.meta.dirname, '../..');
const FIXTURES = resolve(import.meta.dirname, '../fixtures/story-preview/data');

/** A state's approved files, as the preview's generate.ts wrote them. */
const fixture = (state: State): JourneyFiles => readJourney(join(FIXTURES, state));
const expected = approvedText;

async function open(page: Page, state: State) {
  const response = await page.goto(`/story-preview/${state}/`);
  expect(response?.status(), state).toBe(200);
  return response!;
}

const story = (page: Page) => page.locator('.story-page');
const chapters = (page: Page) => story(page).locator('section.story-chapter');
const chapterIds = (page: Page) => chapters(page).evaluateAll((els) => els.map((el) => el.id));
const chapterList = (page: Page) => story(page).locator('details.story-chapters');

for (const state of STATES) {
  const data = fixture(state);
  const listed = data.chapters.length >= LIST_AT;

  test(`${state}: chapters are oldest first, each with its parts in order (US1.1, FR-002)`, async ({ page }) => {
    await open(page, state);
    const ids = await chapterIds(page);
    expect(ids.toSorted()).toEqual(data.chapters.map((c) => c.id).toSorted());
    // Each chapter starts no earlier than the one before it, and a tie goes by `order`.
    const byId = new Map(data.chapters.map((c) => [c.id, c]));
    for (let i = 1; i < ids.length; i++) {
      const [a, b] = [byId.get(ids[i - 1]!)!, byId.get(ids[i]!)!];
      const [startA, startB] = [parseWhen(a.when)!.start, parseWhen(b.when)!.start];
      expect(startA <= startB, `${a.id} before ${b.id}`).toBe(true);
      if (startA === startB) expect(a.order!).toBeLessThan(b.order!);
    }
    for (const id of ids) {
      const parts = await story(page)
        .locator(`section#${id}`)
        .evaluate((el) => [...el.children].map((child) => `${child.tagName.toLowerCase()}${child.className ? `.${child.className}` : ''}`));
      expect(parts[0], id).toBe('h2');
      expect(parts[1], id).toBe('p.story-when');
      // "Back to chapters" closes each chapter when the list shows (FR-052).
      if (listed) expect(parts.pop(), id).toBe('p.story-back');
      expect(parts.at(-1), id).toBe('div.story-takeaway');
      expect(parts.slice(2, -1).every((p) => p === 'p' || p === 'p.story-figure-block'), id).toBe(true);
      expect(parts[2], `${id} opens with prose`).toBe('p');
      await expect(story(page).locator(`section#${id} .story-takeaway`).getByRole('heading', { level: 3, name: 'What I learned', exact: true })).toBeVisible();
    }
  });

  test(`${state}: every word is exactly as approved (US2.2, SC-003)`, async ({ page }) => {
    const response = await open(page, state);
    const shown = storyText(await response.text());
    expect(shown).toEqual(expected(data, await chapterIds(page)));
    // And as a browser lays it out: no two inline parts run together.
    for (const chapter of shown.chapters) {
      const rendered = await story(page).locator(`section#${chapter.id} > p:not(.story-when, .story-back)`).allInnerTexts();
      expect(rendered.map((text) => text.replace(/\s+/g, ' ').trim())).toEqual(chapter.paragraphs);
    }
  });

  test(`${state}: the menu is the real Running menu, with "Story" only once the real data has a chapter`, async ({ page }) => {
    await open(page, state);
    // A preview never adds the item: it follows the repo's own chapters (none until spec 003's content PR).
    const item = page.getByRole('navigation', { name: 'Running', exact: true }).getByRole('link', { name: 'Story', exact: true });
    await expect(item).toHaveCount(journeyChapterIds(REPO).length > 0 ? 1 : 0);
  });

  test(`${state}: the takeaway is a box with a heavier start edge, kept in forced colours (FR-004)`, async ({ page }) => {
    for (const forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors });
      await open(page, state);
      const box = story(page).locator('.story-takeaway').first();
      for (const side of ['top', 'right', 'bottom', 'left']) await expect(box, `${side}, forced colours ${forcedColors}`).not.toHaveCSS(`border-${side}-style`, 'none');
      const [start, top] = await box.evaluate((el) => [parseFloat(getComputedStyle(el).borderLeftWidth), parseFloat(getComputedStyle(el).borderTopWidth)]);
      expect(start).toBeGreaterThan(top!);
      await expect(box.getByRole('heading', { level: 3, name: 'What I learned', exact: true })).toBeVisible();
    }
  });

  test(`${state}: paragraphs are at most 75 times the width of "0" in their font (FR-072)`, async ({ page }) => {
    await open(page, state);
    const widths = await story(page)
      .locator('p')
      .evaluateAll((els) =>
        els.map((el) => {
          const zero = document.createElement('span');
          zero.textContent = '0';
          el.append(zero);
          const ch = zero.getBoundingClientRect().width;
          zero.remove();
          return { ratio: el.getBoundingClientRect().width / ch };
        }),
      );
    expect(widths.length).toBeGreaterThan(0);
    for (const { ratio } of widths) expect(ratio).toBeLessThanOrEqual(75);
  });

  for (const width of [320, 360]) {
    test(`${state}: nothing scrolls sideways at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, state);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  }

  test.describe(`${state}, with JavaScript off`, () => {
    test.use({ javaScriptEnabled: false });

    test('shows the same text, and the page has no script (FR-071)', async ({ page, browser, baseURL }) => {
      await open(page, state);
      const withoutJs = await story(page).innerText();
      // The menu's inline script (scrolling the current page's link into view) is the only one.
      expect(await page.locator('script:not([data-nav-scroll])').count()).toBe(0);
      expect(await page.locator('script[src]').count()).toBe(0);
      const context = await browser.newContext({ baseURL: baseURL! });
      const withJs = await context.newPage();
      await withJs.goto(`/story-preview/${state}/`);
      expect(await story(withJs).innerText()).toBe(withoutJs);
      await context.close();
    });
  });
}

// SC-001: the first screen opens on the story: the first chapter's name and its opening lines, with no
// figure, chart or bar before the first prose.
for (const state of ['one-chapter', 'long', 'four-chapters'] as const) {
  test(`${state}: the first screen shows the first chapter's name and opening lines, and no figure (SC-001)`, async ({ page }) => {
    await open(page, state);
    const viewport = page.viewportSize()!;
    const first = chapters(page).first();
    const name = await first.getByRole('heading', { level: 2 }).boundingBox();
    // The list, where there is one, is closed (FR-052).
    if (state !== 'one-chapter') await expect(chapterList(page)).not.toHaveAttribute('open');
    const prose = await first.locator('> p:not(.story-when)').first().boundingBox();
    expect(name!.y + name!.height).toBeLessThanOrEqual(viewport.height);
    // At least its first two lines.
    const line = await first.locator('> p:not(.story-when)').first().evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(prose!.y + 2 * line).toBeLessThanOrEqual(viewport.height);
    const before = await page.locator('main').evaluate((main) => {
      const firstProse = main.querySelector('.story-chapter > p:not(.story-when)')!;
      return [...main.querySelectorAll('.story-figure, .story-figure-block, svg, figure, canvas, img, progress, [role="meter"], [role="progressbar"]')].filter(
        (el) => el.compareDocumentPosition(firstProse) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).length;
    });
    expect(before).toBe(0);
  });
}

test('figures: an inline figure carries its source in brackets right after it (owner decision 1, FR-014)', async ({ page }) => {
  await open(page, 'figures');
  const data = fixture('figures');
  const inlineFigures = data.chapters.flatMap((c) => (c.figures ?? []).filter((f) => !c.prose.includes(`\n\n{{${f.id}}}\n`) && !c.prose.startsWith(`{{${f.id}}}`)));
  expect(inlineFigures.length).toBeGreaterThan(3);
  for (const figure of inlineFigures) {
    await expect(story(page).locator('p', { hasText: inline(figure) })).toHaveCount(1);
    const after = await story(page)
      .locator('.story-figure', { hasText: figure.text })
      .evaluate((el) => ({ gap: el.nextSibling?.textContent, next: (el.nextSibling?.nextSibling as Element | null)?.className }));
    if (figure.garmin) expect(after).toEqual({ gap: ' ', next: 'story-source' });
    else expect(after.next).not.toBe('story-source');
  }
  // The source reads at the prose's size, in the secondary colour.
  const [source, prose] = [story(page).locator('.story-source').first(), story(page).locator('.story-source').first().locator('xpath=..')];
  expect(await source.evaluate((el) => getComputedStyle(el).fontSize)).toBe(await prose.evaluate((el) => getComputedStyle(el).fontSize));
});

test('figures: a set-apart figure follows its paragraph, smaller than the prose (FR-010, FR-011)', async ({ page }) => {
  await open(page, 'figures');
  const blocks = story(page).locator('.story-figure-block');
  expect(await blocks.count()).toBe(2);
  for (const block of await blocks.all()) {
    const { previous, isFirstProse, size, proseSize } = await block.evaluate((el) => ({
      previous: el.previousElementSibling?.tagName.toLowerCase() + (el.previousElementSibling?.className ? `.${el.previousElementSibling.className}` : ''),
      isFirstProse: el.parentElement!.querySelector(':scope > p:not(.story-when)') === el,
      size: parseFloat(getComputedStyle(el).fontSize),
      proseSize: parseFloat(getComputedStyle(el.previousElementSibling!).fontSize),
    }));
    expect(previous).toBe('p');
    expect(isFirstProse).toBe(false);
    expect(size).toBeLessThan(proseSize);
  }
  await expect(blocks.first()).toHaveText('VO2 max, 15 Jan 2025: 11 (Garmin)');
  await expect(blocks.last()).toHaveText('Race time, 1 Feb 2026: 3:45:12');
});

test('figures: a chapter with no figures reads complete, with no empty space for them (US1.4)', async ({ page }) => {
  await open(page, 'figures');
  const plain = fixture('figures').chapters.find((c) => !c.figures)!;
  const parts = await story(page)
    .locator(`section#${plain.id}`)
    .evaluate((el) => [...el.children].map((child) => child.tagName.toLowerCase() + (child.className ? `.${child.className}` : '')));
  // figures has four chapters, so each ends with "Back to chapters" (FR-052).
  expect(parts).toEqual(['h2', 'p.story-when', ...parseProse(plain.prose).paragraphs.map(() => 'p'), 'div.story-takeaway', 'p.story-back']);
});

test('no-closing: the note follows the latest chapter directly (FR-007)', async ({ page }) => {
  await open(page, 'no-closing');
  await expect(story(page).locator('.story-closing')).toHaveCount(0);
  const previous = await story(page)
    .locator('.story-note')
    .evaluate((el) => el.previousElementSibling?.id);
  expect(previous).toBe((await chapterIds(page)).at(-1));
});

test('three-chapters: the closing section follows the latest chapter, then the note, once (FR-007, FR-008)', async ({ page }) => {
  await open(page, 'three-chapters');
  const order = await story(page).evaluate((el) => [...el.children].map((child) => child.className));
  expect(order).toEqual(['story-chapter', 'story-chapter', 'story-chapter', 'story-closing', 'story-note']);
  await expect(page.getByRole('region', { name: fixture('three-chapters').closing!.heading, exact: true })).toBeVisible();
});

test('same-day: two chapters on one day go by their order (FR-002)', async ({ page }) => {
  await open(page, 'same-day');
  const byOrder = fixture('same-day')
    .chapters.toSorted((a, b) => a.order! - b.order!)
    .map((c) => c.id);
  expect(await chapterIds(page)).toEqual(byOrder);
});

test('each chapter is a region named by its heading, with its ID as its anchor (FR-051)', async ({ page }) => {
  await open(page, 'three-chapters');
  for (const chapter of fixture('three-chapters').chapters) {
    await expect(page.getByRole('region', { name: chapter.name, exact: true })).toHaveAttribute('id', chapter.id);
  }
});

// The chapter list (T058; US4, FR-052, SC-010, research.md R7; owner decision 3): from four chapters
// on, a closed "Chapters" line under the title, two taps to any chapter with scripts off, and "Back to
// chapters" after each chapter. Positions depend on the system font (CI's Linux font is taller), so the
// first-screen checks measure on the page itself rather than against pixel counts.
for (const state of ['four-chapters', 'long'] as const) {
  const data = fixture(state);

  test(`${state}: the list is closed by default, one line under the title, and lists every chapter in page order`, async ({ page }) => {
    await open(page, state);
    const list = chapterList(page);
    await expect(list).toHaveCount(1);
    await expect(list).not.toHaveAttribute('open');
    await expect(list.locator('summary')).toHaveText('Chapters');
    await expect(list.getByRole('list')).toBeHidden();
    // Straight after the title: the list is the story's first part, before the first chapter.
    expect(await story(page).evaluate((el) => el.firstElementChild?.className)).toBe('story-chapters');
    // Unnumbered: a <ul> of names, in the order the chapters show.
    await list.locator('summary').click();
    const names = await list.locator('ul#story-chapter-list > li > a').evaluateAll((els) => els.map((a) => [a.getAttribute('href'), a.textContent]));
    const ids = await chapterIds(page);
    expect(names).toEqual(ids.map((id) => [`#${id}`, data.chapters.find((c) => c.id === id)!.name]));
    await expect(list.locator('ol')).toHaveCount(0);
  });

  test(`${state}: closed, the list takes one line, so only opening it moves the first chapter down (FR-052, SC-001)`, async ({ page }) => {
    await open(page, state);
    const list = chapterList(page);
    const summary = list.locator('summary');
    const heading = chapters(page).first().getByRole('heading', { level: 2 });
    const closed = (await list.boundingBox())!;
    const line = await summary.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    // The closed list is its summary (one line, with its padding) and its two rules, whatever the font.
    expect(closed.height).toBeLessThanOrEqual((await summary.boundingBox())!.height + 2.5);
    expect((await summary.boundingBox())!.height).toBeLessThan(2 * line + 16);
    const closedAt = (await heading.boundingBox())!.y;
    expect(closedAt + (await heading.boundingBox())!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    // Open, the names push the chapter down by the list's own height: a list this long would cost
    // the first screen if it started open.
    await summary.click();
    const opened = (await list.boundingBox())!;
    expect(opened.height).toBeGreaterThanOrEqual(closed.height + data.chapters.length * line);
    expect((await heading.boundingBox())!.y - closedAt).toBeCloseTo(opened.height - closed.height, 0);
  });

  for (const width of [320, 360]) {
    test(`${state}: nothing scrolls sideways at ${width} px with the list open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, state);
      await chapterList(page).locator('summary').click();
      await expect(chapterList(page)).toHaveAttribute('open');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  }

  test.describe(`${state}, with JavaScript off`, () => {
    test.use({ javaScriptEnabled: false });

    test('any chapter is two taps from the top: open the list, tap its name (SC-010)', async ({ page }) => {
      await open(page, state);
      const ids = await chapterIds(page);
      // The first, a middle one and the last.
      for (const id of [...new Set([ids[0]!, ids[Math.floor(ids.length / 2)]!, ids.at(-1)!])]) {
        await open(page, state);
        const name = data.chapters.find((c) => c.id === id)!.name;
        await chapterList(page).locator('summary').click();
        await chapterList(page).getByRole('link', { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect(story(page).locator(`section#${id}`).getByRole('heading', { level: 2, name, exact: true })).toBeInViewport();
      }
    });

    test('"Back to chapters" after each chapter lands on the list or its summary', async ({ page }) => {
      await open(page, state);
      const ids = await chapterIds(page);
      await expect(story(page).locator('.story-back')).toHaveCount(ids.length);
      for (const id of ids) await expect(story(page).locator(`section#${id} > p.story-back`).getByRole('link', { name: 'Back to chapters', exact: true })).toHaveAttribute('href', '#story-chapter-list');
      // From the last chapter, reached directly, so the list starts closed.
      await page.goto(`/story-preview/${state}/#${ids.at(-1)}`);
      await expect(chapterList(page)).not.toHaveAttribute('open');
      await story(page).locator(`section#${ids.at(-1)} .story-back a`).click();
      await expect(page).toHaveURL(/#story-chapter-list$/);
      // Chrome opens the <details> for its target; elsewhere the reader lands on the summary (R7).
      const expanded = await chapterList(page).evaluate((el) => (el as HTMLDetailsElement).open);
      await expect(expanded ? chapterList(page).getByRole('list') : chapterList(page).locator('summary')).toBeInViewport();
    });
  });
}

for (const state of ['one-chapter', 'three-chapters'] as const) {
  test(`${state}: fewer than four chapters, so no list and no "Back to chapters" (FR-052)`, async ({ page }) => {
    await open(page, state);
    await expect(story(page).locator('details')).toHaveCount(0);
    await expect(story(page).locator('#story-chapter-list, .story-back')).toHaveCount(0);
    await expect(story(page).getByText('Back to chapters', { exact: true })).toHaveCount(0);
  });
}
