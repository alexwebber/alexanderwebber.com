// Adds a photo to a race (T127; FR-055, research R7). Photos enter the repo only through here:
// sharp applies the EXIF orientation, caps the long edge at 2,400 px and writes a fresh file with
// no metadata at all (EXIF holds GPS; XMP, IPTC and comments go too). The photo lands beside the
// race's race.yaml (data/running/owner/races/<slug>/), and a `photos` entry is appended with the
// required description (the alt text) and an optional caption. The written file is checked again
// before race.yaml changes, and scan-images re-checks every image in the gate.
//
//   node scripts/add-race-photo.ts <photo> --race=<slug> --description="Alex crossing the line"
//     [--caption="Mile 26"] [--name=finish.jpg]
//
// JPEG, WebP and AVIF keep their format; anything else sharp reads (HEIC, PNG, TIFF) becomes JPEG.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseDocument, YAMLSeq } from 'yaml';
import { metadataKinds } from './scan-images.ts';
import { isMain } from './lib/walk.ts';

export const MAX_LONG_EDGE = 2400;
const KEPT_FORMATS = { jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', avif: 'avif' } as const;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|webp|avif)$/;

export interface AddPhoto {
  /** Repo root (holding data/). */
  root: string;
  /** The original photo, anywhere on disk. */
  source: string;
  /** The race folder: data/running/owner/races/<slug>/race.yaml must exist. */
  slug: string;
  /** Alternative text: what the photo shows (required, FR-055). */
  description: string;
  caption?: string;
  /** File name in the race folder; defaults to the source's name (lower case, .jpg for JPEG). */
  name?: string;
}

export interface AddedPhoto {
  /** Repo-relative path of the written photo. */
  file: string;
  width: number;
  height: number;
}

export class PhotoError extends Error {}

function outputName(source: string, name: string | undefined): { name: string; format: 'jpeg' | 'webp' | 'avif' } {
  const ext = extname(name ?? source).slice(1).toLowerCase();
  const format = KEPT_FORMATS[ext as keyof typeof KEPT_FORMATS] ?? 'jpeg';
  const stem = basename(name ?? source, extname(name ?? source))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '');
  const out = `${stem || 'photo'}.${format === 'jpeg' ? 'jpg' : format}`;
  if (!FILE_NAME.test(out)) throw new PhotoError(`"${out}" is not a valid photo file name (expected e.g. finish.jpg)`);
  return { name: out, format };
}

export async function addRacePhoto(options: AddPhoto): Promise<AddedPhoto> {
  const description = options.description.trim();
  if (!description) throw new PhotoError('a description is required: it is the alt text (what the photo shows)');
  const folder = join('data/running/owner/races', options.slug);
  const yamlFile = join(options.root, folder, 'race.yaml');
  if (!existsSync(yamlFile)) throw new PhotoError(`${folder}/race.yaml does not exist: write the race entry first`);
  const { name, format } = outputName(options.source, options.name);
  const target = join(options.root, folder, name);
  if (existsSync(target)) throw new PhotoError(`${folder}/${name} already exists: pass --name to choose another`);

  const doc = parseDocument(readFileSync(yamlFile, 'utf8'), { version: '1.2', schema: 'core' });
  if (doc.errors.length > 0) throw new PhotoError(`${folder}/race.yaml is not valid YAML`);
  const photos = doc.get('photos');
  if (photos !== undefined && !(photos instanceof YAMLSeq)) throw new PhotoError(`${folder}/race.yaml photos is not a list`);
  if ((photos?.toJSON() as { file?: string }[] | undefined)?.some((photo) => photo.file === name)) {
    throw new PhotoError(`${folder}/race.yaml already lists ${name}`);
  }

  // rotate() with no angle applies the EXIF orientation; sharp writes no metadata unless asked.
  const pipeline = sharp(options.source, { failOn: 'error' })
    .rotate()
    .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true });
  const output = format === 'jpeg' ? pipeline.jpeg({ quality: 85, mozjpeg: true }) : format === 'webp' ? pipeline.webp({ quality: 85 }) : pipeline.avif({ quality: 60 });
  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  writeFileSync(target, data);
  const kinds = await metadataKinds(target);
  if (kinds.length > 0) {
    rmSync(target);
    throw new PhotoError(`${folder}/${name} still has ${kinds.join(', ')} metadata; it was not added`);
  }

  const entry = { file: name, description, ...(options.caption?.trim() ? { caption: options.caption.trim() } : {}) };
  if (photos instanceof YAMLSeq) photos.add(doc.createNode(entry));
  else doc.set('photos', doc.createNode([entry]));
  writeFileSync(yamlFile, doc.toString());
  return { file: `${folder}/${name}`.replaceAll('\\', '/'), width: info.width, height: info.height };
}

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

if (isMain(import.meta.url)) {
  const source = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const slug = arg('race');
  const description = arg('description');
  if (!source || !slug || description === undefined) {
    console.error('usage: node scripts/add-race-photo.ts <photo> --race=<slug> --description="..." [--caption="..."] [--name=finish.jpg]');
    process.exit(2);
  }
  try {
    const added = await addRacePhoto({ root: resolve(import.meta.dirname, '..'), source, slug, description, caption: arg('caption'), name: arg('name') });
    console.log(`add-race-photo: wrote ${added.file} (${added.width}x${added.height}, no metadata) and listed it in race.yaml`);
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    process.exit(1);
  }
}
