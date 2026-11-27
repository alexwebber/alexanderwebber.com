// The "nothing before the content PR" drill (spec 004 T064; research.md R1, FR-004; contracts/
// routes.md): a deploy build of a copy of the real site (tests/helpers/scratch-site.ts) with data/cv/
// removed from the copy, so it still holds once the real CV is in (Phase 8). Then the gate's steps run
// on it (runGate) and:
// - validate-data reports nothing for the CV;
// - there's no dist/cv/, and /cv/ answers with the 404 page;
// - the sitemap has no /cv/ entry, and no page links to /cv/.
// Checks look for elements, not strings, because class names are also in pages' inlined CSS.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { validateData } from '../../scripts/validate-data.ts';
import { builtHtmlFiles, copySite, GATE_STEPS, runGate, serveDist, type DistServer, type GateRun } from '../helpers/scratch-site.ts';

let root: string;
let dist: string;
let gate: GateRun;
let server: DistServer | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  // The checks read built files and one 404, which don't depend on the viewport, so it builds once.
  test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device');
  testInfo.setTimeout(240_000);
  root = testInfo.outputPath('cv-none-site');
  copySite(root);
  rmSync(join(root, 'data/cv'), { recursive: true, force: true });
  gate = await runGate(root);
  if (gate.failed) throw new Error(`the gate stopped at ${gate.failed}:\n${gate.messages.join('\n')}`);
  dist = join(root, 'dist');
  server = await serveDist(dist);
});

test.afterAll(async () => {
  await server?.close();
  if (root) rmSync(root, { recursive: true, force: true });
});

test('the gate passes, and validate-data reports nothing for the CV', () => {
  expect(gate.ran).toEqual([...GATE_STEPS]);
  expect(validateData(root).filter((issue) => issue.file.startsWith('data/cv'))).toEqual([]);
});

test('no /cv/ is built, and /cv/ answers with the 404 page', async ({ page }) => {
  expect(existsSync(join(dist, 'index.html'))).toBe(true);
  expect(existsSync(join(dist, 'cv'))).toBe(false);
  const response = await page.goto(`${server!.base}/cv/`);
  expect(response?.status()).toBe(404);
  expect(await response?.text()).toBe(readFileSync(join(dist, '404.html'), 'utf8'));
});

test('the sitemap has no /cv/ entry, and no page links to /cv/', () => {
  const sitemaps = readdirSync(dist).filter((name) => /^sitemap.*\.xml$/.test(name));
  expect(sitemaps.length).toBeGreaterThan(0);
  const xml = sitemaps.map((name) => readFileSync(join(dist, name), 'utf8')).join('\n');
  expect(xml).toContain('/running/');
  expect(xml).not.toMatch(/\/cv\//);
  const pages = builtHtmlFiles(dist);
  expect(pages.length).toBeGreaterThan(5);
  for (const path of pages) expect(readFileSync(join(dist, path), 'utf8'), path).not.toMatch(/href="(?:https:\/\/alexanderwebber\.com)?\/cv\//);
});
