// What a CV approval is tied to (specs/004-interactive-cv/research.md R3, contracts/content-files.md
// *Hashed fields*): the sha256 of the canonical JSON of an item's hashed fields. Pure; the store
// recomputes every hash when it loads and scripts/import-cv.ts writes them.
//
// Exactly what each hash covers, so an approval can be reproduced later:
// - Only the fields named for the item's kind in HASHED_FIELDS, never "everything but approved".
//   A field outside the list (Page.listed, Page.sharing_rules_confirmed, a key added later) doesn't
//   move the hash; a new optional field appended to a list leaves items without it hashing the same.
// - A field absent from the item is absent from the canonical JSON, never null.
// - Canonical JSON: object keys sorted at every level by UTF-16 code unit, no whitespace, every
//   string (keys included) normalised to Unicode NFC, then encoded as UTF-8 for the sha256.
// - A Download hashes {kind, file, title, bytes}, where bytes is the sha256 (64 lower-case hex) of
//   the PDF's bytes, so a PDF swapped under the same name needs a fresh approval.
// - Values are hashed as YAML 1.2 parsed them, so line endings and comments in a file don't count.
import { createHash } from 'node:crypto';

export type CvKind = 'page' | 'block' | 'theme' | 'thread' | 'role' | 'change' | 'next' | 'download';

export const HASHED_FIELDS: Readonly<Record<CvKind, readonly string[]>> = {
  page: ['name', 'headline', 'location', 'title', 'description', 'email_user', 'email_domain', 'linkedin', 'as_of'],
  block: ['id', 'heading', 'kind', 'paragraphs', 'stories'],
  theme: ['id', 'name', 'line', 'colour'],
  thread: ['id', 'name', 'line'],
  role: ['id', 'label', 'when', 'card'],
  change: ['id', 'label', 'when', 'theme', 'thread', 'value', 'card'],
  next: ['id', 'title', 'card'],
  download: ['kind', 'file', 'title'],
};

/** JSON with keys sorted at every level, no whitespace, strings in NFC. Undefined members are left out. */
export function canonicalJson(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k.normalize('NFC'), v] as const);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256Hex = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** The item's hashed fields as hashed, for tests and the import's re-check. */
export function hashedFields(kind: CvKind, item: unknown, pdfBytes?: Uint8Array): Record<string, unknown> {
  const hashed: Record<string, unknown> = {};
  for (const field of HASHED_FIELDS[kind]) {
    const value = at(item, field);
    if (value !== undefined) hashed[field] = value;
  }
  if (kind === 'download') {
    if (!pdfBytes) throw new Error('a download is hashed with its PDF bytes');
    hashed.bytes = sha256Hex(pdfBytes);
  }
  return hashed;
}

/** The sha256 an item's `approved.sha256` must equal. A download needs its PDF's bytes. */
export function itemSha256(kind: CvKind, item: unknown, pdfBytes?: Uint8Array): string {
  return sha256Hex(canonicalJson(hashedFields(kind, item, pdfBytes)));
}

function at(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}
