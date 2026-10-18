// A throwaway repo root for tests: the real schemas/, plus whatever data files a test writes.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '../..');

export interface TempRepo {
  root: string;
  write(path: string, content: string | object): void;
  cleanup(): void;
}

export function tempRepo(): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'aw-repo-'));
  // A junction on Windows (no symlink privilege needed); the type is ignored elsewhere.
  symlinkSync(join(REPO_ROOT, 'schemas'), join(root, 'schemas'), 'junction');
  return {
    root,
    write(path, content) {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** A valid published run; override any field. */
export function run(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    id,
    date: id.slice(0, 10),
    type: 'road',
    treadmill: false,
    is_race: false,
    title: 'Run · 5.0 km',
    distance_m: 5000,
    moving_s: 1500,
    elapsed_s: 1520,
    avg_pace_s_per_km: 300,
    best_pace_s_per_km: 280,
    splits: [],
    series: { x_dist_m: [0], x_elapsed_s: [0], pace: [null] },
    best_efforts: [],
    flags: {},
    ...extra,
  };
}

export const runPath = (id: string) => `data/running/published/runs/${id.slice(0, 4)}/${id}.json`;
