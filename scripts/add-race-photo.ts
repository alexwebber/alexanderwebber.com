// Adds a photo to a race (T127; FR-055, research R7). Photos enter the repo only through here:
// sharp applies the EXIF orientation, caps the long edge at 2,400 px and writes a fresh file with
// no metadata at all (EXIF holds GPS; XMP, IPTC and comments go too). The photo lands beside the
// race's race.yaml (data/running/owner/races/<slug>/), and a `photos` entry is appended with the
// required description (the alt text) and an optional caption. The written file is checked again
// before race.yaml changes, and scan-images re-checks every image in the gate. The strip, rotate and
// resize steps and the re-check are scripts/lib/photo.ts, shared with add-chapter-photo.ts (spec 003).
//
//   node scripts/add-race-photo.ts <photo> --race=<slug> --description="Alex crossing the line"
//     [--caption="Mile 26"] [--name=finish.jpg]
//
// JPEG, WebP and AVIF keep their format; anything else sharp reads (HEIC, PNG, TIFF) becomes JPEG.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseDocument, YAMLSeq } from 'yaml';
import { outputName, PhotoError, readSource, stripPhoto, writeStripped } from './lib/photo.ts';
import { isMain } from './lib/walk.ts';

export { PhotoError };

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

  const stripped = await stripPhoto(readSource(options.source), format);
  await writeStripped(target, stripped, `${folder}/${name}`);

  const entry = { file: name, description, ...(options.caption?.trim() ? { caption: options.caption.trim() } : {}) };
  if (photos instanceof YAMLSeq) photos.add(doc.createNode(entry));
  else doc.set('photos', doc.createNode([entry]));
  writeFileSync(yamlFile, doc.toString());
  return { file: `${folder}/${name}`.replaceAll('\\', '/'), width: stripped.width, height: stripped.height };
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
