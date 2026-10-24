// Writes the race preview's synthetic data tree (T137): published runs and race tracks, owner race
// entries, upcoming races and photos, under tests/fixtures/race-preview/data/running/. None of it
// is real: the races, names, times and results are made up, the routes are drawn in open sea in
// the Gulf of Guinea, and the photos are generated shapes (given GPS EXIF first, so
// add-race-photo's stripping is exercised). The SHELL_PREVIEW=1 build renders it at
// /race-preview/ through the real race components, so race pages, the map and the gallery are
// tested end to end before the owner has a race. Deterministic; the output is committed.
//
//   node tests/fixtures/race-preview/generate.ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { addRacePhoto } from '../../../scripts/add-race-photo.ts';

const ROOT = resolve(import.meta.dirname);
const DATA = join(ROOT, 'data/running');
const BUILD = join(ROOT, '.photo-src');
rmSync(DATA, { recursive: true, force: true });

const write = (path: string, content: string | object) => {
  const file = join(DATA, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content)}\n`);
};

let seed = 7;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const r1 = (v: number) => Math.round(v * 10) / 10;

interface RunSpec {
  id: string;
  title: string;
  distance_m: number;
  elapsed_s: number;
  is_race: boolean;
  treadmill?: boolean;
  efforts: [label: string, metres: number, seconds: number][];
  track?: { lat: number; lon: number; heading: number };
}

const ZONES = [88, 105, 123, 140, 158, 175];

function run(spec: RunSpec) {
  const moving = spec.elapsed_s - 8;
  const pace = (moving / spec.distance_m) * 1000;
  const n = 300;
  const series: Record<string, (number | null)[]> = { x_dist_m: [], x_elapsed_s: [], pace: [], hr: [], cadence: [], power: [] };
  if (!spec.treadmill) series.elev = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    series.x_dist_m!.push(Math.round(spec.distance_m * f));
    series.x_elapsed_s!.push(Math.round(moving * f));
    series.pace!.push(r1(pace + Math.sin(i / 11) * 8 + (rand() - 0.5) * 6));
    series.hr!.push(Math.round(150 + 14 * f + (rand() - 0.5) * 4));
    series.elev?.push(r1(12 + 9 * Math.sin(f * 6)));
    series.cadence!.push(Math.round(174 + (rand() - 0.5) * 6));
    series.power!.push(Math.round(560 + (rand() - 0.5) * 40));
  }
  const splits = Array.from({ length: Math.ceil(spec.distance_m / 1000) }, (_, k) => {
    const part = Math.min(1000, spec.distance_m - k * 1000);
    const time = Math.round(((pace + (rand() - 0.5) * 10) * part) / 1000);
    return { km: k + 1, time_s: time, pace_s_per_km: r1((time / part) * 1000), hr: Math.round(152 + k * 0.5), ...(spec.treadmill ? {} : { elev_delta_m: r1((rand() - 0.5) * 6) }) };
  });
  const shares = [0.03, 0.12, 0.3, 0.4, 0.15];
  return {
    schema_version: 1,
    id: spec.id,
    date: spec.id.slice(0, 10),
    type: spec.treadmill ? 'indoor' : 'road',
    treadmill: spec.treadmill ?? false,
    is_race: spec.is_race,
    title: spec.title,
    device: 'Venu X1',
    distance_m: spec.distance_m,
    moving_s: moving,
    elapsed_s: spec.elapsed_s,
    ...(spec.treadmill ? {} : { elevation_gain_m: 48, elevation_loss_m: 47 }),
    avg_pace_s_per_km: r1(pace),
    best_pace_s_per_km: r1(pace - 12),
    hr: { avg: 158, max: 176 },
    cadence_avg: 174,
    stride_m_avg: 1.21,
    power_w_avg: 560,
    dynamics: { gct_ms: 238, gct_balance_pct: 50.1, vert_osc_mm: 86, vert_ratio_pct: 7.2 },
    splits,
    hr_zones: shares.map((s, k) => ({ zone: k + 1, low_bpm: ZONES[k], high_bpm: ZONES[k + 1], seconds: Math.round(moving * s) })),
    series,
    best_efforts: spec.efforts.map(([label, distance_m, time_s]) => ({ distance_m, label, time_s, plausible: true })),
    flags: {},
    ...(spec.track ? { track_ref: `race-tracks/${spec.id}` } : {}),
  };
}

/** A synthetic route: a long loop out and back, in open sea (no real place). */
function track(spec: RunSpec) {
  const { lat, lon, heading } = spec.track!;
  const points: [number, number, number, number | null][] = [];
  const count = 900;
  const mPerDeg = 111_195;
  let x = 0;
  let y = 0;
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    const d = spec.distance_m * f;
    const angle = heading + Math.PI * 2 * f + Math.sin(f * 17) * 0.25;
    if (i > 0) {
      const step = spec.distance_m / (count - 1);
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
    }
    points.push([Math.round((lat + y / mPerDeg) * 1e6) / 1e6, Math.round((lon + x / (mPerDeg * Math.cos((lat * Math.PI) / 180))) * 1e6) / 1e6, r1(d), r1(12 + 9 * Math.sin(f * 6))]);
  }
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  return { schema_version: 1, id: spec.id, points, trim_ends_m: 0, bbox: [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)], source: 'intervals' };
}

const runs: RunSpec[] = [
  // US4.3: official 1:41:07, the watch said 1:41:15. Map, three photos.
  { id: '2026-05-17-k3f7', title: 'Riverside Half Marathon', distance_m: 21140, elapsed_s: 6075, is_race: true, efforts: [['1k', 1000, 271], ['5k', 5000, 1415], ['10k', 10000, 2855], ['half', 21097.5, 6062]], track: { lat: 0.3, lon: 0.6, heading: 0.4 } },
  // US4.7: a new PB a week before the preview's "today"; official time.
  { id: '2026-10-18-p2rt', title: 'Harbour 10k', distance_m: 10060, elapsed_s: 2671, is_race: true, efforts: [['1k', 1000, 255], ['5k', 5000, 1318], ['10k', 10000, 2655]], track: { lat: 0.45, lon: 0.75, heading: 2.2 } },
  // A race designated in run-overrides.yaml with no race.yaml: slug = run ID, watch time.
  { id: '2026-03-14-m4qd', title: 'Race · 5.0 km', distance_m: 5030, elapsed_s: 1290, is_race: true, efforts: [['1k', 1000, 248], ['5k', 5000, 1282]], track: { lat: 0.2, lon: 0.45, heading: 1.1 } },
  // A training run with a 5k effort faster than the 5k race (US4.2), in a longer run.
  { id: '2026-09-27-t6nb', title: 'Run · 8.0 km', distance_m: 8000, elapsed_s: 2050, is_race: false, efforts: [['1k', 1000, 240], ['5k', 5000, 1250]] },
  // A treadmill race: labelled, no map, and not PB-eligible (FR-057, FR-058).
  { id: '2026-02-01-w5yz', title: 'Indoor 5k', distance_m: 5000, elapsed_s: 1210, is_race: true, treadmill: true, efforts: [['1k', 1000, 236], ['5k', 5000, 1209]] },
];
for (const spec of runs) {
  write(`published/runs/${spec.id.slice(0, 4)}/${spec.id}.json`, run(spec));
  if (spec.track) write(`published/race-tracks/${spec.id}.json`, track(spec));
}

write('owner/section.yaml', 'focus_race: { race_id: seaside-2027, build_start: 2026-09-05, charity: { name: Example hospice } }\nrecent_highlight_days: { pb: 14, goal: 14 }\n');
write(
  'owner/upcoming-races.yaml',
  [
    '- { id: hilltop-10k, name: Hilltop 10k, date: 2026-12-06, distance: 10k, target_time: "43:00" }',
    '- { id: seaside-2027, name: Seaside Marathon, date: 2027-04-04, distance: marathon, target_time: "3:20:00", url: "https://example.org/seaside" }',
    '- { id: harbour-10k, name: Harbour 10k, date: 2026-10-18, distance: 10k, result_ref: harbour-10k-2026 }',
    '',
  ].join('\n'),
);
write('owner/run-overrides.yaml', '- { id: 2026-03-14-m4qd, is_race: true }\n');
write(
  'owner/races/riverside-half-2026/race.yaml',
  'slug: riverside-half-2026\nrun_id: 2026-05-17-k3f7\nname: Riverside Half Marathon\ndate: 2026-05-17\ndistance: half\nofficial_time: "1:41:07"\nposition: 212\nresults_url: https://example.org/results\nnote: "Synthetic preview race: a negative split into a headwind."\ntrim_ends_m: 200\n',
);
write('owner/races/harbour-10k-2026/race.yaml', 'slug: harbour-10k-2026\nrun_id: 2026-10-18-p2rt\nname: Harbour 10k\ndate: 2026-10-18\ndistance: 10k\nofficial_time: "44:30"\nposition: 57\n');
write('owner/races/indoor-5k-2026/race.yaml', 'slug: indoor-5k-2026\nrun_id: 2026-02-01-w5yz\nname: Indoor 5k\ndate: 2026-02-01\ndistance: 5k\nofficial_time: "20:10"\n');
write('owner/races/2019-example-10k/race.yaml', 'slug: 2019-example-10k\ndate: 2019-10-13\nname: Example 10k\ndistance: 10k\nofficial_time: "52:30"\n');
write('owner/races/2018-coastal-half/race.yaml', 'slug: 2018-coastal-half\ndate: 2018-04-22\nname: Coastal Half\ndistance: half\nofficial_time: "1:55:10"\nposition: 845\n');

// Three photos for the half (US4.5): shapes on a gradient, given GPS EXIF so the strip is real.
mkdirSync(BUILD, { recursive: true });
const photos: [string, string, string | undefined, string][] = [
  ['finish.jpg', 'A runner crossing a finish line under an orange arch', 'The last 100 metres', '#c2410c'],
  ['start.jpg', 'Runners waiting in a start pen', undefined, '#1c5cab'],
  ['medal.jpg', 'A medal on a blue ribbon', 'Medal number three', '#0c7a43'],
];
for (const [name, description, caption, colour] of photos) {
  const source = join(BUILD, name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${colour}"/><stop offset="1" stop-color="#fdf3dc"/></linearGradient></defs><rect width="3000" height="2000" fill="url(#g)"/><circle cx="1500" cy="1000" r="520" fill="#fffdfa" opacity="0.7"/></svg>`;
  await sharp(Buffer.from(svg))
    .withExif({ IFD0: { Make: 'ExamplePhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '0/1 18/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '0/1 36/1 0/1' } })
    .jpeg({ quality: 80 })
    .toFile(source);
  await addRacePhoto({ root: ROOT, source, slug: 'riverside-half-2026', description, ...(caption ? { caption } : {}), name });
}
rmSync(BUILD, { recursive: true, force: true });
console.log('race preview: wrote', DATA);
