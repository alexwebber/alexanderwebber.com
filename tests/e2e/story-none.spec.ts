// The SC-002 drill (spec 003 T048; quickstart.md §4, FR-001, FR-042): with no approved chapter
// published, nothing about the story may show. The drill copies the repo's real code and data into a
// scratch site (tests/helpers/scratch-site.ts), removes every chapter folder and section.yaml's
// `story_link` (so it still holds once the real story is in, Phase 7), and leaves an approved note,
// page wording and closing section in place: the real ones once they exist, else made-up ones, so
// "nothing alone creates the page" is tested before launch too. Then it runs the gate's steps on it
// (runGate), as a deploy build, and checks:
// - the data validates, with exactly one issue: the closing section's warning (a note or page
//   wording with no chapter is ignored with no message, data-model.md §7, §8);
// - there's no /running/story/, no /og/running-story.png, no "Story" in any page's menu, no story
//   link panel, no link to the page anywhere, and no sitemap entry;
// - /running/story/ answers with the 404 page.
// Checks look for elements, not strings, because class names are also in pages' inlined CSS.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { validateData } from '../../scripts/validate-data.ts';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import { closing, CLOSING, JOURNEY, NOTE, note, page, PAGE, writeApproved } from '../helpers/journey.ts';
import { builtHtmlFiles, copySite, GATE_STEPS, runGate, scratchRepo, serveDist, type DistServer, type GateRun } from '../helpers/scratch-site.ts';

let root: string;
let dist: string;
let gate: GateRun;
let server: DistServer | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  // The checks read built files and one 404, which don't depend on the viewport, so it builds once.
  test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device');
  testInfo.setTimeout(240_000);
  root = testInfo.outputPath('story-none-site');
  copySite(root);
  const repo = scratchRepo(root);

  // No chapter, and so no story link, which would be refused without one.
  rmSync(join(root, JOURNEY, 'chapters'), { recursive: true, force: true });
  const sectionFile = join(root, 'data/running/owner/section.yaml');
  const section = parse(readFileSync(sectionFile, 'utf8')) as Record<string, unknown>;
  delete section.story_link;
  writeFileSync(sectionFile, stringify(section));
  // Everything else in place, approved: the real files when they exist, made-up ones otherwise.
  if (!existsSync(join(root, NOTE))) writeApproved(repo, NOTE, 'note', note());
  if (!existsSync(join(root, PAGE))) writeApproved(repo, PAGE, 'page', page());
  if (!existsSync(join(root, CLOSING))) writeApproved(repo, CLOSING, 'closing', closing());

  gate = await runGate(root);
  if (gate.failed) throw new Error(`the gate stopped at ${gate.failed}:\n${gate.messages.join('\n')}`);
  dist = join(root, 'dist');
  server = await serveDist(dist);
});

test.afterAll(async () => {
  await server?.close();
  if (root) rmSync(root, { recursive: true, force: true });
});

test('SC-002: the gate passes, and the data validates with only the closing section\'s warning', () => {
  expect(gate.ran).toEqual([...GATE_STEPS]);
  const issues = validateData(root);
  expect(issues.map(formatIssue)).toEqual([`${CLOSING}  closing section: has no chapter to follow, so it is not shown`]);
  expect(issues[0]?.severity).toBe('warning');
});

test('SC-002: no story page and no share image', () => {
  expect(existsSync(join(dist, 'running', 'index.html'))).toBe(true);
  expect(existsSync(join(dist, 'running', 'story'))).toBe(false);
  expect(existsSync(join(dist, 'og', 'running-story.png'))).toBe(false);
});

test('SC-002: no page has "Story" in a menu, a story link panel or a link to the story page', () => {
  const pages = builtHtmlFiles(dist);
  expect(pages.length).toBeGreaterThan(5);
  for (const path of pages) {
    const html = readFileSync(join(dist, path), 'utf8');
    expect(html, path).not.toMatch(/<p\b[^>]*\bdata-story-link\b/);
    expect(html, path).not.toMatch(/href="\/running\/story\//);
    for (const nav of html.match(/<nav\b[\s\S]*?<\/nav>/g) ?? []) expect(nav, path).not.toMatch(/>\s*Story\s*</);
  }
});

test('SC-002: the sitemap has no story entry', () => {
  const sitemaps = readdirSync(dist).filter((name) => /^sitemap.*\.xml$/.test(name));
  expect(sitemaps.length).toBeGreaterThan(0);
  const xml = sitemaps.map((name) => readFileSync(join(dist, name), 'utf8')).join('\n');
  expect(xml).toContain('/running/');
  expect(xml).not.toContain('/running/story/');
});

test('SC-002: /running/story/ answers with the 404 page', async ({ page }) => {
  const response = await page.goto(`${server!.base}/running/story/`);
  expect(response?.status()).toBe(404);
  expect(await response?.text()).toBe(readFileSync(join(dist, '404.html'), 'utf8'));
  const share = await page.request.get(`${server!.base}/og/running-story.png`);
  expect(share.status()).toBe(404);
});
