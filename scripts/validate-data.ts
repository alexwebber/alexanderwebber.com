// Validates every section's data files (T038, FR-070): each section checks its own schemas and
// references. Prints file/entry/field messages and exits non-zero on any error, so the gate stops
// before anything deploys.
//
//   node scripts/validate-data.ts [--today=YYYY-MM-DD]
import { resolve } from 'node:path';
import { formatIssue, type DataIssue } from '../src/shared/storage/index.ts';
import { DATA_DIR as RUNNING_DATA_DIR } from '../src/sections/running/data/store/files.ts';
import { validateRunning, type ValidateOptions } from '../src/sections/running/validate.ts';
import { isMain } from './lib/walk.ts';

/** Each section's data folder and validator. */
const SECTIONS: { dataDir: string; validate: (root: string, options: ValidateOptions) => DataIssue[] }[] = [
  { dataDir: RUNNING_DATA_DIR, validate: validateRunning },
];

/** Every section's issues, errors and warnings, in section order. */
export function validateData(root: string, options: ValidateOptions = {}): DataIssue[] {
  return SECTIONS.flatMap((section) => section.validate(root, options));
}

function main(): void {
  const todayArg = process.argv.find((a) => a.startsWith('--today='))?.slice('--today='.length);
  const root = resolve(import.meta.dirname, '..');
  let failed = false;
  for (const section of SECTIONS) {
    const issues = section.validate(root, { today: todayArg });
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    for (const issue of warnings) console.warn(`warning: ${formatIssue(issue)}`);
    for (const issue of errors) console.error(`error: ${formatIssue(issue)}`);
    console.log(`validate-data: ${section.dataDir}: ${errors.length} error(s), ${warnings.length} warning(s)`);
    failed ||= errors.length > 0;
  }
  if (failed) process.exit(1);
}

if (isMain(import.meta.url)) main();
