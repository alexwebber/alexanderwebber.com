// Loads schemas/** into one ajv instance and turns ajv errors into owner-readable issues.
// schemas/ is the single source of truth (Python validates against the same files).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';

export const SCHEMA_NAMES = [
  'published/run',
  'published/race-track',
  'published/health-series',
  'published/refresh',
  'published/manifest',
  'owner/section',
  'owner/goals',
  'owner/upcoming-races',
  'owner/race',
  'owner/run-overrides',
  'owner/health-exclusions',
  'owner/lab',
  'owner/manual-metrics',
] as const;
export type SchemaName = (typeof SCHEMA_NAMES)[number];

const SCHEMA_BASE = 'https://alexanderwebber.com/schemas/';

/** One problem found in one file. `path` is the JSON path inside the file (e.g. [0, 'target', 'time']). */
export interface SchemaIssue {
  path: (string | number)[];
  message: string;
}

export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export class SchemaSet {
  readonly #ajv: Ajv2020;
  readonly #validators = new Map<SchemaName, ValidateFunction>();

  constructor(schemaDir: string) {
    this.#ajv = new Ajv2020({
      strict: true,
      // oneOf branches name fields declared on their parent schema; that is intended.
      strictRequired: false,
      allErrors: true,
      verbose: true,
      strictNumbers: true,
      discriminator: true,
      useDefaults: true,
    });
    // Annotations only: x-error carries the owner-facing message, tsType steers gen-types.
    this.#ajv.addVocabulary(['x-error', 'tsType']);
    this.#ajv.addFormat('date', isValidDate);
    for (const file of listSchemaFiles(schemaDir)) {
      this.#ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, file), 'utf8')));
    }
    for (const name of SCHEMA_NAMES) {
      const validate = this.#ajv.getSchema(`${SCHEMA_BASE}${name}.schema.json`);
      if (!validate) throw new Error(`schema ${name} not found in ${schemaDir}`);
      this.#validators.set(name, validate);
    }
  }

  /** Validates (and, for owner schemas, fills defaults into) `data`. Returns no issues when valid. */
  validate(name: SchemaName, data: unknown): SchemaIssue[] {
    const validate = this.#validators.get(name)!;
    if (validate(data)) return [];
    return toIssues(validate.errors ?? []);
  }
}

/** Every *.schema.json under `dir`, as paths relative to it. */
export function listSchemaFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.schema.json'))
    .map((f) => f.split('\\').join('/'))
    .sort();
}

function pointerToPath(pointer: string): (string | number)[] {
  if (pointer === '') return [];
  return pointer
    .slice(1)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

function describe(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function ownMessage(error: ErrorObject): string | undefined {
  const custom = (error.parentSchema as Record<string, unknown> | undefined)?.['x-error'];
  return typeof custom === 'string' ? custom : undefined;
}

const within = (inner: string, outer: string) => inner === outer || inner.startsWith(`${outer}/`);

/**
 * Collapses ajv's raw errors into one message per problem:
 * - unknown and missing fields are named, with the path pointing at the field;
 * - an anyOf/oneOf whose schema has `x-error` speaks for its branches, so the owner sees one
 *   sentence, not five. ajv reports a composite's branch errors directly before the composite
 *   error itself (schemaPath restarts at every $ref, so it can't be used to match them).
 */
export function toIssues(errors: ErrorObject[]): SchemaIssue[] {
  const suppressed = new Set<number>();
  errors.forEach((error, i) => {
    const composite = error.keyword === 'anyOf' || error.keyword === 'oneOf';
    if (!composite) return;
    let j = i - 1;
    let branchErrors = 0;
    while (j >= 0 && within(errors[j]!.instancePath, error.instancePath)) {
      if (ownMessage(error)) suppressed.add(j);
      branchErrors++;
      j--;
    }
    // Without its own message the composite's "must match a schema in anyOf" adds nothing.
    if (!ownMessage(error) && branchErrors > 0) suppressed.add(i);
  });

  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  const add = (path: (string | number)[], message: string) => {
    const key = `${JSON.stringify(path)} ${message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push({ path, message });
    }
  };

  errors.forEach((error, i) => {
    if (suppressed.has(i)) return;
    const path = pointerToPath(error.instancePath);
    const params = error.params as Record<string, unknown>;
    switch (error.keyword) {
      case 'if': // the failing "then" branch reports the real problem
      case 'propertyNames': // the inner error names the property
        return;
      case 'additionalProperties':
        add([...path, String(params.additionalProperty)], 'is not a known field (check the spelling)');
        return;
      case 'required':
        add([...path, String(params.missingProperty)], 'is required');
        return;
      case 'discriminator': {
        const tag = String(params.tag);
        const value = (error.data as Record<string, unknown> | undefined)?.[tag];
        if (value === undefined) return; // "is required" already says it
        add([...path, tag], `${describe(value)} ${ownMessage(error) ?? 'is not an allowed value'}`);
        return;
      }
      case 'false schema':
        add(path, 'is not allowed here');
        return;
      case 'enum':
      case 'const':
        if (!ownMessage(error)) {
          const allowed = error.keyword === 'enum' ? (params.allowedValues as unknown[]) : [params.allowedValue];
          add(path, `${describe(error.data)} is not allowed (expected ${allowed.map(describe).join(', ')})`);
          return;
        }
    }
    const propertyName = (error as ErrorObject & { propertyName?: string }).propertyName;
    const at = propertyName === undefined ? path : [...path, propertyName];
    const value = propertyName ?? error.data;
    const shown = value !== undefined && (typeof value !== 'object' || value === null) ? `${describe(value)} ` : '';
    add(at, `${shown}${ownMessage(error) ?? error.message ?? 'is invalid'}`);
  });
  return issues;
}
