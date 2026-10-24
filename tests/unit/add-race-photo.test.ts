// add-race-photo (T127; FR-055, research R7): a photo with GPS in its EXIF, an orientation flag
// and a long edge over 2,400 px comes out upright, capped, with no metadata, beside race.yaml and
// listed in it with its description. The photos are generated here, never real ones.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { addRacePhoto, PhotoError } from '../../scripts/add-race-photo.ts';
import { metadataKinds } from '../../scripts/scan-images.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

// sharp's cache keeps files open on Windows, so the temp repo couldn't be removed.
sharp.cache(false);

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const RACE = 'data/running/owner/races/autumn-10k/race.yaml';

/** A 3000x2000 landscape JPEG with GPS in its EXIF, a copyright and orientation 6 (rotate 90°). */
async function phonePhoto(path: string): Promise<void> {
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c86432' } })
    .withExif({
      IFD0: { Copyright: 'Example', Make: 'ExamplePhone' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '0/1 30/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '0/1 30/1 0/1' },
    })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toFile(path);
}

function setUp(raceYaml = 'slug: autumn-10k\ndate: 2025-10-12\nname: Autumn 10k\ndistance: 10k\nofficial_time: "48:10"\n') {
  repo = tempRepo();
  repo.write(RACE, raceYaml);
  repo.write('photo-src/.keep', '');
  return join(repo.root, 'photo-src', 'IMG_0042.JPG');
}

describe('add-race-photo', () => {
  it('strips all metadata, applies the orientation, caps the long edge and lists the photo', async () => {
    const source = setUp();
    await phonePhoto(source);
    expect(await metadataKinds(source)).toContain('EXIF');

    const added = await addRacePhoto({ root: repo.root, source, slug: 'autumn-10k', description: 'Alex at the finish line', caption: 'Nearly there' });
    expect(added).toEqual({ file: 'data/running/owner/races/autumn-10k/img_0042.jpg', width: 1600, height: 2400 });
    const out = join(repo.root, added.file);
    expect(await metadataKinds(out)).toEqual([]);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height, meta.orientation, meta.exif]).toEqual([1600, 2400, undefined, undefined]);

    const race = parse(readFileSync(join(repo.root, RACE), 'utf8'));
    expect(race.photos).toEqual([{ file: 'img_0042.jpg', description: 'Alex at the finish line', caption: 'Nearly there' }]);
    expect(validateData(repo.root, { today: '2026-10-24' }).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('appends to an existing list, keeps WebP as WebP and never enlarges', async () => {
    setUp('slug: autumn-10k\ndate: 2025-10-12\ndistance: 10k\nphotos:\n  - { file: start.jpg, description: The start }\n');
    const small = join(repo.root, 'photo-src', 'medal.webp');
    await sharp({ create: { width: 800, height: 600, channels: 3, background: '#2050a0' } }).webp().toFile(small);
    const added = await addRacePhoto({ root: repo.root, source: small, slug: 'autumn-10k', description: 'The medal' });
    expect(added).toEqual({ file: 'data/running/owner/races/autumn-10k/medal.webp', width: 800, height: 600 });
    expect(parse(readFileSync(join(repo.root, RACE), 'utf8')).photos.map((p: { file: string }) => p.file)).toEqual(['start.jpg', 'medal.webp']);
  });

  it('requires a description, an existing race and a new file name', async () => {
    const source = setUp();
    await phonePhoto(source);
    await expect(addRacePhoto({ root: repo.root, source, slug: 'autumn-10k', description: '  ' })).rejects.toThrow(/description is required/);
    await expect(addRacePhoto({ root: repo.root, source, slug: 'no-such-race', description: 'x' })).rejects.toThrow(PhotoError);
    await addRacePhoto({ root: repo.root, source, slug: 'autumn-10k', description: 'First', name: 'finish.jpg' });
    await expect(addRacePhoto({ root: repo.root, source, slug: 'autumn-10k', description: 'Again', name: 'finish.jpg' })).rejects.toThrow(/already exists/);
  });
});
