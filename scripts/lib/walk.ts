// Recursive file listing for the gate scripts: repo-relative, forward slashes, sorted.
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP = new Set(['node_modules', '.git']);

export function walk(root: string, dir: string): string[] {
  const out: string[] = [];
  const visit = (rel: string) => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const path = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) visit(path);
      } else if (entry.isFile()) {
        out.push(path);
      }
    }
  };
  if (existsSync(join(root, dir))) visit(dir);
  return out.sort();
}

/** True when the module at `url` (import.meta.url) is the script Node was started with. */
export function isMain(url: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(resolve(entry)).href === url;
}
