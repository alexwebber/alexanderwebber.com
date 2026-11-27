// The CV launch drill (spec 004 T065; FR-021, FR-022, SC-004, SC-005; quickstart.md §2 and §8): the
// CV as the content PR will bring it in, on a scratch copy of the real site, with data/cv/ replaced by
// importCv of the made-up typical export, so the drill holds once the real CV is in. The gate's steps
// run on it (runGate), then:
// - the gate passes (check-links included) and /cv/ is built, with noindex while unlisted;
// - compareCv against the export prints no differences (SC-005, for real on the built page; the
//   downloads come in slice 5, so they're left out of the comparison);
// - a card edited by hand after approval stops validate-data and the build, naming the item, never
//   the text, and leaves dist/ as it was (SC-004);
// - a phone number planted in a card and re-hashed in the copy is stopped by validate-data, and placed
//   straight into the built page it is stopped by scan-privacy, its excerpt redacted (FR-019, FR-003).
// It prints what it measured, for the PR.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { compareCv, differenceLine } from '../../scripts/compare-cv.ts';
import { importCv } from '../../scripts/import-cv.ts';
import { scanPrivacy } from '../../scripts/scan-privacy.ts';
import { validateData } from '../../scripts/validate-data.ts';
import type { CvExport } from '../../src/sections/cv/data/store/index.ts';
import { itemSha256 } from '../../src/sections/cv/domain/hashes.ts';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import { RULES_CONFIRMED } from '../helpers/cv.ts';
import { buildFailure, copySite, GATE_STEPS, REPO, runGate, snapshotDist, type GateRun } from '../helpers/scratch-site.ts';

const EXPORT = join(REPO, 'tests/fixtures/cv-export/typical/export.json');
const TIMELINE = 'data/cv/timeline.yaml';
const PHONE = '07700 900123';
const EDIT = 'Quietly reworded after approval';

let root: string;
let gate: GateRun;
const measured: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'builds once, not per device');
  testInfo.setTimeout(240_000);
  root = testInfo.outputPath('cv-launch-site');
  copySite(root);
  rmSync(join(root, 'data/cv'), { recursive: true, force: true });
  const imported = importCv({ from: EXPORT, rulesChecked: RULES_CONFIRMED, root });
  if (!imported.ok) throw new Error(`the import refused the made-up export:\n${imported.lines.join('\n')}`);
  gate = await runGate(root);
  if (gate.failed) throw new Error(`the gate stopped at ${gate.failed}:\n${gate.messages.join('\n')}`);
});

test.afterAll(({}, testInfo) => {
  if (measured.length > 0) {
    console.log(`cv-launch:\n  ${measured.join('\n  ')}`);
    testInfo.annotations.push({ type: 'measured', description: measured.join('; ') });
  }
  if (root) rmSync(root, { recursive: true, force: true });
});

test('the gate passes with the CV, and /cv/ is built with noindex', () => {
  expect(gate.ran).toEqual([...GATE_STEPS]);
  expect(validateData(root).filter((i) => i.severity === 'error').map(formatIssue)).toEqual([]);
  const html = readFileSync(join(root, 'dist/cv/index.html'), 'utf8');
  expect(html).toMatch(/<meta name="robots" content="noindex">/);
  measured.push(`gate: ${gate.ran.join(', ')} passed; /cv/ built (${Math.round(html.length / 1024)} KB of HTML), noindex`);
});

test('SC-005: compare-cv finds the built page word for word the export', () => {
  const exp = JSON.parse(readFileSync(EXPORT, 'utf8')) as CvExport;
  const html = readFileSync(join(root, 'dist/cv/index.html'), 'utf8');
  const differences = compareCv(html, { ...exp, downloads: [] }).map(differenceLine);
  expect(differences).toEqual([]);
  const items = 1 + exp.blocks.length + exp.blocks.flatMap((b) => b.stories ?? []).length + Object.values(exp.timeline).reduce((n, list) => n + list.length, 0);
  measured.push(`compare-cv: no differences over ${items} items (downloads aside, slice 5)`);
});

test('SC-004: a card edited after approval stops validate-data and the build, naming the item, and dist/ stays', async () => {
  const file = join(root, TIMELINE);
  const original = readFileSync(file, 'utf8');
  const timeline = parse(original) as { changes: { id: string; card: string }[] };
  const change = timeline.changes[3]!;
  writeFileSync(file, original.replace(change.card, `${EDIT}. ${change.card}`));
  try {
    const errors = validateData(root).filter((i) => i.severity === 'error').map(formatIssue);
    expect(errors).toEqual([`${TIMELINE}  change ${change.id}: approval doesn't match`]);
    const before = snapshotDist(join(root, 'dist'));
    const output = await buildFailure(root);
    expect(output).toContain(`change ${change.id}`);
    expect(output).toContain("approval doesn't match");
    expect(output).not.toContain(EDIT);
    expect(snapshotDist(join(root, 'dist'))).toEqual(before);
    measured.push(`hand-edited card: validate-data and the build stopped it ("change ${change.id}: approval doesn't match"), dist/ unchanged (${Object.keys(before).length} files)`);
  } finally {
    writeFileSync(file, original);
  }
});

test('a phone number in a re-hashed card stops validate-data; in the built page, scan-privacy, redacted', async () => {
  const file = join(root, TIMELINE);
  const original = readFileSync(file, 'utf8');
  const header = original.slice(0, original.indexOf('\nthemes:') + 1);
  const timeline = parse(original) as { changes: (Record<string, unknown> & { id: string; card: string; approved: { sha256: string } })[] };
  const change = timeline.changes[0]!;
  change.card = `Call ${PHONE} for more.`;
  change.approved.sha256 = itemSha256('change', change);
  writeFileSync(file, header + stringify(timeline, { lineWidth: 0 }));
  try {
    const errors = validateData(root).filter((i) => i.severity === 'error').map(formatIssue);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(new RegExp(`^${TIMELINE}  change ${change.id}`));
    expect(errors[0]).toMatch(/phone number/);
    expect(errors.join('\n')).not.toContain(PHONE);
    measured.push(`phone number in a re-hashed card: validate-data stopped it ("${errors[0]}")`);
  } finally {
    writeFileSync(file, original);
  }
  expect(validateData(root).filter((i) => i.severity === 'error')).toEqual([]);

  const page = join(root, 'dist/cv/index.html');
  const built = readFileSync(page, 'utf8');
  writeFileSync(page, built.replace('</main>', `<p>Call ${PHONE}.</p></main>`));
  try {
    const findings = (await scanPrivacy(root)).filter((f) => f.file === 'dist/cv/index.html');
    expect(findings.length).toBe(1);
    expect(findings[0]!.rule).toMatch(/phone/i);
    expect(JSON.stringify(findings)).not.toContain(PHONE);
    expect(JSON.stringify(findings)).not.toContain('900123');
    measured.push(`phone number in the built page: scan-privacy stopped it at ${findings[0]!.file}:${findings[0]!.line}:${findings[0]!.column} (${findings[0]!.rule}), excerpt redacted`);
  } finally {
    writeFileSync(page, built);
  }
  expect((await scanPrivacy(root)).filter((f) => f.file === 'dist/cv/index.html')).toEqual([]);
});
