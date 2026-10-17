// Spike 1b (throwaway): write N synthetic runs shaped like data/running/published/runs.
// Worst case: every optional series present, each at the 600-point cap.
// Usage: node generate.ts [count=5000] [points=600]
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const count = Number(process.argv[2] ?? 5000);
const points = Number(process.argv[3] ?? 600);
const outDir = join(import.meta.dirname, 'out', 'runs');
rmSync(join(import.meta.dirname, 'out'), { recursive: true, force: true });

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const b32 = 'abcdefghijklmnopqrstuvwxyz234567';
const r1 = (v: number) => Math.round(v * 10) / 10;

const start = Date.UTC(2012, 0, 1);
for (let i = 0; i < count; i++) {
  const date = new Date(start + i * 86400000 * (5000 / count) * 1.05).toISOString().slice(0, 10);
  const id = `${date}-${Array.from({ length: 4 }, () => b32[Math.floor(rand() * 32)]).join('')}`;
  const distance = Math.round(3000 + rand() * 39000);
  const basePace = 270 + rand() * 90;
  const moving = Math.round((distance / 1000) * basePace);
  const n = points;
  const x_dist_m: number[] = [], x_elapsed_s: number[] = [], pace: number[] = [], hr: number[] = [];
  const elev: number[] = [], cadence: number[] = [], power: number[] = [];
  let e = 20 + rand() * 50;
  for (let p = 0; p < n; p++) {
    x_dist_m.push(Math.round((distance * p) / (n - 1)));
    x_elapsed_s.push(Math.round((moving * p) / (n - 1)));
    pace.push(r1(basePace + (rand() - 0.5) * 30));
    hr.push(Math.round(140 + rand() * 30));
    e += (rand() - 0.5) * 2;
    elev.push(r1(e));
    cadence.push(Math.round(170 + rand() * 12));
    power.push(Math.round(250 + rand() * 60));
  }
  const km = Math.floor(distance / 1000);
  const splits = Array.from({ length: km }, (_, k) => ({
    km: k + 1, time_s: Math.round(basePace + (rand() - 0.5) * 20), pace_s_per_km: Math.round(basePace),
    hr: Math.round(145 + rand() * 20), elev_delta_m: r1((rand() - 0.5) * 10),
  }));
  const run = {
    id, date, type: 'road', treadmill: false, is_race: rand() < 0.02, title: 'Morning run',
    distance_m: distance, moving_s: moving, elapsed_s: moving + 60,
    elevation_gain_m: r1(rand() * 200), elevation_loss_m: r1(rand() * 200),
    avg_pace_s_per_km: r1(basePace), best_pace_s_per_km: r1(basePace - 40),
    hr: { avg: 152, max: 178 }, cadence_avg: 176, stride_m_avg: 1.12, power_w_avg: 280,
    dynamics: { gct_ms: 245, balance_left_pct: 49.8, vertical_oscillation_cm: 8.9, vertical_ratio_pct: 7.8 },
    splits,
    hr_zones: [1, 2, 3, 4, 5].map((zone) => ({ zone, seconds: Math.round(moving / 5) })),
    series: { x_dist_m, x_elapsed_s, pace, hr, elev, cadence, power },
    best_efforts: [
      { distance_m: 1000, label: '1k', time_s: 240, plausible: true },
      { distance_m: 5000, label: '5k', time_s: 1290, plausible: true },
    ],
    flags: {},
  };
  const dir = join(outDir, date.slice(0, 4));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), (process.env.COMPACT ? JSON.stringify(run) : JSON.stringify(run, null, 2)) + '\n');
}
console.log(`wrote ${count} runs (${points} points/series) to ${outDir}`);
