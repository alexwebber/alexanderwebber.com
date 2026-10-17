// Owner-readable data errors (FR-070): file, entry and field, e.g.
//   data/running/owner/goals.yaml  goal "10k-sub-45"  field target.time: "44:7x" is not a valid time (expected mm:ss or h:mm:ss)

export interface DataIssue {
  /** Repo-relative path. */
  file: string;
  /** Which entry in the file, e.g. `goal "10k-sub-45"`; empty for the file as a whole. */
  entry: string;
  /** Dotted field path inside the entry, e.g. `target.time`; empty for the entry as a whole. */
  field: string;
  message: string;
  /** Warnings are reported but don't fail validation. */
  severity: 'error' | 'warning';
}

export function formatIssue(issue: DataIssue): string {
  const where = [issue.file, issue.entry, issue.field ? `field ${issue.field}` : ''].filter(Boolean).join('  ');
  return `${where}: ${issue.message}`;
}

/** Thrown by JsonFileStore when any file fails validation; the build fails with its message. */
export class DataValidationError extends Error {
  readonly issues: DataIssue[];
  readonly file: string;
  readonly entry: string;
  readonly field: string;

  constructor(issues: DataIssue[]) {
    super(issues.map(formatIssue).join('\n'));
    this.name = 'DataValidationError';
    this.issues = issues;
    const first = issues[0]!;
    this.file = first.file;
    this.entry = first.entry;
    this.field = first.field;
  }
}

/** `["photos", 0, "description"]` -> `photos[0].description` */
export function fieldPath(path: (string | number)[]): string {
  return path.reduce<string>(
    (out, part) => (typeof part === 'number' ? `${out}[${part}]` : out ? `${out}.${part}` : part),
    '',
  );
}
