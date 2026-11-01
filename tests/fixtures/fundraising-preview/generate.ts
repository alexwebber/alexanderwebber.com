// Writes the fundraising preview's synthetic data trees (T054, T072), one per state, under
// tests/fixtures/fundraising-preview/data/<state>/data/running/ (JsonFileStore expects
// <root>/data/running/). None of it is real: the charities, races, totals, page addresses, charity
// numbers and dates are all made up, so states the real campaign can't show yet (108%, no target,
// stale, a chart with history, past campaigns) can be tested end to end. The SHELL_PREVIEW=1 build
// renders them at /fundraising-preview/<state>/ through the real components. Deterministic; the
// output is committed.
//
//   node tests/fixtures/fundraising-preview/generate.ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, 'data');
rmSync(ROOT, { recursive: true, force: true });

const LAST_READ = '2026-11-10T09:17:03Z'; // the morning of PREVIEW_TODAY (store.ts)
const OLD_READ = '2026-11-08T09:17:03Z';

interface Point {
  date: string;
  raised_pence: number;
  target_pence?: number;
  supporters: number;
}

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  /** Written to races/<id>/race.yaml, as a finished race is, not to upcoming-races.yaml. */
  raced?: boolean;
}

interface PreviewCampaign {
  race: Race;
  charity: string;
  /** Written under charity.registered. */
  registered?: string;
  /** Leaves out charity.url. */
  noUrl?: boolean;
  finished?: boolean;
  last_read_at?: string;
  points: Point[];
}

interface State {
  /** The focus race's id, when it isn't the first campaign's race. */
  focus?: Race;
  campaigns: PreviewCampaign[];
}

const SEASIDE: Race = { id: 'seaside-2027', name: 'Seaside Marathon', date: '2027-04-04', distance: 'marathon' };
const LAKESIDE: Race = { id: 'lakeside-2027', name: 'Lakeside Half', date: '2027-10-03', distance: 'half' };
const SEASIDE_2026: Race = { id: 'seaside-2026', name: 'Seaside Marathon', date: '2026-04-05', distance: 'marathon', raced: true };
const HARBOUR: Race = { id: 'harbour-2026', name: 'Harbour 10k', date: '2026-09-20', distance: '10k' };

const point = (date: string, pounds: number, supporters: number, target?: number): Point => ({
  date,
  raised_pence: pounds * 100,
  ...(target !== undefined ? { target_pence: target * 100 } : {}),
  supporters,
});

/** A campaign's first month: a quiet start, a jump, a flat spell and a refund. */
const HISTORY = (target?: number): Point[] => [
  point('2026-10-12', 0, 0, target),
  point('2026-10-13', 150, 6, target),
  point('2026-10-14', 310, 11, target),
  point('2026-10-20', 610, 19, target),
  point('2026-10-21', 900, 26, target),
  point('2026-10-22', 870, 25, target),
  point('2026-11-03', 1050, 31, target),
];

const seaside = (points: Point[], extra: Partial<PreviewCampaign> = {}): PreviewCampaign => ({ race: SEASIDE, charity: 'Example hospice', points, ...extra });

const pastSeaside: PreviewCampaign = {
  race: SEASIDE_2026,
  charity: 'Example hospice',
  finished: true,
  last_read_at: '2026-07-03T08:17:03Z',
  points: [point('2026-02-01', 400, 12, 1500), point('2026-04-05', 1620, 44, 1500)],
};

const STATES: Record<string, State> = {
  active: { campaigns: [seaside([...HISTORY(2000), point('2026-11-10', 1250, 37, 2000)], { registered: 'Example hospice group' })] },
  'first-day': { campaigns: [seaside([point('2026-11-10', 1250, 37, 2000)], { registered: 'Example hospice' })] },
  'no-target': { campaigns: [seaside([...HISTORY(), point('2026-11-10', 1250, 37)])] },
  zero: { campaigns: [seaside([point('2026-11-10', 0, 0, 500)], { noUrl: true })] },
  beaten: { campaigns: [seaside([...HISTORY(2000), point('2026-11-09', 2160, 37, 2000)])] },
  stale: { campaigns: [seaside([point('2026-11-08', 1250, 37, 2000)], { last_read_at: OLD_READ })] },
  'second-campaign': {
    campaigns: [
      pastSeaside,
      { race: LAKESIDE, charity: 'Example shelter', points: [point('2026-10-30', 80, 3, 1000), point('2026-11-10', 240, 8, 1000)] },
    ],
    focus: LAKESIDE,
  },
  'no-current': {
    campaigns: [pastSeaside, { race: HARBOUR, charity: 'Example shelter', last_read_at: OLD_READ, points: [point('2026-09-20', 310, 14)] }],
    focus: LAKESIDE,
  },
};

const raceYaml = ({ id, name, date, distance }: Race) => `slug: ${id}\nname: ${name}\ndate: ${date}\ndistance: ${distance}\nofficial_time: "3:40:00"\n`;
const upcomingYaml = ({ id, name, date, distance }: Race) => `- { id: ${id}, name: ${name}, date: ${date}, distance: ${distance}, target_time: "3:20:00" }\n`;

function campaignYaml({ race, charity, registered, noUrl, finished }: PreviewCampaign): string {
  const lines = [`- id: ${race.id}`, `  race_id: ${race.id}`, '  charity:', `    name: ${charity}`];
  if (!noUrl) lines.push('    url: https://example.org/');
  if (registered) lines.push('    registered:', `      name: ${registered}`, '      number: "000000"');
  lines.push(`  page_url: https://www.justgiving.com/page/example-${race.id}`);
  if (finished) lines.push('  finished: true');
  return `${lines.join('\n')}\n`;
}

for (const [state, { campaigns, focus }] of Object.entries(STATES)) {
  const write = (path: string, content: string) => {
    const file = join(ROOT, state, 'data/running', path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const focusRace = focus ?? campaigns[0]!.race;
  const focusCharity = campaigns.find((c) => c.race === focusRace)?.charity ?? 'Example hospice';
  write('owner/section.yaml', `focus_race: { race_id: ${focusRace.id}, build_start: 2026-09-05, charity: { name: ${focusCharity} } }\n`);
  const races = [...new Set([focusRace, ...campaigns.map((c) => c.race)])];
  write('owner/upcoming-races.yaml', races.filter((r) => !r.raced).map(upcomingYaml).join(''));
  for (const race of races.filter((r) => r.raced)) write(`owner/races/${race.id}/race.yaml`, raceYaml(race));
  write('owner/campaigns.yaml', campaigns.map(campaignYaml).join(''));
  for (const { race, last_read_at = LAST_READ, points } of campaigns) {
    write(`published/fundraising/${race.id}.json`, `${JSON.stringify({ schema_version: 1, campaign_id: race.id, last_read_at, points })}\n`);
  }
}
