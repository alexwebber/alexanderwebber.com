// Module boundaries (T039, Principle VII): shared plumbing never imports a section, and a section
// never imports another section. Sections may import src/shared/**.
//
//   node scripts/check-boundaries.ts
import { readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { isMain, walk } from './lib/walk.ts';

export interface BoundaryViolation {
  file: string;
  specifier: string;
  message: string;
}

const SOURCE = /\.(ts|tsx|js|mjs|cjs|astro|svelte|vue)$/;
const SPECIFIERS = [
  /\bimport\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g, // import x from '…', import '…'
  /\bexport\s+(?:type\s+)?[^'"`;]*?\s+from\s+['"]([^'"]+)['"]/g, // export … from '…'
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('…')
];

/** The section a repo path belongs to, or "shared", or undefined for anything else. */
function area(path: string): string | undefined {
  if (path.startsWith('src/shared/')) return 'shared';
  return /^src\/sections\/([^/]+)\//.exec(path)?.[1];
}

export function importsOf(source: string): string[] {
  return SPECIFIERS.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1]!));
}

export function checkBoundaries(root: string): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  for (const file of walk(root, 'src').filter((f) => SOURCE.test(f))) {
    const from = area(file);
    if (!from) continue;
    for (const specifier of importsOf(readFileSync(resolve(root, file), 'utf8'))) {
      // Relative specifiers resolve against the file; bare ones (packages) can't cross a boundary.
      const target = specifier.startsWith('.')
        ? posix.normalize(posix.join(dirname(file), specifier))
        : specifier.startsWith('/src/')
          ? specifier.slice(1)
          : undefined;
      if (!target) continue;
      const to = area(target.endsWith('/') ? target : `${target}/`) ?? area(target);
      if (!to || to === from || to === 'shared') continue;
      const message =
        from === 'shared'
          ? `shared plumbing must not import section "${to}"`
          : `section "${from}" must not import section "${to}"`;
      violations.push({ file, specifier, message });
    }
  }
  return violations;
}

if (isMain(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const violations = checkBoundaries(root);
  for (const v of violations) console.error(`error: ${v.file}: imports "${v.specifier}": ${v.message}`);
  console.log(`check-boundaries: ${violations.length} violation(s)`);
  if (violations.length > 0) process.exit(1);
}
