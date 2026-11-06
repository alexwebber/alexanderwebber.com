// The SC-006 launch drill (spec 003 T049; quickstart.md §5 and §2 step 1, US3, FR-015, FR-040 to
// FR-043): the story as it will first go live, on a scratch copy of the real site
// (tests/helpers/scratch-site.ts) with its real fundraising card. The copy's journey files are
// replaced by one made-up approved chapter (linking to /running/fundraising/), the note and the page
// wording, and section.yaml gets a `story_link` whose made-up label is the page wording's
// `link_label`, so the drill holds once the real story is in (Phase 7). The gate's steps run on it
// (runGate) and a browser opens its dist/ (serveDist). Then:
// - the gate passes: validate-data reports no error, and check-links passes;
// - the chapter renders exactly as written (tests/helpers/story-text.ts);
// - "Story" is last in the menu on every Running page, and current on the story page;
// - on /running/ at 360 x 780 with the fundraising card, Donate is fully on the first screen and the
//   menu has no third line. If either fails, the build stops for the owner's decision (research.md
//   R8): the assertion stays, and nothing in the layout changes to pass it;
// - no Running page scrolls sideways at 320 px;
// - the panel shows the label, and "Story" isn't repeated in the section links below it;
// - the sitemap lists the page, and its share image exists;
// - a chapter link to a page that doesn't exist, re-approved, passes validation and the build, and
//   check-links stops it naming the chapter (FR-015);
// - with every chapter removed, validate-data refuses the story link, and a plain build (which runs
//   only the schema and loader checks) leaves a dead panel link that check-links stops (US3.4).
// The rebuilds come last, as each replaces the dist/ the browser checks use.
//
// DRILL_KEEP_DIST=<dir> copies the launch build's dist/ there, for the PR's screenshots
// (`node scripts/process/screenshots.ts --dist=<dir> ...`, pr-screenshots skill).
import { execFile } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { approveJourney } from '../../scripts/approve-story.ts';
import { checkLinks } from '../../scripts/check-links.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import { chapter, chapterFile, JOURNEY, lorem, page as pageWording, writeStory } from '../helpers/journey.ts';
import { buildSite, builtHtmlFiles, copySite, GATE_STEPS, REPO, runGate, scratchRepo, serveDist, type DistServer, type GateRun } from '../helpers/scratch-site.ts';
import { approvedText, readJourney, storyText } from '../helpers/story-text.ts';

const ID = 'chapter-a';
const LINK_TEXT = lorem(5, 2);
const STORY = '/running/story/';
/** A made-up site path no build makes. */
const DEAD = '/running/lorem-ipsum/';
const WORDING = pageWording();
const SECTION = 'data/running/owner/section.yaml';
const FIRST_SCREEN = { width: 360, height: 780 };

let root: string;
let dist: string;
let gate: GateRun;
let server: DistServer | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  // One build, read as files and opened in a phone-sized context, so it runs in the desktop project.
  test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device');
  testInfo.setTimeout(240_000);
  root = testInfo.outputPath('story-launch-site');
  copySite(root);

  // The story as it will launch, made up: whatever the repo holds is replaced.
  rmSync(join(root, JOURNEY), { recursive: true, force: true });
  writeStory(scratchRepo(root), {
    chapter: chapter(ID, { prose: `${lorem(2, 8)} {{fig-a}} ${lorem(3, 6)}.\n\n${lorem(4, 5)} [${LINK_TEXT}](/running/fundraising/) ${lorem(6, 4)}.\n` }),
  });
  // Approved again as the owner's approval will be, by approve-story's journey mode (quickstart.md §2
  // step 1), so the page below is what that approval publishes.
  for (const target of [ID, 'note', 'page']) approveJourney({ root, target });
  const owner = join(root, 'data/running/owner');
  const section = parse(readFileSync(join(root, SECTION), 'utf8')) as Record<string, unknown> & { focus_race: { race_id: string } };
  section.story_link = { href: STORY, label: WORDING.link_label };
  writeFileSync(join(root, SECTION), stringify(section));

  // The real fundraising card: the focus race's campaign, current, with its published figures.
  const campaignsFile = join(owner, 'campaigns.yaml');
  const campaigns = (parse(readFileSync(campaignsFile, 'utf8')) ?? []) as { id: string; race_id: string; finished?: boolean }[];
  const campaign = campaigns.find((c) => c.race_id === section.focus_race.race_id);
  if (!campaign || !existsSync(join(root, 'data/running/published/fundraising', `${campaign.id}.json`))) {
    throw new Error(`the focus race "${section.focus_race.race_id}" has no campaign with published figures, so there's no fundraising card to drill`);
  }
  delete campaign.finished;
  writeFileSync(campaignsFile, stringify(campaigns));

  gate = await runGate(root);
  if (gate.failed) throw new Error(`the gate stopped at ${gate.failed}:\n${gate.messages.join('\n')}`);
  dist = join(root, 'dist');
  if (process.env.DRILL_KEEP_DIST) {
    const keep = resolve(REPO, process.env.DRILL_KEEP_DIST);
    rmSync(keep, { recursive: true, force: true });
    cpSync(dist, keep, { recursive: true });
  }
  server = await serveDist(dist);
});

