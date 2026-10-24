// Synthetic published runs for the SC-011 scale check (T124; promoted from Spike 1b's
// spikes/scale/generate.ts). Writes N schema-valid runs, worst case (every series at the 600-point
// cap, splits, Garmin's five HR zones, dynamics, best efforts), into <root>/data/running/published/
// runs/<yyyy>/, and rewrites the manifest's runs to match, so the copy builds and validates like
// the real thing. Deterministic (seeded). Never point it at the real repository: it replaces the
// published runs. Nothing it writes is real data, and nothing is ever committed.
//
//   node tests/fixtures/generate-runs.ts <repo copy root> [count=5000] [points=600]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: node tests/fixtures/generate-runs.ts <repo copy root> [count] [points]');
if (resolve(root) === resolve(import.meta.dirname, '../..')) throw new Error('refusing to overwrite the real published runs');
const count = Number(process.argv[3] ?? 5000);
const points = Number(process.argv[4] ?? 600);
const published = join(root, 'data/running/published');
const runsDir = join(published, 'runs');
rmSync(runsDir, { recursive: true, force: true });

let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const b32 = 'abcdefghijklmnopqrstuvwxyz234567';
const r1 = (v: number) => Math.round(v * 10) / 10;
const NAMES = ['Warm Up', 'Easy', 'Aerobic', 'Threshold', 'Maximum'];
const BOUNDS = [88, 105, 123, 140, 158, 175];

// About 350 runs a year, ending today: 5,000 runs span roughly 14 years.
const DAY = 86_400_000;
const end = Date.now();
const runs: Record<string, { input_hash: string; path: string }> = {};
for (let i = 0; i < count; i++) {
  const date = new Date(end - (count - 1 - i) * DAY * 1.05).toISOString().slice(0, 10);
  const id = `${date}-${Array.from({ length: 4 }, () => b32[Math.floor(rand() * 32)]).join('')}`;
  const treadmill = rand() < 0.15;
  const distance = Math.round(3000 + rand() * 39000);
  const basePace = 270 + rand() * 90;
  const moving = Math.round((distance / 1000) * basePace);
  const series: Record<string, number[]> = { x_dist_m: [], x_elapsed_s: [], pace: [], hr: [], cadence: [], power: [] };
  if (!treadmill) series.elev = [];
  let e = 20 + rand() * 50;
  for (let p = 0; p < points; p++) {
    series.x_dist_m!.push(Math.round((distance * p) / (points - 1)));
    series.x_elapsed_s!.push(Math.round((moving * p) / (points - 1)));
    series.pace!.push(r1(basePace + (rand() - 0.5) * 30));
    series.hr!.push(Math.round(140 + rand() * 30));
    e += (rand() - 0.5) * 2;
    series.elev?.push(r1(e));
    series.cadence!.push(Math.round(170 + rand() * 12));
    series.power!.push(Math.round(250 + rand() * 60));
  }
  const km = Math.ceil(distance / 1000);
  const splits = Array.from({ length: km }, (_, k) => {
    const part = Math.min(1000, distance - k * 1000);
    const time = Math.max(1, Math.round(((basePace + (rand() - 0.5) * 20) * part) / 1000));
    return { km: k + 1, time_s: time, pace_s_per_km: r1((time / part) * 1000), hr: Math.round(145 + rand() * 20), ...(treadmill ? {} : { elev_delta_m: r1((rand() - 0.5) * 10) }) };
  });
  const shares = [0.02, 0.1, 0.4, 0.4, 0.08];
  const run = {
    schema_version: 1,
    id,
    date,
    type: treadmill ? 'indoor' : 'road',
    treadmill,
    is_race: !treadmill && rand() < 0.02,
    title: `${treadmill ? 'Treadmill run' : 'Run'} · ${(distance / 1000).toFixed(1)} km`,
    device: i < count / 2 ? 'Venu 2 Plus' : 'Venu X1',
    distance_m: distance,
    moving_s: moving,
    elapsed_s: moving + 60,
    ...(treadmill ? {} : { elevation_gain_m: r1(rand() * 200), elevation_loss_m: r1(rand() * 200) }),
    avg_pace_s_per_km: r1(basePace),
    best_pace_s_per_km: r1(basePace - 20),
    hr: { avg: 152, max: 178 },
    cadence_avg: 176,
    stride_m_avg: 1.12,
    power_w_avg: 280,
    dynamics: { gct_ms: 245, gct_balance_pct: 49.8, vert_osc_mm: 89, vert_ratio_pct: 7.8 },
    splits,
    hr_zones: NAMES.map((name, k) => ({ zone: k + 1, name, low_bpm: BOUNDS[k], high_bpm: BOUNDS[k + 1], seconds: Math.round(moving * shares[k]!) })),
    series,
    best_efforts: [
      { distance_m: 1000, label: '1k', time_s: r1(basePace - 30), plausible: true },
      { distance_m: 5000, label: '5k', time_s: r1((basePace - 10) * 5), plausible: true },
    ],
    flags: {},
  };
  const dir = join(runsDir, date.slice(0, 4));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(run));
  runs[id] = { input_hash: '0'.repeat(64), path: `runs/${date.slice(0, 4)}/${id}.json` };
}

const manifestPath = join(published, 'state/manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { schema_version: 1, health: {}, processed_at: new Date().toISOString() };
manifest.runs = runs;
mkdirSync(join(published, 'state'), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`generate-runs: ${count} runs (${points} points per series) -> ${runsDir}`);
