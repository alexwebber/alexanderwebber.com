// Contract tests for schemas/ (T083): the shared fixtures (also run by ingest's pytest, T082)
// and structural rules every schema must keep.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { RUNNING_SCHEMAS as SCHEMA_NAMES } from '../../src/sections/running/data/store/schemas.ts';
import { DISTANCES_M } from '../../src/sections/running/domain/distances.ts';
import { SchemaSet, listSchemaFiles } from '../../src/shared/storage/schemas.ts';
import { walk } from '../../scripts/lib/walk.ts';
import { REPO_ROOT } from '../helpers/temp-repo.ts';

const schemas = new SchemaSet(join(REPO_ROOT, 'schemas'), SCHEMA_NAMES);
const fixtures = walk(REPO_ROOT, 'schemas/fixtures');

function load(file: string): unknown {
  const text = readFileSync(join(REPO_ROOT, file), 'utf8');
  return file.endsWith('.json') ? JSON.parse(text) : parse(text, { version: '1.2', schema: 'core' });
}

describe('shared fixtures', () => {
  for (const name of SCHEMA_NAMES) {
    const valid = fixtures.filter((f) => f.startsWith(`schemas/fixtures/${name}/valid/`));
    const invalid = fixtures.filter((f) => f.startsWith(`schemas/fixtures/${name}/invalid/`));

    it(`${name} has valid and invalid fixtures`, () => {
      expect(valid.length).toBeGreaterThan(0);
      expect(invalid.length).toBeGreaterThan(0);
    });
    for (const file of valid) {
      it(`accepts ${file.slice('schemas/fixtures/'.length)}`, () => {
        expect(schemas.validate(name, load(file))).toEqual([]);
      });
    }
    for (const file of invalid) {
      it(`rejects ${file.slice('schemas/fixtures/'.length)}`, () => {
        expect(schemas.validate(name, load(file)).length).toBeGreaterThan(0);
      });
    }
  }

  it('every fixture belongs to a known schema', () => {
    const known = new RegExp(`^schemas/fixtures/(${SCHEMA_NAMES.join('|')})/(valid|invalid)/[^/]+\\.(json|yaml)$`);
    expect(fixtures.filter((f) => !known.test(f))).toEqual([]);
  });
});

/** Calls `visit` with every object inside `value` (including `value` itself). */
function eachObject(value: unknown, visit: (obj: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) value.forEach((v) => eachObject(v, visit));
  else if (value !== null && typeof value === 'object') {
    visit(value as Record<string, unknown>);
    Object.values(value).forEach((v) => eachObject(v, visit));
  }
}

/** Every variant of `doc` with `key` added to one of its objects. */
function withKeyInjected(doc: unknown, key: string): unknown[] {
  let count = 0;
  eachObject(doc, () => count++);
  return Array.from({ length: count }, (_, target) => {
    const copy = structuredClone(doc);
    let i = 0;
    eachObject(copy, (obj) => {
      if (i++ === target) obj[key] = key === 'latlng' ? [[50.8, -0.1]] : 50.8;
    });
    return copy;
  });
}

describe('privacy by construction', () => {
  const banned = ['lat', 'lon', 'latlng', 'latitude', 'longitude', 'start_time', 'startTime'];
  const published = SCHEMA_NAMES.filter((n) => n.startsWith('published/') && n !== 'published/race-track');

  for (const name of published) {
    const docs = fixtures.filter((f) => f.startsWith(`schemas/fixtures/${name}/valid/`)).map(load);
    it(`${name}: no coordinate or start-time key validates anywhere`, () => {
      for (const doc of docs) {
        for (const key of banned) {
          for (const variant of withKeyInjected(doc, key)) {
            expect(schemas.validate(name, variant), `${key} accepted`).not.toEqual([]);
          }
        }
      }
    });
  }

  it('published/run: no name or description key validates anywhere', () => {
    const docs = fixtures.filter((f) => f.startsWith('schemas/fixtures/published/run/valid/')).map(load);
    for (const doc of docs) {
      for (const key of ['name', 'description']) {
        for (const variant of withKeyInjected(doc, key)) {
          expect(schemas.validate('published/run', variant), `${key} accepted`).not.toEqual([]);
        }
      }
    }
  });
});

describe('schema structure', () => {
  const files = listSchemaFiles(join(REPO_ROOT, 'schemas'));

  it('every object schema is closed (additionalProperties false, or a map with propertyNames)', () => {
    const open: string[] = [];
    for (const file of files) {
      const visit = (node: unknown, path: string) => {
        if (node === null || typeof node !== 'object') return;
        const schema = node as Record<string, unknown>;
        // Refinements (if/then, allOf) and oneOf wrappers constrain a schema that is closed itself.
        const refinement = /\/(allOf|if|then|else|not)\//.test(`${path}/`);
        const wrapper = schema.properties === undefined && (schema.oneOf !== undefined || schema.anyOf !== undefined);
        if (schema.type === 'object' && !refinement && !wrapper) {
          const ap = schema.additionalProperties;
          const isMap = ap !== undefined && typeof ap === 'object' && schema.propertyNames !== undefined;
          if (ap !== false && !isMap) open.push(`${file}#${path}`);
        }
        for (const [k, v] of Object.entries(schema)) {
          if (k !== 'default' && k !== 'const' && k !== 'enum') visit(v, `${path}/${k}`);
        }
      };
      visit(JSON.parse(readFileSync(join(REPO_ROOT, 'schemas', file), 'utf8')), '');
    }
    expect(open).toEqual([]);
  });

  it('every file schema uses draft 2020-12 and requires schema_version when published', () => {
    for (const name of SCHEMA_NAMES) {
      const schema = JSON.parse(readFileSync(join(REPO_ROOT, 'schemas', `${name}.schema.json`), 'utf8'));
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      if (name.startsWith('published/')) expect(schema.required).toContain('schema_version');
    }
  });

  it('the health-series metric list is exactly the approved one', () => {
    const schema = JSON.parse(readFileSync(join(REPO_ROOT, 'schemas/published/health-series.schema.json'), 'utf8'));
    expect([...schema.properties.metric.enum].sort()).toEqual(
      ['body_fat_pct', 'fatigue_atl', 'fitness_ctl', 'hrv', 'resting_hr', 'vo2max', 'weight_avg7'].sort(),
    );
  });

  it('the distance names are exactly those in distances.json, which ingest reads too', () => {
    const defs = JSON.parse(readFileSync(join(REPO_ROOT, 'schemas/defs.schema.json'), 'utf8'));
    const names = Object.keys(DISTANCES_M);
    expect(defs.$defs.distanceName.enum).toEqual(names);
    // The owner-facing messages list the names too.
    const expected = `is not a known distance (expected ${names.slice(0, -1).join(', ')}, ${names.at(-1)}, or metres)`;
    expect(defs.$defs.distanceName['x-error']).toBe(expected);
    expect(defs.$defs.distance['x-error']).toBe(expected);
  });
});
