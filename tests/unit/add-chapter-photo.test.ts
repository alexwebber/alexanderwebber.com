// add-chapter-photo (spec 003 T067; FR-033, FR-060, FR-061, FR-063, research.md R10): a photo with
// GPS and device EXIF, an orientation flag and a long edge over 2,400 px comes out upright, capped and
// with no metadata, beside chapter.yaml and listed in it with its alt text and caption, the file's
// comments kept; the chapter then needs a fresh approval. Each refused case writes nothing, and
// nothing printed quotes the alt text or caption. The photos are generated here, never real ones, and
// every word is made up.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { addChapterPhoto, main, PhotoError } from '../../scripts/add-chapter-photo.ts';
import { approveJourney } from '../../scripts/approve-story.ts';
import { metadataKinds } from '../../scripts/scan-images.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { approve, chapter, chapterFile, lorem, writeStory, type Value } from '../helpers/journey.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

// sharp's cache keeps files open on Windows, so the temporary folders couldn't be removed.
sharp.cache(false);

let repo: TempRepo;
let outside: string | undefined;
afterEach(() => {
  repo?.cleanup();
  if (outside) rmSync(outside, { recursive: true, force: true });
  outside = undefined;
  vi.restoreAllMocks();
});

const ID = 'chapter-a';
const FILE = chapterFile(ID);
const FOLDER = FILE.slice(0, FILE.lastIndexOf('/'));
const TODAY = '2026-11-10';
const ALT = 'Quuxalt sentinel picture';
const CAPTION = 'Quuxcaption sentinel words';

