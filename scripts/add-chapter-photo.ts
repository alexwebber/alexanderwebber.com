// Adds a photo to a chapter of the journey story (spec 003 T063; FR-060 to FR-064, research.md R10).
// Chapter photos enter the repo only through here, by scripts/lib/photo.ts, the race photos' pipeline:
// sharp applies the EXIF orientation, caps the long edge at 2,400 px and writes a fresh file with no
// metadata at all (EXIF holds GPS; XMP, IPTC and comments go too), and the written file is checked
// again before chapter.yaml changes. scan-images re-checks every image in the gate.
//
//   node scripts/add-chapter-photo.ts --chapter=<id> --source=<path outside the repo>
//     --description=<alt text> --caption=<caption> [--name=<file>]
//
// The photo lands beside the chapter's chapter.yaml (data/running/owner/journey/chapters/<id>/), and a
// `photos` entry is added with the alt text and the visible caption, both required (FR-063), keeping
// the file's comments. It refuses a chapter that doesn't exist, a fourth photo (FR-060) and a source
// inside the repository: the original, with its metadata, must never be committed. JPEG, WebP and
// AVIF keep their format; anything else sharp reads (HEIC, PNG, TIFF) becomes JPEG.
//
// The chapter's approval hash covers its photos' bytes, alt text and captions (FR-033), so after this
// the chapter needs the owner's fresh approval (scripts/approve-story.ts --journey=<id>) before it can
// be published again. Who may appear in the photo is the owner's call at that approval (FR-062, as
// amended by the owner on 2026-11-01): nothing showing where they live or regularly run; outside a
// race, no person other than the owner; in a race photo, strangers in the crowd only if none of them
// is recognisable. No script can judge that.
//
// Nothing it prints quotes the alt text or caption: they are story text, published only once approved.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isMap, isScalar, parseDocument, YAMLSeq } from 'yaml';
import { outputName, PhotoError, readSource, stripPhoto, writeStripped } from './lib/photo.ts';
import { isMain } from './lib/walk.ts';
import { journeyTarget } from './approve-story.ts';

export { PhotoError };

/** A chapter carries at most this many photos (FR-060; the schema's maxItems). */
export const MAX_CHAPTER_PHOTOS = 3;

export interface AddChapterPhoto {
  /** Repo root (holding data/). */
  root: string;
  /** The original photo, outside the repository. */
  source: string;
  /** The chapter's ID: data/running/owner/journey/chapters/<chapter>/chapter.yaml must exist. */
  chapter: string;
  /** Alternative text: what the photo shows (required, FR-063). */
  description: string;
  /** The visible caption (required, FR-063). */
  caption: string;
  /** File name in the chapter's folder; defaults to the source's name (lower case, .jpg for JPEG). */
  name?: string;
}

export interface AddedChapterPhoto {
  /** Repo-relative path of the written photo. */
  file: string;
  width: number;
  height: number;
}

/** True when `path` is `root` or inside it (case-insensitively on Windows). */
function inside(root: string, path: string): boolean {
  const fold = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const rel = relative(fold(resolve(root)), fold(resolve(path)));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export async function addChapterPhoto(options: AddChapterPhoto): Promise<AddedChapterPhoto> {
  const description = options.description.trim();
  const caption = options.caption.trim();
  if (!description) throw new PhotoError('a description is required: it is the alt text (what the photo shows)');
  if (!caption) throw new PhotoError('a caption is required: it shows under the photo');
  const named = journeyTarget(options.chapter);
  if (named?.kind !== 'chapter') throw new PhotoError('the chapter is not a chapter ID (lower-case letters, digits and single hyphens)');
  const yamlFile = join(options.root, named.file);
  if (!existsSync(yamlFile)) throw new PhotoError(`${named.file} does not exist: the chapter must be written first`);
  if (inside(options.root, options.source)) {
    throw new PhotoError('the source is inside the repository: keep the original (with its metadata) outside it, and pass its path');
  }
  const folder = named.file.slice(0, named.file.lastIndexOf('/'));
  const { name, format } = outputName(options.source, options.name);
  const target = join(options.root, folder, name);
  if (existsSync(target)) throw new PhotoError(`${folder}/${name} already exists: pass --name to choose another`);

  const doc = parseDocument(readFileSync(yamlFile, 'utf8'), { version: '1.2', schema: 'core' });
  if (doc.errors.length > 0 || !isMap(doc.contents)) throw new PhotoError(`${named.file} is not valid YAML`);
  const photos = doc.get('photos');
  if (photos !== undefined && !(photos instanceof YAMLSeq)) throw new PhotoError(`${named.file} photos is not a list`);
  const listed = (photos?.toJSON() as { file?: string }[] | undefined) ?? [];
  if (listed.length >= MAX_CHAPTER_PHOTOS) throw new PhotoError(`${named.file} already has ${MAX_CHAPTER_PHOTOS} photos: a chapter carries at most ${MAX_CHAPTER_PHOTOS}`);
  if (listed.some((photo) => photo.file === name)) throw new PhotoError(`${named.file} already lists ${name}`);

  const stripped = await stripPhoto(readSource(options.source), format);
  await writeStripped(target, stripped, `${folder}/${name}`);

  const entry = doc.createNode({ file: name, description, caption });
  if (photos instanceof YAMLSeq) {
    photos.add(entry);
  } else {
    // A new list goes before the approval block, where the schema's field order puts it.
    const items = doc.contents.items;
    const at = items.findIndex((pair) => isScalar(pair.key) && pair.key.value === 'approved');
    items.splice(at === -1 ? items.length : at, 0, doc.createPair('photos', doc.createNode([])));
    (doc.get('photos') as YAMLSeq).add(entry);
  }
  writeFileSync(yamlFile, doc.toString({ lineWidth: 0 }));
  return { file: `${folder}/${name}`, width: stripped.width, height: stripped.height };
}

const USAGE = 'usage: node scripts/add-chapter-photo.ts --chapter=<id> --source=<path outside the repo> --description="..." --caption="..." [--name=<file>]';

/** The command line: returns the exit code. Everything it prints goes through here, and none of it quotes the alt text or caption. */
export async function main(args: string[], root: string): Promise<number> {
  const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const [chapter, source, description, caption] = [arg('chapter'), arg('source'), arg('description'), arg('caption')];
  if (!chapter || !source || description === undefined || caption === undefined) {
    console.error(USAGE);
    return 2;
  }
  try {
    const added = await addChapterPhoto({ root, source, chapter, description, caption, name: arg('name') });
    console.log(
      `add-chapter-photo: wrote ${added.file} (${added.width}x${added.height}, no metadata) and listed it in chapter.yaml; chapter "${chapter}" now needs the owner's fresh approval (node scripts/approve-story.ts --journey=${chapter}): its hash covers its photos`,
    );
    return 0;
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exit(await main(process.argv.slice(2), resolve(import.meta.dirname, '..')));
