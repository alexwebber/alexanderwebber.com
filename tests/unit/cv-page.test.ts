// The CV page (spec 004 T059; FR-002 to FR-004, FR-010, contracts/routes.md, contracts/content-files.md
// *Compared fields*), rendered with Astro's container API over each preview state's loaded CV and
// over small made-up CVs written for one case each: the blocks in FR-002's order with the pitch
// before the timeline wherever it sits in the file; every anchor once; every in-page link resolving;
// every compared field marked (compare-cv finds no difference); no phone number; the email in words
// and never joined; LinkedIn only when set; noindex only while unlisted; one h1; text escaped; no
// "Last updated"; and the axis's last tick naming as_of's month in words (the page's data date,
// constitution Principle V). Browser checks are in tests/e2e/cv-phone.spec.ts,
// tests/e2e/cv-noscript.spec.ts and tests/a11y/cv.spec.ts. All text is made up.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { compareCv, differenceLine } from '../../scripts/compare-cv.ts';
import CvPage from '../../src/sections/cv/components/CvPage.astro';
import { loadCv, type CvView } from '../../src/sections/cv/data/cv.ts';
import { CvStore, type CvExport } from '../../src/sections/cv/data/store/index.ts';
import { findPhone } from '../../src/sections/cv/domain/phone.ts';
import { PREVIEW_STATES, previewStore, type PreviewState } from '../fixtures/cv-preview/store.ts';
import { smallExport, writeCv } from '../helpers/cv.ts';
import { stripTags } from '../helpers/html.ts';
import { REPO_ROOT, tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://alexanderwebber.com' } });
});

let repo: TempRepo | undefined;
afterEach(() => {
  repo?.cleanup();
  repo = undefined;
});

async function render(cv: CvView): Promise<string> {
  const html = await container.renderToString(CvPage, { props: { cv }, request: new Request('https://alexanderwebber.com/cv/') });
  return html.replace(/ data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '');
}

const exportOf = (state: PreviewState) => JSON.parse(readFileSync(join(REPO_ROOT, 'tests/fixtures/cv-export', state, 'export.json'), 'utf8')) as CvExport;
/** The export without its downloads, which come in slice 5. */
const withoutDownloads = (exp: CvExport): CvExport => ({ ...exp, downloads: [] });

/** A small made-up CV written with real approvals, after `plant` edits its export. */
function small(plant: (exp: CvExport) => void = () => {}): { cv: CvView; exp: CvExport } {
  const exp = smallExport();
  plant(exp);
  repo = tempRepo();
  writeCv(repo.root, exp);
  return { cv: loadCv(new CvStore(repo.root, REPO_ROOT))!, exp };
}

const ids = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
/** The page's text, tags dropped, scripts and styles out (the shared scanner: a regex trips CodeQL). */
const text = (html: string) => stripTags(html);

