// Writes the CV preview's data trees (spec 004 T056; contracts/routes.md, test-only routes): one per
// made-up export in tests/fixtures/cv-export/, imported through the real import (scripts/import-cv.ts
// with --root), so the previews carry the approvals the import writes and pass the same checks as
// real data. Output: tests/fixtures/cv-preview/data/<state>/data/cv/ (CvStore expects
// <root>/data/cv/). The SHELL_PREVIEW=1 build renders each at /cv-preview/<state>/ through the real
// CvPage. Deterministic (the exports are, and the import writes no clock time); the output is
// committed. Every word is made up.
//
//   node tests/fixtures/cv-preview/generate.ts
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { importCv } from '../../../scripts/import-cv.ts';
import { RULES_CONFIRMED } from '../../helpers/cv.ts';
import { PREVIEW_STATES } from './store.ts';

const HERE = import.meta.dirname;
const DATA = resolve(HERE, 'data');
rmSync(DATA, { recursive: true, force: true });

for (const state of PREVIEW_STATES) {
  const result = importCv({ from: join(HERE, '..', 'cv-export', state, 'export.json'), rulesChecked: RULES_CONFIRMED, root: join(DATA, state) });
  if (!result.ok) throw new Error(`cv-preview ${state}: the import refused it:\n${result.lines.join('\n')}`);
  console.log(`cv-preview: ${state}`);
}
