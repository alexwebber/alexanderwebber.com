// Writes the health preview's synthetic data tree (T144): published health series, goals, an
// upcoming race, manual Garmin figures with several dated entries, and lab results, under
// tests/fixtures/health-preview/data/running/. None of it is real: every value is made up, so lab
// markers, lab comparisons, the race-prediction trend, the training-status history and the HRV
// baseline band can be tested end to end before the owner has any of them (Principle VIII: no
// invented values in the real data tree). The SHELL_PREVIEW=1 build renders it at
// /health-preview/ through the real health components. Deterministic; the output is committed.
//
//   node tests/fixtures/health-preview/generate.ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { addDays, daysBetween } from '../../../src/shared/format/dates.ts';

const ROOT = resolve(import.meta.dirname);
const DATA = join(ROOT, 'data/running');
rmSync(DATA, { recursive: true, force: true });

const write = (path: string, content: string | object) => {
  const file = join(DATA, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content)}\n`);
};

let seed = 11;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const r1 = (v: number) => Math.round(v * 10) / 10;

export const TODAY = '2026-10-24';
const START = '2025-04-01';
const days = daysBetween(START, TODAY) + 1;

type Point = { date: string; value: number; baseline_low?: number; baseline_high?: number };
const UNITS = { vo2max: 'ml/kg/min', fitness_ctl: 'load', fatigue_atl: 'load', resting_hr: 'bpm', hrv: 'ms', weight_avg7: 'kg', body_fat_pct: '%' } as const;

function series(metric: keyof typeof UNITS, points: Point[]) {
  const byYear = new Map<string, Point[]>();
  for (const p of points) byYear.set(p.date.slice(0, 4), [...(byYear.get(p.date.slice(0, 4)) ?? []), p]);
  for (const [year, pts] of byYear) write(`published/health/${metric}/${year}.json`, { schema_version: 1, metric, unit: UNITS[metric], points: pts });
}

const each = (fn: (i: number, date: string) => Point | undefined, from = 0) =>
  Array.from({ length: days - from }, (_, k) => fn(k + from, addDays(START, k + from))).filter((p): p is Point => p !== undefined);

// Weight: a 7-day average falling from 110 to about 98 kg.
series('weight_avg7', each((i, date) => ({ date, value: r1(110 - (12 * i) / days + Math.sin(i / 20) * 0.6) })));
// Body fat: a reading most days, 30% falling to about 24%.
series('body_fat_pct', each((i, date) => (rand() < 0.7 ? { date, value: r1(30 - (6 * i) / days + (rand() - 0.5) * 1.6) } : undefined)));
// VO2 max: whole numbers, 48 rising to 54, a reading every few days; 54 on 15 Mar 2026.
series('vo2max', each((i, date) => (date === '2026-03-15' ? { date, value: 54 } : i % 3 === 0 ? { date, value: Math.round(48 + (6 * i) / days) } : undefined)));
// Fitness and fatigue: from zero, as intervals.icu's history would.
let ctl = 0;
let atl = 0;
const fitness: Point[] = [];
const fatigue: Point[] = [];
for (let i = 0; i < days; i++) {
  const load = i % 7 === 6 ? 0 : 40 + rand() * 60;
  ctl += (load - ctl) / 42;
  atl += (load - atl) / 7;
  fitness.push({ date: addDays(START, i), value: Math.round(ctl * 1000) / 1000 });
  fatigue.push({ date: addDays(START, i), value: Math.round(atl * 1000) / 1000 });
}
series('fitness_ctl', fitness);
series('fatigue_atl', fatigue);
// Resting HR: 54 to 47 bpm.
series('resting_hr', each((i, date) => (rand() < 0.9 ? { date, value: Math.round(54 - (7 * i) / days + (rand() - 0.5) * 4) } : undefined)));
// HRV from 1 Sep 2025 (a later start), with a baseline band on the last 60 days only.
const hrvFrom = daysBetween(START, '2025-09-01');
series(
  'hrv',
  each((i, date) => {
    if (rand() < 0.1) return undefined;
    const value = Math.round(42 + (8 * (i - hrvFrom)) / (days - hrvFrom) + (rand() - 0.5) * 14);
    return daysBetween(date, TODAY) < 60 ? { date, value, baseline_low: 44, baseline_high: 56 } : { date, value };
  }, hrvFrom),
);

write('owner/section.yaml', 'focus_race: { race_id: seaside-2027, build_start: 2026-09-05, charity: { name: Example hospice } }\n');
write('owner/upcoming-races.yaml', '- { id: seaside-2027, name: Seaside Marathon, date: 2027-04-04, distance: marathon, target_time: "3:20:00" }\n');
write(
  'owner/goals.yaml',
  `- { id: seaside-sub-3-20, type: race_time, title: Seaside Marathon under 3:20, priority: 1, featured: true, linked_race: seaside-2027, target: { distance: marathon, time: "3:20:00" } }
- { id: 10k-sub-43, type: race_time, title: 10k under 43 minutes, priority: 2, featured: true, target: { distance: 10k, time: "43:00" } }
- { id: weight-90, type: body_composition, title: Weight 90 kg, priority: 3, featured: true, created: 2025-04-01, start_value: 112.0, start_date: 2025-03-01, all_time_start: { value: 118.4, date: 2022-01-10 }, target: { metric: weight_kg, value: 90, direction: at_most } }
- { id: body-fat-18, type: body_composition, title: Body fat 18%, priority: 4, featured: true, created: 2025-04-01, target: { metric: body_fat_pct, value: 18, direction: at_most } }
- { id: vo2max-56, type: metric, title: VO2 max 56, priority: 5, featured: true, created: 2025-04-01, target: { metric: vo2max, value: 56, direction: at_least } }
`,
);
write(
  'owner/manual-metrics.yaml',
  `training_status:
  - { as_of: 2026-04-02, status: maintaining }
  - { as_of: 2026-07-14, status: productive, note: After a training block }
  - { as_of: 2026-10-20, status: peaking }
race_predictions:
  - { as_of: 2026-04-02, 5k: "21:40", 10k: "45:10", half: "1:41:30", marathon: "3:38:00" }
  - { as_of: 2026-07-14, 5k: "20:55", 10k: "43:40", half: "1:37:10", marathon: "3:29:30" }
  - { as_of: 2026-10-20, 5k: "20:10", 10k: "42:05", half: "1:33:40" }
`,
);
// Two DEXA scans a year apart (US5.5) and a lab VO2 max of 51.0 where Garmin said 54 (US5.4).
write('owner/lab/2025-06-10-dexa.yaml', 'date: 2025-06-10\ntype: dexa\nprovider: Example Clinic\nvalues: { body_fat_pct: 31.2, weight_kg: 108.9 }\n');
write('owner/lab/2026-06-09-dexa.yaml', 'date: 2026-06-09\ntype: dexa\nprovider: Example Clinic\nvalues: { body_fat_pct: 26.1, weight_kg: 101.5 }\n');
write('owner/lab/2026-03-15-lab-vo2max.yaml', 'date: 2026-03-15\ntype: lab_vo2max\nprovider: Example Sports Lab\nvalues: { vo2max: 51.0 }\n');
