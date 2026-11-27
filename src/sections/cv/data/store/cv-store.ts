// The CV's read interface (specs/004-interactive-cv/research.md R2, R3): loads data/cv/ once, through
// files.ts, and refuses to return anything while any file fails its schema or any item's approval is
// missing or stale. The DataValidationError names file, kind, id and rule, never the text, and stops
// the build before Astro empties dist/ (integration.ts).
import { DataValidationError } from '../../../../shared/storage/index.ts';
import { loadCvData, type CvData } from './files.ts';

export class CvStore {
  readonly #root: string;
  readonly #schemaRoot: string;
  #loaded: { data: CvData | undefined } | undefined;

  /** `root` holds data/cv/; `schemaRoot` holds schemas/ when it lives elsewhere (a copy of the site). */
  constructor(root: string = process.cwd(), schemaRoot: string = root) {
    this.#root = root;
    this.#schemaRoot = schemaRoot;
  }

  /** The approved CV, or undefined when there is none (no data/cv/page.yaml). Throws DataValidationError on any error. */
  load(): CvData | undefined {
    if (this.#loaded) return this.#loaded.data;
    const { data, issues } = loadCvData(this.#root, this.#schemaRoot);
    const errors = issues.filter((issue) => issue.severity === 'error');
    if (errors.length > 0) throw new DataValidationError(errors);
    this.#loaded = { data };
    return data;
  }
}
