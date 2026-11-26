// The CV's schemas (spec 004, T025): the seven `when` forms, the approval block, the enums, the
// theme count, stories only on value blocks, the PDF names per kind, approved_on optional in the
// export, and no text budget in any schema (src/sections/cv/domain/budgets.ts owns them, so the
// message can give the count). Made-up values only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CV_SCHEMAS } from '../../src/sections/cv/data/store/schemas.ts';
import { SchemaSet } from '../../src/shared/storage/schemas.ts';
import { REPO_ROOT } from '../helpers/temp-repo.ts';

const schemas = new SchemaSet(join(REPO_ROOT, 'schemas'), CV_SCHEMAS);
type Doc = Record<string, any>;
const fixture = (path: string): Doc => {
  const text = readFileSync(join(REPO_ROOT, 'schemas/fixtures/cv', path), 'utf8');
  return path.endsWith('.json') ? JSON.parse(text) : parse(text, { version: '1.2', schema: 'core' });
};
const timeline = () => fixture('timeline/valid/full.yaml');

describe('when', () => {
  const withWhen = (when: string) => {
    const doc = timeline();
    doc.changes[0].when = when;
    return schemas.validate('cv/timeline', doc);
  };
  for (const when of ['2014', '~2014', '2013–2016', '2013–now', '2026 Oct', '2026 Feb–May', '2025–2026 Mar']) {
    it(`accepts ${when}`, () => expect(withWhen(when)).toEqual([]));
  }
  for (const when of ['2013-2016', '2013 – 2016', '2026 Sept', '2026 oct', '~2014–2016', '2014-03-01', '2014–', 'now', '2013–Now', '201', '2026 Oct–']) {
    it(`refuses ${when}`, () => expect(withWhen(when)).toHaveLength(1));
  }
});

describe('approval', () => {
  const withApproval = (approved: unknown) => {
    const doc = timeline();
    doc.themes[0].approved = approved;
    return schemas.validate('cv/timeline', doc);
  };
  const good = { date: '2026-12-01', source: '0a1b2c3', sha256: 'a'.repeat(64) };
  it('takes date, source and sha256', () => expect(withApproval(good)).toEqual([]));
  it('takes a 40-hex source', () => expect(withApproval({ ...good, source: 'f'.repeat(40) })).toEqual([]));
  for (const [what, value] of [
    ['a 6-hex source', { ...good, source: '0a1b2c' }],
    ['a 41-hex source', { ...good, source: 'f'.repeat(41) }],
    ['a short sha256', { ...good, sha256: 'a'.repeat(63) }],
    ['an upper-case sha256', { ...good, sha256: 'A'.repeat(64) }],
    ['an impossible date', { ...good, date: '2026-02-30' }],
    ['no source', { date: good.date, sha256: good.sha256 }],
    ['an extra key', { ...good, by: 'someone' }],
  ] as const) {
    it(`refuses ${what}`, () => expect(withApproval(value).length).toBeGreaterThan(0));
  }
});

describe('enums and counts', () => {
  it('refuses an unknown block kind and lane colour', () => {
    const blocks = fixture('blocks/valid/full.yaml');
    blocks.blocks[2].kind = 'hobbies';
    expect(schemas.validate('cv/blocks', blocks)).toHaveLength(1);
    const doc = timeline();
    doc.themes[0].colour = 'red';
    expect(schemas.validate('cv/timeline', doc)).toHaveLength(1);
  });

  it('takes one to eight themes, not none or nine', () => {
    const theme = (i: number) => ({ ...timeline().themes[0], id: `theme-${i}` });
    for (const n of [1, 8]) expect(schemas.validate('cv/timeline', { ...timeline(), themes: Array.from({ length: n }, (_, i) => theme(i)) })).toEqual([]);
    for (const n of [0, 9]) expect(schemas.validate('cv/timeline', { ...timeline(), themes: Array.from({ length: n }, (_, i) => theme(i)) })).toHaveLength(1);
  });

  it('allows stories on a value block only', () => {
    const blocks = fixture('blocks/valid/full.yaml');
    expect(schemas.validate('cv/blocks', blocks)).toEqual([]);
    for (const kind of ['pitch', 'future', 'skills', 'public', 'education', 'other']) {
      const copy = structuredClone(blocks);
      copy.blocks[1].kind = kind;
      expect(schemas.validate('cv/blocks', copy), kind).toEqual([{ path: ['blocks', 1], message: 'has stories, which only a value block may have' }]);
    }
  });
});

describe('downloads', () => {
  it('names each kind\'s PDF one way (owner decision 6)', () => {
    const doc = fixture('downloads/valid/full.yaml');
    expect(schemas.validate('cv/downloads', doc)).toEqual([]);
    const swapped = structuredClone(doc);
    swapped.downloads[0].file = 'alexander-webber-cv-visual.pdf';
    swapped.downloads[1].file = 'alexander-webber-cv.pdf';
    expect(schemas.validate('cv/downloads', swapped)).toHaveLength(2);
  });
});

describe('export', () => {
  it('takes items without approved_on, so the import can refuse them by name', () => {
    const doc = fixture('export/valid/full.json');
    doc.timeline.changes.forEach((c: Doc) => delete c.approved_on);
    delete doc.page.approved_on;
    delete doc.page.sharing_rules_confirmed;
    expect(schemas.validate('cv/export', doc)).toEqual([]);
  });

  it('refuses an approval block, which only the import writes', () => {
    const doc = fixture('export/valid/full.json');
    doc.blocks[0].approved = { date: '2026-12-01', source: '0a1b2c3', sha256: 'a'.repeat(64) };
    expect(schemas.validate('cv/export', doc)).toHaveLength(1);
  });
});

describe('budgets', () => {
  it('no CV schema carries a text budget: only ids have a length limit', () => {
    const limited: string[] = [];
    for (const name of CV_SCHEMAS) {
      const visit = (node: unknown, path: string) => {
        if (node === null || typeof node !== 'object') return;
        const schema = node as Record<string, unknown>;
        if ('maxLength' in schema && !path.endsWith('/$defs/id')) limited.push(`${name}${path}`);
        for (const [k, v] of Object.entries(schema)) visit(v, `${path}/${k}`);
      };
      visit(JSON.parse(readFileSync(join(REPO_ROOT, 'schemas', `${name}.schema.json`), 'utf8')), '');
    }
    expect(limited).toEqual([]);
  });
});
