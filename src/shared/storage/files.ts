// Reading data files: listing a section's data folder and parsing JSON or owner YAML. A section's
// file map (which file has which schema) uses these, then validates with a SchemaSet.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LineCounter, parseDocument, visit, type Document } from 'yaml';

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
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { version: '1.2', schema: 'core', uniqueKeys: true, prettyErrors: true, lineCounter });
  const problem = doc.errors[0];
  if (problem) {
    const line = problem.linePos?.[0]?.line;
    const reason = problem.message.split('\n')[0]!.replace(/ at line \d+, column \d+:?$/, '');
    return { error: `is not valid YAML${line ? ` (line ${line})` : ''}: ${reason}` };
  }
  const alias = unresolvedAliasLine(doc, lineCounter);
  if (alias !== undefined) return { error: `is not valid YAML (line ${alias}): ${UNRESOLVED_ALIAS}` };
  try {
    return { value: doc.toJS({ maxAliasCount: 50 }) ?? null };
  } catch {
    // The library throws rather than reports some problems (too many aliases), and its message can
    // quote the file, which may be unpublished text: say what's wrong without it.
    return { error: 'is not valid YAML: its aliases (*…) could not be resolved' };
  }
}

/**
 * `*word` at the start of a value (Markdown emphasis, say) is a YAML alias. One naming no anchor
 * isn't in `doc.errors`: the library throws when converting, quoting the name, which in a story
 * file is a word of its text (spec 003 FR-035, found by its graduation review). So it's found
 * first and reported by its line only.
 */
export const UNRESOLVED_ALIAS = 'an alias (*…) names no anchor; put quotes around a value that starts with *';

function unresolvedAliasLine(doc: Document, lineCounter: LineCounter): number | undefined {
  let line: number | undefined;
  visit(doc, {
    Alias(_, node) {
      if (node.resolve(doc) !== undefined) return undefined;
      line = lineCounter.linePos(node.range?.[0] ?? 0).line;
      return visit.BREAK;
    },
  });
  return line;
}
