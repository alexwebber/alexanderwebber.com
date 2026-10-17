import { afterEach, describe, expect, it } from 'vitest';
import { checkBoundaries, importsOf } from '../../scripts/check-boundaries.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

describe('check-boundaries', () => {
  it('finds static, re-export and dynamic imports', () => {
    expect(
      importsOf(`import a from './a.ts';\nimport type { B } from "../b.ts";\nimport './c.css';\nexport { d } from './d.ts';\nconst e = await import('./e.ts');`),
    ).toEqual(['./a.ts', '../b.ts', './c.css', './d.ts', './e.ts']);
  });

  it('allows sections to use shared plumbing and themselves', () => {
    repo = tempRepo();
    repo.write('src/sections/running/pages/a.astro', "---\nimport Base from '../../../shared/layout/Base.astro';\nimport { x } from '../domain/x.ts';\n---\n");
    repo.write('src/shared/format/a.ts', "import { y } from '../storage/index.ts';\n");
    expect(checkBoundaries(repo.root)).toEqual([]);
  });

  it('rejects shared -> section and section -> section imports', () => {
    repo = tempRepo();
    repo.write('src/shared/layout/Nav.ts', "import { routes } from '../../sections/running/integration.ts';\n");
    repo.write('src/sections/cv/pages/a.ts', "import { goals } from '../../running/domain/goals.ts';\n");
    expect(checkBoundaries(repo.root)).toEqual([
      { file: 'src/sections/cv/pages/a.ts', specifier: '../../running/domain/goals.ts', message: 'section "cv" must not import section "running"' },
      { file: 'src/shared/layout/Nav.ts', specifier: '../../sections/running/integration.ts', message: 'shared plumbing must not import section "running"' },
    ]);
  });
});