/** A 3000x2000 landscape JPEG with GPS and a device in its EXIF, and orientation 6 (rotate 90°). */
async function phonePhoto(path: string): Promise<void> {
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#2050a0' } })
    .withExif({
      IFD0: { Make: 'ExamplePhone', Model: 'Example 1' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '0/1 30/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '0/1 30/1 0/1' },
    })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toFile(path);
}

/** A temporary repo with an approved story (one chapter, a comment in its file), and a photo outside it. */
async function setUp(value: Value = chapter(ID), photos: Record<string, Uint8Array> = {}): Promise<string> {
  repo = tempRepo();
  writeStory(repo, { chapter: value, photos });
  const path = join(repo.root, FILE);
  repo.write(FILE, `# A made-up chapter, kept as a comment.\n${readFileSync(path, 'utf8')}`);
  outside = mkdtempSync(join(tmpdir(), 'aw-photo-src-'));
  const source = join(outside, 'IMG_0042.JPG');
  await phonePhoto(source);
  return source;
}

const errors = () => validateData(repo.root, { today: TODAY }).filter((i) => i.severity === 'error');
const folderFiles = () => readdirSync(join(repo.root, FOLDER)).sort();

describe('add-chapter-photo', () => {
  it('strips all metadata, applies the orientation, caps the long edge and lists the photo, comments kept', async () => {
    const source = await setUp();
    expect(await metadataKinds(source)).toContain('EXIF');

    const added = await addChapterPhoto({ root: repo.root, source, chapter: ID, description: ALT, caption: CAPTION });
    expect(added).toEqual({ file: `${FOLDER}/img_0042.jpg`, width: 1600, height: 2400 });
    const out = readFileSync(join(repo.root, added.file));
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height, meta.orientation, meta.exif, meta.xmp, meta.iptc]).toEqual([1600, 2400, undefined, undefined, undefined, undefined]);
    expect(await metadataKinds(join(repo.root, added.file))).toEqual([]);

    const text = readFileSync(join(repo.root, FILE), 'utf8');
    expect(text.startsWith('# A made-up chapter, kept as a comment.\n')).toBe(true);
    const written = parse(text);
    expect(written.photos).toEqual([{ file: 'img_0042.jpg', description: ALT, caption: CAPTION }]);
    // The list goes before the approval block, and the rest of the file is as it was.
    expect(Object.keys(written).slice(-2)).toEqual(['photos', 'approved']);
    expect({ ...written, photos: undefined }).toEqual({ ...approve('chapter', chapter(ID)), photos: undefined });
  });

  it('appends to an existing list, up to three, and keeps WebP as WebP', async () => {
    const listed = (n: number) => Array.from({ length: n }, (_, i) => ({ file: `p${i}.jpg`, description: `${lorem(60 + i, 4)}.`, caption: `${lorem(70 + i, 3)}.` }));
    const bytes = (n: number) => Object.fromEntries(listed(n).map((p, i) => [p.file, new Uint8Array([1, 2, 3, i])]));
    await setUp(chapter(ID, { photos: listed(2) }), bytes(2));
    const webp = join(outside!, 'medal.webp');
    await sharp({ create: { width: 800, height: 600, channels: 3, background: '#0c7a43' } }).webp().toFile(webp);
    const added = await addChapterPhoto({ root: repo.root, source: webp, chapter: ID, description: ALT, caption: CAPTION });
    expect(added).toEqual({ file: `${FOLDER}/medal.webp`, width: 800, height: 600 });
    expect(parse(readFileSync(join(repo.root, FILE), 'utf8')).photos.map((p: { file: string }) => p.file)).toEqual(['p0.jpg', 'p1.jpg', 'medal.webp']);
  });

  it('leaves the chapter needing a fresh approval: its hash covers the photo (FR-033)', async () => {
    const source = await setUp();
    expect(errors()).toEqual([]);
    await addChapterPhoto({ root: repo.root, source, chapter: ID, description: ALT, caption: CAPTION });
    expect(errors().map((i) => [i.file, i.field])).toEqual([[FILE, 'approved.sha256']]);
    approveJourney({ root: repo.root, target: ID, date: '2026-11-02' });
    expect(errors()).toEqual([]);
  });

  describe('refuses, writing nothing', () => {
    const refused = async (options: Partial<Parameters<typeof addChapterPhoto>[0]>, message: RegExp, value?: Value, photos?: Record<string, Uint8Array>) => {
      const source = await setUp(value, photos);
      const [before, files] = [readFileSync(join(repo.root, FILE), 'utf8'), folderFiles()];
      await expect(addChapterPhoto({ root: repo.root, source, chapter: ID, description: ALT, caption: CAPTION, ...options })).rejects.toThrow(message);
      await expect(addChapterPhoto({ root: repo.root, source, chapter: ID, description: ALT, caption: CAPTION, ...options })).rejects.toThrow(PhotoError);
      expect(readFileSync(join(repo.root, FILE), 'utf8')).toBe(before);
      expect(folderFiles()).toEqual(files);
    };

    it('a missing or blank caption or description (FR-063)', async () => {
      await refused({ caption: '' }, /a caption is required/);
      await refused({ caption: '   ' }, /a caption is required/);
      await refused({ description: '' }, /a description is required/);
    });

    it('a fourth photo (FR-060)', async () => {
      const three = Array.from({ length: 3 }, (_, i) => ({ file: `p${i}.jpg`, description: `${lorem(80 + i, 4)}.`, caption: `${lorem(90 + i, 3)}.` }));
      await refused({}, /already has 3 photos/, chapter(ID, { photos: three }), Object.fromEntries(three.map((p, i) => [p.file, new Uint8Array([i])])));
    });

    it('an unknown chapter, or a target that is not a chapter ID', async () => {
      await refused({ chapter: 'no-such-chapter' }, /chapters\/no-such-chapter\/chapter\.yaml does not exist/);
      await refused({ chapter: '../../owner' }, /not a chapter ID/);
      await refused({ chapter: 'note' }, /not a chapter ID/);
    });

    it('a source inside the repository: the original keeps its metadata', async () => {
      await setUp();
      repo.write('photo-src/.keep', '');
      const inside = join(repo.root, 'photo-src', 'IMG_0043.JPG');
      await phonePhoto(inside);
      const before = readFileSync(join(repo.root, FILE), 'utf8');
      await expect(addChapterPhoto({ root: repo.root, source: inside, chapter: ID, description: ALT, caption: CAPTION })).rejects.toThrow(/inside the repository/);
      await expect(addChapterPhoto({ root: repo.root, source: inside.toUpperCase(), chapter: ID, description: ALT, caption: CAPTION })).rejects.toThrow(process.platform === 'win32' ? /inside the repository/ : /./);
      expect(readFileSync(join(repo.root, FILE), 'utf8')).toBe(before);
      expect(folderFiles()).toEqual(['chapter.yaml']);
    });

    it('a name already in the folder', async () => {
      const source = await setUp();
      await addChapterPhoto({ root: repo.root, source, chapter: ID, description: ALT, caption: CAPTION, name: 'lorem.jpg' });
      await expect(addChapterPhoto({ root: repo.root, source, chapter: ID, description: ALT, caption: CAPTION, name: 'lorem.jpg' })).rejects.toThrow(/already exists/);
    });
  });

  it('prints one line naming the file and the fresh approval, and never the alt text or caption', async () => {
    const source = await setUp();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const args = [`--chapter=${ID}`, `--source=${source}`, `--description=${ALT}`, `--caption=${CAPTION}`];
    expect(await main(args, repo.root)).toBe(0);
    expect(log.mock.calls).toEqual([[expect.stringMatching(new RegExp(`^add-chapter-photo: wrote ${FOLDER}/img_0042\\.jpg \\(1600x2400, no metadata\\).*chapter "${ID}" now needs the owner's fresh approval`))]]);
    // Refusals: a fourth file name, a missing caption, a source inside the repo, usage.
    expect(await main(args, repo.root)).toBe(1);
    expect(await main([`--chapter=${ID}`, `--source=${source}`, `--description=${ALT}`, '--caption='], repo.root)).toBe(1);
    expect(await main([`--chapter=${ID}`, `--source=${join(repo.root, FILE)}`, `--description=${ALT}`, `--caption=${CAPTION}`], repo.root)).toBe(1);
    expect(await main([`--chapter=${ID}`, `--description=${ALT}`, `--caption=${CAPTION}`], repo.root)).toBe(2);
    const printed = JSON.stringify([log.mock.calls, error.mock.calls]);
    expect(error.mock.calls).toHaveLength(4);
    expect(printed).not.toMatch(/quux/i);
  });
});
