// The photo pipeline shared by scripts/add-race-photo.ts and scripts/add-chapter-photo.ts (spec 003
// research.md R10; spec 001 FR-055): the output file's name and format, then sharp applies the EXIF
// orientation, caps the long edge at 2,400 px and writes a fresh file with no metadata at all (EXIF
// holds GPS; XMP, IPTC and comments go too), and the written file is checked again before the caller
// lists it. scan-images re-checks every image in the gate.
//
// sharp is given the file's bytes, never its path: given a path, its cache keeps the file open on
// Windows, so a caller in the same process (a test's temporary folder) couldn't delete it.
//
// JPEG, WebP and AVIF keep their format; anything else sharp reads (HEIC, PNG, TIFF) becomes JPEG.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import sharp from 'sharp';
import { MAX_LONG_EDGE, metadataKinds } from '../scan-images.ts';

export type PhotoFormat = 'jpeg' | 'webp' | 'avif';

const KEPT_FORMATS: Record<string, PhotoFormat> = { jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', avif: 'avif' };
/** A photo's file name in the repo: the race and chapter schemas' pattern. */
export const PHOTO_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|webp|avif)$/;

/** A refusal the command line prints as `error: <message>`. Messages never quote alt text or captions. */
export class PhotoError extends Error {}

/** The written file's name (from `name`, else the source's, lower case, .jpg for JPEG) and format. */
export function outputName(source: string, name: string | undefined): { name: string; format: PhotoFormat } {
  const ext = extname(name ?? source).slice(1).toLowerCase();
  const format = KEPT_FORMATS[ext] ?? 'jpeg';
  const stem = basename(name ?? source, extname(name ?? source))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '');
  const out = `${stem || 'photo'}.${format === 'jpeg' ? 'jpg' : format}`;
  if (!PHOTO_FILE_NAME.test(out)) throw new PhotoError(`"${out}" is not a valid photo file name (expected e.g. finish.jpg)`);
  return { name: out, format };
}

export interface StrippedPhoto {
  /** The encoded photo: upright, capped, no metadata. */
  data: Buffer;
  width: number;
  height: number;
}

/** The source file's bytes. A missing file refuses as sharp would have, given its path. */
export function readSource(source: string): Buffer {
  if (!existsSync(source)) throw new Error(`Input file is missing: ${source}`);
  return readFileSync(source);
}

/** Applies the EXIF orientation, caps the long edge and encodes in `format`, with no metadata. */
export async function stripPhoto(input: Buffer, format: PhotoFormat): Promise<StrippedPhoto> {
  // rotate() with no angle applies the EXIF orientation; sharp writes no metadata unless asked.
  const pipeline = sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true });
  const output = format === 'jpeg' ? pipeline.jpeg({ quality: 85, mozjpeg: true }) : format === 'webp' ? pipeline.webp({ quality: 85 }) : pipeline.avif({ quality: 60 });
  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Writes the stripped photo to `target`, then checks the written file again: any metadata left and
 * the file is removed and the photo refused. `label` names it in the refusal (repo-relative).
 */
export async function writeStripped(target: string, photo: StrippedPhoto, label: string): Promise<void> {
  writeFileSync(target, photo.data);
  const kinds = await metadataKinds(target);
  if (kinds.length > 0) {
    rmSync(target);
    throw new PhotoError(`${label} still has ${kinds.join(', ')} metadata; it was not added`);
  }
}