describe.each(PREVIEW_STATES)('the %s preview', (state) => {
  let html: string;
  let cv: CvView;
  beforeAll(async () => {
    cv = loadCv(previewStore(state))!;
    html = await render(cv);
  });

  it("marks every compared field: compare-cv finds no difference with the export (downloads aside, slice 5)", () => {
    expect(compareCv(html, withoutDownloads(exportOf(state))).map(differenceLine)).toEqual([]);
  });

  it('has every anchor of contracts/routes.md exactly once', () => {
    const { timeline } = cv;
    const expected = [
      'cv',
      ...timeline.themes.map((t) => `theme-${t.theme.id}`),
      ...(timeline.roles.length > 0 ? ['roles'] : []),
      ...(timeline.threads.length > 0 ? ['threads'] : []),
      ...timeline.threads.map((t) => `thread-${t.thread.id}`),
      ...(timeline.next.length > 0 ? ['next'] : []),
      ...timeline.changes.map((c) => `change-${c.id}`),
      ...timeline.roles.map((r) => `role-${r.id}`),
      ...timeline.next.map((n) => `next-${n.id}`),
      ...cv.blocks.flatMap((b) => b.stories ?? []).map((s) => `value-${s.id}`),
    ];
    const all = ids(html);
    for (const id of expected) expect(all.filter((x) => x === id), id).toHaveLength(1);
    expect(new Set(all).size, 'every id on the page is unique').toBe(all.length);
  });

  it('resolves every in-page link to an id on the page, and writes no -in- address as an href', () => {
    const all = new Set(ids(html));
    const hrefs = [...html.matchAll(/\shref="#([^"]*)"/g)].map((m) => decodeURIComponent(m[1]!));
    expect(hrefs.length).toBeGreaterThan(3);
    for (const href of hrefs) expect(all.has(href), `#${href}`).toBe(true);
    expect(html).not.toMatch(/\shref="#change-[^"]*-in-/);
  });

  it('puts the blocks in order: header, pitch, timeline, the other blocks in file order, contact', () => {
    const at = (pattern: string) => html.indexOf(pattern);
    const order = [at('<header class="cv-header"'), at(`data-cv-item="block:${cv.pitch.id}"`), at('<section id="cv"'), ...cv.blocks.map((b) => at(`data-cv-item="block:${b.id}"`)), at('class="cv-block cv-contact"')];
    for (const i of order) expect(i).toBeGreaterThan(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('has no phone number, and the email only in words and parts, never joined', () => {
    // The whole page, markup included, as scan-privacy reads it (an SVG path once read as a number).
    expect(findPhone(html)).toEqual([]);
    expect(findPhone(text(html))).toEqual([]);
    expect(html).not.toMatch(/tel:/);
    const { email_user: user, email_domain: domain } = cv.page;
    expect(html).not.toContain(`${user}@${domain}`);
    expect(html).not.toContain(`${user}&#64;${domain}`);
    expect(html).not.toContain('mailto:');
    expect(html).toContain(`>${user} at ${domain}<`);
    expect(html).toContain(`data-user="${user}" data-domain="${domain}"`);
  });

  it('links LinkedIn only when the page has it', () => {
    if (cv.page.linkedin) expect(count(html, /data-cv-field="linkedin"/)).toBe(1);
    else expect(html).not.toMatch(/linkedin/i);
  });

  it('carries noindex exactly while unlisted', () => {
    expect(count(html, /<meta name="robots" content="noindex">/)).toBe(cv.page.listed ? 0 : 1);
  });

  it('has one h1, the name', () => {
    expect(count(html, /<h1\b/)).toBe(1);
    expect(html).toMatch(new RegExp(`<h1 class="cv-name" data-cv-field="name">${cv.page.name}</h1>`));
  });

  it('says "Last updated" nowhere (owner decision 7)', () => {
    expect(text(html)).not.toMatch(/last updated/i);
  });

  it("ends the overview's axis with as_of's month in words: the page's data date", () => {
    const overview = /<div class="cv-level cv-overview"[\s\S]*?<\/p>/.exec(html)![0];
    const [year, month] = cv.page.as_of.split('-');
    const words = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month) - 1]} ${year}`;
    const last = /<span class="cv-tick cv-tick-last"[^>]*>([\s\S]*?)<\/span>\s*<\/p>/.exec(overview)![1]!;
    expect(last).toContain(`<time datetime="${cv.page.as_of}">${words}</time>`);
  });

  it('loads the fonts with Space Grotesk the one preloaded', () => {
    expect(count(html, /<link rel="preload"[^>]* as="font"/)).toBe(1);
    expect(html).toMatch(/--font-cv-display:/);
    expect(html).toMatch(/--font-cv-text:/);
  });
});

describe('the page over small made-up CVs', () => {
  it('puts the pitch before the timeline wherever it sits in the file', async () => {
    const { cv, exp } = small((e) => e.blocks.push(e.blocks.shift()!));
    expect(exp.blocks.at(-1)!.kind).toBe('pitch');
    const html = await render(cv);
    expect(html.indexOf(`data-cv-item="block:${cv.pitch.id}"`)).toBeLessThan(html.indexOf('<section id="cv"'));
    expect(compareCv(html, withoutDownloads(exp)).map(differenceLine)).toEqual([]);
  });

  it('escapes markup and ampersands in approved text', async () => {
    const { cv } = small((e) => {
      e.timeline.changes[0]!.card = 'A made-up card with <b>bold</b> & an ampersand.';
    });
    const html = await render(cv);
    expect(html).toContain('A made-up card with &lt;b&gt;bold&lt;/b&gt; &amp; an ampersand.');
    expect(html).not.toContain('<b>bold</b>');
  });

  it('has no LinkedIn link and no noindex when the page has no LinkedIn and is listed', async () => {
    const { cv } = small((e) => {
      delete (e.page as { linkedin?: string }).linkedin;
      e.page.listed = true;
    });
    const html = await render(cv);
    expect(html).not.toMatch(/linkedin/i);
    expect(html).not.toMatch(/name="robots"/);
  });
});
