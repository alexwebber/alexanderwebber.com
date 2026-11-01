// The SC-006 drill (T104; specs/002-fundraising/quickstart.md §8, FR-022, FR-040): a campaign is set
// up in campaigns.yaml but has no published figures yet, so nothing about fundraising may show. The
// drill copies the repo's real code and data into a scratch site (tests/helpers/scratch-site.ts),
// removes every published fundraising file, makes the focus race's campaign current, and builds it
// once, as a deploy build. Then:
// - the data still validates (a campaign without figures is valid);
// - there is no /running/fundraising/, no /og/running-fundraising.png, no "Fundraising" in any nav
//   or the landing links, no sitemap entry and no fundraising card on any page. The card's class
//   name is in two pages' inlined CSS, so the check looks for the element, not the string;
// - the hero keeps its charity line, which the card replaces only when it shows.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { validateData } from '../../scripts/validate-data.ts';
import { buildSite, builtHtmlFiles, copySite } from '../helpers/scratch-site.ts';

let root: string;
let dist: string;
let dataErrors: string[];
let charity: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  // The checks read built files, which don't depend on the viewport, so it builds once.
  test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device');
  testInfo.setTimeout(240_000);
  root = testInfo.outputPath('no-figures-site');
  copySite(root);

  const owner = join(root, 'data/running/owner');
  const focus = parse(readFileSync(join(owner, 'section.yaml'), 'utf8')).focus_race as { race_id: string; charity: { name: string } };
  charity = focus.charity.name;
  const campaignsFile = join(owner, 'campaigns.yaml');
  const campaigns = (parse(readFileSync(campaignsFile, 'utf8')) ?? []) as { race_id: string; finished?: boolean }[];
  const current = campaigns.find((c) => c.race_id === focus.race_id);
  if (!current) throw new Error(`campaigns.yaml has no campaign for the focus race "${focus.race_id}"`);
  delete current.finished;
  writeFileSync(campaignsFile, stringify(campaigns));
  // No campaign has figures: the state before the first read publishes.
  rmSync(join(root, 'data/running/published/fundraising'), { recursive: true, force: true });

  dataErrors = validateData(root)
    .filter((i) => i.severity === 'error')
    .map((i) => `${i.file}: ${i.message}`);
  await buildSite(root);
  dist = join(root, 'dist');
});

test.afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

test('SC-006: a campaign with no figures yet is valid data', () => {
  expect(dataErrors).toEqual([]);
});

test('SC-006: no fundraising page and no share image', () => {
  expect(existsSync(join(dist, 'index.html'))).toBe(true);
  expect(existsSync(join(dist, 'running', 'index.html'))).toBe(true);
  expect(existsSync(join(dist, 'running', 'fundraising'))).toBe(false);
  expect(existsSync(join(dist, 'og', 'running-fundraising.png'))).toBe(false);
});

test('SC-006: no page has a fundraising card, a link to the page or "Fundraising" in a nav', () => {
  const pages = builtHtmlFiles(dist);
  expect(pages.length).toBeGreaterThan(5);
  for (const path of pages) {
    const html = readFileSync(join(dist, path), 'utf8');
    expect(html, path).not.toMatch(/<article\b[^>]*\bclass="fundraising-card\b/);
    expect(html, path).not.toContain('href="/running/fundraising/"');
    for (const nav of html.match(/<nav\b[\s\S]*?<\/nav>/g) ?? []) expect(nav, path).not.toContain('Fundraising');
  }
});

test('SC-006: the sitemap has no fundraising entry', () => {
  const sitemaps = readdirSync(dist).filter((name) => /^sitemap.*\.xml$/.test(name));
  expect(sitemaps.length).toBeGreaterThan(0);
  const xml = sitemaps.map((name) => readFileSync(join(dist, name), 'utf8')).join('\n');
  expect(xml).toContain('/running/');
  expect(xml).not.toContain('fundraising');
});

test('SC-006: the hero keeps its charity line', () => {
  const html = readFileSync(join(dist, 'running', 'index.html'), 'utf8');
  expect(html).toMatch(new RegExp(`<li[^>]*data-charity[^>]*>For ${charity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</li>`));
});
