// Reading data files: listing a section's data folder and parsing JSON or owner YAML. A section's
// file map (which file has which schema) uses these, then validates with a SchemaSet.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

/** Every file under `<root>/<dir>`, repo-relative with `/` separators, sorted. Empty when `dir` is absent. */
export function listDataFiles(root: string, dir: string): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true, encoding: 'utf8' })
    .map((f) => `${dir}/${f.split('\\').join('/')}`)
    .filter((f) => statSync(join(root, f)).isFile())
    .sort();
}

/** Parses JSON or YAML 1.2 (so `3:30:00` and `2027-04-04` stay strings). Null for an empty document. */
export function parseDataFile(file: string, text: string): { value: unknown } | { error: string } {
  if (file.endsWith('.json')) {
    try {
      return { value: JSON.parse(text) };
    } catch (error) {
      return { error: `is not valid JSON: ${(error as Error).message}` };
    }
  }
  const doc = parseDocument(text, { version: '1.2', schema: 'core', uniqueKeys: true, prettyErrors: true });
  const problem = doc.errors[0];
  if (problem) {
    const line = problem.linePos?.[0]?.line;
    const reason = problem.message.split('\n')[0]!.replace(/ at line \d+, column \d+:?$/, '');
    return { error: `is not valid YAML${line ? ` (line ${line})` : ''}: ${reason}` };
  }
  return { value: doc.toJS({ maxAliasCount: 50 }) ?? null };
}