test.afterAll(async () => {
  await server?.close();
  if (root) rmSync(root, { recursive: true, force: true });
});

/** Every built page under dist/running/, as site paths. */
const runningPages = () =>
  builtHtmlFiles(dist, 'running')
    .filter((file) => file.endsWith('/index.html'))
    .map((file) => `/${file.slice(0, -'index.html'.length)}`);

/** One page of each type in the copy, the story page included. */
function pageTypes(): string[] {
  const pages = runningPages();
  const first = (prefix: string) => pages.find((p) => p.startsWith(prefix) && p !== prefix);
  return ['/running/', '/running/goals/', '/running/training/', first('/running/training/'), first('/running/runs/'), '/running/races/', first('/running/races/'), '/running/health/', '/running/fundraising/', STORY].filter(
    (p): p is string => p !== undefined && pages.includes(p),
  );
}

/** A page in a phone context as the mobile-360 project sets it up (Pixel 7 at 360 x 780). */
async function phone(browser: Browser, viewport = FIRST_SCREEN): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport });
  return { page: await context.newPage(), close: () => context.close() };
}

async function open(page: Page, path: string) {
  const response = await page.goto(server!.base + path);
  expect(response?.status(), path).toBe(200);
  return response!;
}

const menu = (page: Page) => page.getByRole('navigation', { name: 'Running', exact: true });
/** How many lines the Running menu takes: its items' distinct tops. */
const menuLines = (page: Page) => menu(page).locator('li').evaluateAll((items) => new Set(items.map((li) => Math.round(li.getBoundingClientRect().top))).size);

test('SC-006: the gate passes on the copy: no validation error, and check-links passes', () => {
  expect(gate.ran).toEqual([...GATE_STEPS]);
  expect(validateData(root).map(formatIssue)).toEqual([]);
});

test('US2.2: the chapter renders exactly as written, with the approved page wording', async ({ page }) => {
  const response = await open(page, STORY);
  const shown = storyText(await response.text());
  expect(shown).toEqual(approvedText(readJourney(root), [ID]));
  await expect(page).toHaveTitle(`${WORDING.title} · Running · Alexander Webber`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(String(WORDING.title));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', String(WORDING.description));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://alexanderwebber.com${STORY}`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://alexanderwebber.com/og/running-story.png');
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', String(WORDING.share_text));
  await expect(page.locator(`section#${ID}`).getByRole('link', { name: LINK_TEXT, exact: true })).toHaveAttribute('href', '/running/fundraising/');
});

