// Image metadata gate (T040): no EXIF, XMP, IPTC or text metadata (GPS lives in EXIF) in any
// image under data/, src/ or public/; owner race photos are .jpg/.webp/.avif with a long edge of
// at most 2400 px. Photos are stripped before they are committed (add-race-photo), so a hit here
// means a photo skipped that step.
//
//   node scripts/scan-images.ts
import { resolve } from 'node:path';
import sharp from 'sharp';
import { isMain, walk } from './lib/walk.ts';

export const IMAGE = /\.(jpe?g|png|webp|avif|gif|tiff?|heic|heif)$/i;
const OWNER_PHOTO_DIR = 'data/running/owner/';
const OWNER_PHOTO = /\.(jpg|webp|avif)$/;
const MAX_LONG_EDGE = 2400;

export interface ImageFinding {
  file: string;
  message: string;
}

/** Metadata kinds present in an image (empty when clean). */
export async function metadataKinds(path: string): Promise<string[]> {
  const meta = await sharp(path).metadata();
  const kinds: string[] = [];
  if (meta.exif?.length) kinds.push('EXIF');
  if (meta.xmp?.length) kinds.push('XMP');
  if (meta.iptc?.length) kinds.push('IPTC');
  if (meta.comments?.length) kinds.push('text comments');
  return kinds;
}

export async function scanImageFiles(root: string, files: string[]): Promise<ImageFinding[]> {
  const findings: ImageFinding[] = [];
  for (const file of files) {
    const path = resolve(root, file);
    const isOwnerPhoto = file.startsWith(OWNER_PHOTO_DIR);
    if (isOwnerPhoto && !OWNER_PHOTO.test(file)) {
      findings.push({ file, message: 'owner photos must be .jpg, .webp or .avif' });
      continue;
    }
    try {
      const kinds = await metadataKinds(path);
      if (kinds.length > 0) findings.push({ file, message: `contains ${kinds.join(', ')} metadata (strip it before committing)` });
      if (isOwnerPhoto) {
        const { width = 0, height = 0 } = await sharp(path).metadata();
        if (Math.max(width, height) > MAX_LONG_EDGE) {
          findings.push({ file, message: `is ${width}x${height}; the long edge must be at most ${MAX_LONG_EDGE} px` });
        }
      }
    } catch (error) {
      findings.push({ file, message: `could not be read as an image: ${(error as Error).message}` });
    }
  }
  return findings;
}

export async function scanImages(root: string): Promise<ImageFinding[]> {
  const files = ['data', 'src', 'public'].flatMap((dir) => walk(root, dir)).filter((f) => IMAGE.test(f));
  return scanImageFiles(root, files);
}

if (isMain(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const findings = await scanImages(root);
  for (const f of findings) console.error(`error: ${f.file}: ${f.message}`);
  console.log(`scan-images: ${findings.length} problem(s)`);
  if (findings.length > 0) process.exit(1);
}
