// Writes the fundraising preview's synthetic data trees (T054), one per state, under
// tests/fixtures/fundraising-preview/data/<state>/data/running/ (JsonFileStore expects
// <root>/data/running/). None of it is real: the charity, race, totals, page address and dates are
// all made up, so states the real campaign can't show yet (108%, no target, stale) can be tested
// end to end. The SHELL_PREVIEW=1 build renders them at /fundraising-preview/<state>/ through the
// real components. Deterministic; the output is committed.
//
//   node tests/fixtures/fundraising-preview/generate.ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, 'data');
rmSync(ROOT, { recursive: true, force: true });

const LAST_READ = '2026-11-10T09:17:03Z'; // the morning of PREVIEW_TODAY (store.ts)

interface State {
  raised_pence: number;
  target_pence?: number;
  supporters: number;
  last_read_at?: string;
}

const STATES: Record<string, State> = {
  active: { raised_pence: 125000, target_pence: 200000, supporters: 37 },
  'no-target': { raised_pence: 125000, supporters: 37 },
  zero: { raised_pence: 0, target_pence: 50000, supporters: 0 },
  beaten: { raised_pence: 216000, target_pence: 200000, supporters: 37 },
  stale: { raised_pence: 125000, target_pence: 200000, supporters: 37, last_read_at: '2026-11-08T09:17:03Z' },
};

for (const [state, { last_read_at = LAST_READ, ...figures }] of Object.entries(STATES)) {
  const write = (path: string, content: string) => {
    const file = join(ROOT, state, 'data/running', path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  write('owner/section.yaml', 'focus_race: { race_id: seaside-2027, build_start: 2026-09-05, charity: { name: Example hospice } }\n');
  write('owner/upcoming-races.yaml', '- { id: seaside-2027, name: Seaside Marathon, date: 2027-04-04, distance: marathon, target_time: "3:20:00" }\n');
  write(
    'owner/campaigns.yaml',
    `- id: seaside-2027
  race_id: seaside-2027
  charity:
    name: Example hospice
    url: https://example.org/
  page_url: https://www.justgiving.com/page/example-seaside-2027
`,
  );
  const point = { date: last_read_at.slice(0, 10), ...figures };
  write('published/fundraising/seaside-2027.json', `${JSON.stringify({ schema_version: 1, campaign_id: 'seaside-2027', last_read_at, points: [point] })}\n`);
}