test('US3.2, US3.5: "Story" is last in the menu on every Running page, and current on the story page', async ({ page }) => {
  const pages = runningPages();
  expect(pages.length).toBeGreaterThan(5);
  expect(pages).toContain(STORY);
  for (const path of pages) {
    const html = readFileSync(join(dist, path, 'index.html'), 'utf8');
    const nav = html.match(/<nav aria-label="Running"[^>]*>[\s\S]*?<\/nav>/)?.[0];
    expect(nav, path).toBeDefined();
    const links = [...nav!.matchAll(/<a href="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links.at(-1), path).toEqual([STORY, 'Story']);
  }
  await open(page, STORY);
  await expect(menu(page).getByRole('link', { name: 'Story', exact: true })).toHaveAttribute('aria-current', 'page');
  await open(page, '/running/');
  await expect(menu(page).getByRole('link', { name: 'Story', exact: true })).not.toHaveAttribute('aria-current');
});

// Research R8 / FR-043: Donate cleared the first screen by 3 px before the story. If this fails, the
// owner decides (the PR stops); don't change the layout or the threshold to pass it.
test('FR-043, SC-006: on a 360 x 780 phone, the menu has no third line and Donate is fully on the first screen', async ({ browser }, testInfo) => {
  const { page, close } = await phone(browser);
  try {
    await open(page, '/running/');
    await page.evaluate(() => document.fonts.ready);
    const lines = await menuLines(page);
    const donate = page.locator('.fundraising-card').getByRole('link', { name: 'Donate on JustGiving', exact: true });
    await expect(donate).toBeVisible();
    const box = (await donate.boundingBox())!;
    const measured = `menu lines at 360 px: ${lines}; Donate from ${box.y.toFixed(1)} to ${(box.y + box.height).toFixed(1)} px of ${FIRST_SCREEN.height}`;
    testInfo.annotations.push({ type: 'measured', description: measured });
    console.log(`story-launch: ${measured}`);
    expect(lines, 'the menu wraps to a third line: stop and ask the owner (research.md R8)').toBeLessThanOrEqual(2);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'Donate leaves the first screen: stop and ask the owner (research.md R8)').toBeLessThanOrEqual(FIRST_SCREEN.height);
  } finally {
    await close();
  }
});

test('FR-043, SC-006: no Running page scrolls sideways at 320 px', async ({ browser }, testInfo) => {
  const { page, close } = await phone(browser, { width: 320, height: 800 });
  try {
    for (const path of pageTypes()) {
      await open(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBe(0);
      if (path === '/running/') {
        const measured = `menu lines at 320 px: ${await menuLines(page)}`;
        testInfo.annotations.push({ type: 'measured', description: measured });
        console.log(`story-launch: ${measured}`);
      }
    }
  } finally {
    await close();
  }
});

test('US3.2: the panel shows the label, and "Story" isn\'t repeated in the section links below it', async ({ page }) => {
  await open(page, '/running/');
  const panel = page.locator('[data-story-link]');
  await expect(panel.getByRole('link', { name: String(WORDING.link_label), exact: true })).toHaveAttribute('href', STORY);
  const links = page.locator('[data-section-links]');
  await expect(links.getByRole('link')).not.toHaveCount(0);
  await expect(links.locator(`a[href="${STORY}"]`)).toHaveCount(0);
});

test('FR-075: the sitemap lists the page, and its share image exists', async ({ request }) => {
  const xml = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
  expect(xml).toContain(`https://alexanderwebber.com${STORY}`);
  const png = await request.get(`${server!.base}/og/running-story.png`);
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toBe('image/png');
  const bytes = await png.body();
  // PNG signature, then the IHDR chunk's width and height.
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('FR-015: a re-approved chapter linking to a page that doesn\'t exist passes validation and the build, and check-links names the chapter', async ({}, testInfo) => {
  testInfo.setTimeout(240_000);
  await server?.close();
  server = undefined;
  const file = join(root, chapterFile(ID));
  writeFileSync(file, readFileSync(file, 'utf8').replace('](/running/fundraising/)', `](${DEAD})`));
  approveJourney({ root, target: ID });

  const run = await runGate(root);
  expect(run.ran).toEqual(GATE_STEPS.slice(0, GATE_STEPS.indexOf('check-links') + 1));
  expect(run.failed).toBe('check-links');
  expect(run.messages).toContainEqual(expect.stringContaining(`chapter "${ID}" links to ${DEAD}, which the build didn't make`));
  for (const message of run.messages) expect(message).not.toContain(LINK_TEXT);

  // And as the gate's command line runs it.
  const cli = await promisify(execFile)(process.execPath, [join(REPO, 'scripts/check-links.ts'), `--dist=${join(root, 'dist')}`]).catch((error: { code: number; stderr: string }) => error);
  expect('code' in cli ? cli.code : 0).not.toBe(0);
  expect(cli.stderr).toContain(`chapter "${ID}" links to ${DEAD}`);
});

test('US3.4: with every chapter removed, validate-data refuses the story link, and a plain build leaves a dead panel link that check-links stops', async ({}, testInfo) => {
  testInfo.setTimeout(240_000);
  rmSync(join(root, JOURNEY, 'chapters'), { recursive: true, force: true });
  expect(validateData(root).map(formatIssue)).toEqual([`${SECTION}  field story_link.href: leads to the story page, which doesn't exist until a chapter does`]);

  // The build's own first step runs only the schema and loader checks, so it builds, without the page.
  await buildSite(root);
  expect(existsSync(join(root, 'dist/running/story'))).toBe(false);
  const issues = checkLinks(join(root, 'dist'));
  expect(issues.length).toBeGreaterThan(0);
  const panel = issues.find((issue) => issue.file.replaceAll('\\', '/').endsWith('running/index.html') && issue.path === STORY);
  expect(panel, issues.map((i) => `${i.file}: ${i.message}`).join('\n')).toBeDefined();
  expect(panel!.chapter).toBeUndefined();
});
