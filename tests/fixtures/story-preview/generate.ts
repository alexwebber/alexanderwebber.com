// Writes the journey story preview's made-up data trees (spec 003 T033; FR-078, research.md R18), one
// per state, under tests/fixtures/story-preview/data/<state>/data/running/owner/journey/ (JsonFileStore
// expects <root>/data/running/). None of it is real: every word is lorem-style text from a fixed seed,
// every figure and device name is made up, and the first chapter of each state says so. Each file
// carries an `approved` block hashed by journeySha256, exactly as scripts/approve-story.ts --journey
// writes it, so the previews pass the same validation as real data. The SHELL_PREVIEW=1 build renders
// them at /story-preview/<state>/ through the real StoryPage. Deterministic; the output is committed.
//
// States: one-chapter (no closing section), three-chapters (a very short chapter, a long unbroken
// word, a closing section), long (12 chapters of about 600 words), figures (inline and set-apart, a
// Garmin device, plain Garmin, derived, the owner's own figure with no source, and a chapter with
// none), no-closing, same-day (two chapters on one day, ordered by `order`), four-chapters (the
// fewest that show the chapter list; long and figures, with 12 and 4, show it too) and photos (three
// photos in one chapter, one in another, none in a third). long has photos in several chapters too.
//
// Photos (Phase 5, T066) are generated gradients, never a real photo and never of the owner: each is
// drawn here, given GPS and device EXIF, then written through scripts/lib/photo.ts, the pipeline
// add-chapter-photo uses, so it reaches the tree with no metadata and the strip is exercised. Their
// alt text says what the picture shows; their captions are lorem-style words from a seed of their own.
//
//   node tests/fixtures/story-preview/generate.ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { stripPhoto, writeStripped } from '../../../scripts/lib/photo.ts';
import type { JourneyKind } from '../../../src/sections/running/data/store/files.ts';
import { approve, lorem, yaml, type Value } from '../../helpers/journey.ts';

const ROOT = resolve(import.meta.dirname, 'data');
rmSync(ROOT, { recursive: true, force: true });

/** Before the preview's "today" (store.ts). */
const APPROVED = '2026-11-01';
const HEADER = '# Made-up preview text from tests/fixtures/story-preview/generate.ts. Not real.\n';

let seed = 3001;
const words = (count: number) => lorem(seed++, count);
/** Words that carry on a sentence: no capital. */
const lower = (count: number) => {
  const text = words(count);
  return text[0]!.toLowerCase() + text.slice(1);
};
const sentence = (count: number) => `${words(count)}.`;
/** A paragraph of `sentences` made-up sentences, 6 to 17 words each. */
const paragraph = (sentences: number) => Array.from({ length: sentences }, (_, i) => sentence(6 + ((seed + i * 5) % 12))).join(' ');

const MADE_UP = 'This is made-up preview text, so the page can be checked before a real story exists. Nothing here is about a real person, place or figure.';
/** One long unbroken word, for the 320 px check. */
const LONG_WORD = 'Loremipsumdolorsitametconsecteturadipiscingelitseddoeiusmodtemporincididunt';

/** A generated photo: a gradient from `colour` to cream with a pale shape on it. */
interface PhotoSpec {
  file: string;
  colour: string;
  /** The colour's name, for the alt text. */
  colourName: string;
  shape: 'circle' | 'band';
  portrait?: boolean;
}

interface ChapterSpec {
  when: string;
  order?: number;
  /** Paragraphs as written in the file: `{{id}}` placeholders and `[text](/path/)` links included. */
  paragraphs: string[];
  figures?: Value[];
  photos?: PhotoSpec[];
}

interface StateSpec {
  chapters: ChapterSpec[];
  closing: boolean;
}

const figure = (id: string, category: string, label: string, as_of: string, text: string, garmin?: string): Value => ({
  id,
  category,
  label,
  as_of,
  text,
  source: 'owner',
  ...(garmin ? { garmin } : {}),
});

const opening = (sentences = 3) => `${MADE_UP} ${paragraph(sentences)}`;

const photo = (file: string, colour: string, colourName: string, shape: PhotoSpec['shape'], portrait = false): PhotoSpec => ({
  file,
  colour,
  colourName,
  shape,
  ...(portrait ? { portrait } : {}),
});

// Captions draw on a seed of their own, so adding photos changed no word of the text.
let photoSeed = 6001;

/** Draws the photo (past the 2,400 px cap, with planted GPS and device EXIF), strips it and writes it. */
async function photoBytes(spec: PhotoSpec, target: string): Promise<Uint8Array> {
  const [width, height] = spec.portrait ? [1800, 2700] : [2700, 1800];
  const mark =
    spec.shape === 'circle'
      ? `<circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="#fffdfa" opacity="0.7"/>`
      : `<rect y="${height * 0.4}" width="${width}" height="${height / 5}" fill="#fffdfa" opacity="0.6"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${spec.colour}"/><stop offset="1" stop-color="#fdf3dc"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>${mark}</svg>`;
  const source = await sharp(Buffer.from(svg))
    .withExif({ IFD0: { Make: 'ExamplePhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '0/1 18/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '0/1 36/1 0/1' } })
    .jpeg({ quality: 80 })
    .toBuffer();
  const stripped = await stripPhoto(source, 'jpeg');
  mkdirSync(dirname(target), { recursive: true });
  await writeStripped(target, stripped, spec.file);
  return stripped.data;
}

/** The chapter.yaml entry: alt text saying what the picture shows, and a made-up caption. */
const photoEntry = (spec: PhotoSpec): Value => ({
  file: spec.file,
  description: `A made-up picture: a gradient from ${spec.colourName} to cream with a pale ${spec.shape === 'circle' ? 'circle in the middle' : 'band across it'}`,
  caption: `${lorem(photoSeed++, 5)}.`,
});

/** long's photos, by chapter index (SC-009: the page's weight with photos). */
const LONG_PHOTOS: Record<number, PhotoSpec[]> = {
  1: [photo('lorem.jpg', '#1c5cab', 'blue', 'circle')],
  5: [photo('ipsum.jpg', '#0c7a43', 'green', 'band'), photo('dolor.jpg', '#7a3fa0', 'purple', 'circle', true)],
  9: [photo('amet.jpg', '#c2410c', 'orange', 'band')],
};

const STATES: Record<string, StateSpec> = {
  'one-chapter': {
    closing: false,
    chapters: [
      {
        when: '2026-03',
        paragraphs: [opening(), `${paragraph(2)} ${words(5)} {{weight}} ${lower(6)}. ${paragraph(2)}`, `${paragraph(2)} ${words(3)} [${lower(2)}](/running/) ${lower(4)}.`],
        figures: [figure('weight', 'weight', 'Weight', '2026-03', '12.3 kg')],
      },
    ],
  },
  'three-chapters': {
    closing: true,
    chapters: [
      { when: '2024-06-15', paragraphs: [opening(), paragraph(4), `${paragraph(2)} ${LONG_WORD} ${paragraph(1)}`] },
      // A very short chapter: one paragraph.
      { when: '2025-02', paragraphs: [sentence(12)] },
      { when: '2025-09/2026-02', paragraphs: [`${paragraph(3)} ${words(4)} & ${lower(3)}, and ${lower(2)} < ${lower(2)}.`, paragraph(3)] },
    ],
  },
  long: {
    closing: true,
    chapters: Array.from({ length: 12 }, (_, i) => {
      const month = 1 + ((i * 2) % 12);
      const year = 2024 + Math.floor((i * 2) / 12);
      const when = `${year}-${String(month).padStart(2, '0')}`;
      const paragraphs = Array.from({ length: 6 }, () => paragraph(8));
      if (i === 0) paragraphs[0] = `${MADE_UP} ${paragraphs[0]}`;
      if (i === 2) paragraphs[1] = `${paragraphs[1]} ${LONG_WORD}.`;
      const photos = LONG_PHOTOS[i] ? { photos: LONG_PHOTOS[i] } : {};
      if (i % 3 === 1) {
        paragraphs[2] = `${paragraphs[2]} ${words(4)} {{distance}} ${lower(5)}.`;
        return { when, paragraphs, figures: [figure('distance', 'run_distance', 'Distance', when, `${10 + i}.5 km`, 'Example W1')], ...photos };
      }
      return { when, paragraphs, ...photos };
    }),
  },
  figures: {
    closing: true,
    chapters: [
      {
        when: '2025-01-15',
        paragraphs: [opening(2), `${paragraph(2)} ${words(4)} {{weight}} ${lower(5)}.`, '{{vo2}}', paragraph(2)],
        figures: [figure('weight', 'weight', 'Weight', '2025-01', '12.3 kg', 'Example S1'), figure('vo2', 'vo2_max', 'VO2 max', '2025-01-15', '11', 'Garmin')],
      },
      {
        when: '2025-03/2025-06',
        paragraphs: [`${paragraph(2)} ${words(3)} {{fitness}} ${lower(4)}.`, `${paragraph(1)} ${words(5)} {{total}} ${lower(3)}. ${paragraph(1)}`],
        figures: [figure('fitness', 'fitness', 'Fitness', '2025-06', '42', 'derived'), figure('total', 'training_total', 'Distance that spring', '2025-06', '120 km')],
      },
      // A chapter with no figures.
      { when: '2025-08', paragraphs: [paragraph(3), paragraph(2)] },
      {
        when: '2025-10/2026-02',
        paragraphs: [`${paragraph(2)} ${words(4)} {{calories}} ${lower(4)}.`, paragraph(2), '{{race}}', paragraph(1)],
        figures: [figure('calories', 'calories', 'Calories burned', '2025-10-04', '1,234 calories', 'Garmin'), figure('race', 'race_time', 'Race time', '2026-02-01', '3:45:12')],
      },
    ],
  },
  'no-closing': {
    closing: false,
    chapters: [
      { when: '2025-05', paragraphs: [opening(), paragraph(3)] },
      { when: '2026-01-20', paragraphs: [paragraph(4), paragraph(2)] },
    ],
  },
  'same-day': {
    closing: true,
    chapters: [
      { when: '2026-05-02', paragraphs: [opening(), paragraph(2)] },
      { when: '2026-05-02', paragraphs: [paragraph(3), paragraph(2)] },
    ],
  },
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function write(state: string, path: string, kind: JourneyKind, value: Value, photos: ReadonlyMap<string, Uint8Array> = new Map()): void {
  const file = join(ROOT, state, 'data/running/owner/journey', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, HEADER + yaml(approve(kind, value, photos, APPROVED)));
}

async function writeState(state: string, spec: StateSpec): Promise<void> {
  const ids = new Set<string>();
  const chapters = spec.chapters.map((chapter) => {
    const name = words(2 + (seed % 3));
    let id = slug(name);
    for (let n = 2; ids.has(id); n++) id = `${slug(name)}-${n}`;
    ids.add(id);
    return { id, name, chapter };
  });
  // In same-day, `order` must decide: give order 1 to the chapter whose ID sorts last.
  if (state === 'same-day') {
    const [a, b] = chapters;
    const [first, second] = a!.id < b!.id ? [b!, a!] : [a!, b!];
    first.chapter.order = 1;
    second.chapter.order = 2;
  }
  for (const { id, name, chapter } of chapters) {
    // The photos first: their bytes are in the chapter's approval hash (FR-033).
    const bytes = new Map<string, Uint8Array>();
    for (const photo of chapter.photos ?? []) bytes.set(photo.file, await photoBytes(photo, join(ROOT, state, 'data/running/owner/journey/chapters', id, photo.file)));
    const photos = (chapter.photos ?? []).map(photoEntry);
    write(
      state,
      `chapters/${id}/chapter.yaml`,
      'chapter',
      {
        id,
        name,
        when: chapter.when,
        ...(chapter.order !== undefined ? { order: chapter.order } : {}),
        prose: `${chapter.paragraphs.join('\n\n')}\n`,
        takeaway: sentence(14 + (seed % 16)),
        ...(chapter.figures ? { figures: chapter.figures } : {}),
        ...(photos.length > 0 ? { photos } : {}),
      },
      bytes,
    );
  }
  if (spec.closing) write(state, 'closing.yaml', 'closing', { heading: words(4), text: `${paragraph(3)}\n\n${paragraph(2)} ${words(3)} [${lower(3)}](/running/goals/) ${lower(2)}.\n` });
  write(state, 'note.yaml', 'note', { text: paragraph(2) });
  write(state, 'page.yaml', 'page', { title: words(3), description: sentence(16), share_text: words(7), link_label: words(3) });
}

for (const [state, spec] of Object.entries(STATES)) await writeState(state, spec);

// four-chapters (Phase 4, FR-052): the fewest chapters that show the chapter list and "Back to
// chapters". Written after the others from a seed of its own, so adding it left every earlier state's
// files byte-identical.
seed = 4001;
await writeState('four-chapters', {
  closing: true,
  chapters: [
    { when: '2024-04', paragraphs: [opening(), paragraph(4), paragraph(3)] },
    { when: '2024-09-21', paragraphs: [paragraph(4), `${paragraph(2)} ${words(4)} {{distance}} ${lower(5)}.`], figures: [figure('distance', 'run_distance', 'Distance', '2024-09-21', '21.1 km', 'Example W1')] },
    { when: '2025-01/2025-05', paragraphs: [paragraph(5), paragraph(3)] },
    { when: '2025-10', paragraphs: [paragraph(3), `${paragraph(2)} ${words(3)} [${lower(2)}](/running/) ${lower(4)}.`] },
  ],
});

// photos (Phase 5, T066; FR-060, FR-063, SC-007): three photos in one chapter (a portrait one among
// them), one in another, none in the third. Written last, from a seed of its own, as four-chapters.
seed = 5001;
await writeState('photos', {
  closing: true,
  chapters: [
    {
      when: '2025-04',
      paragraphs: [opening(), paragraph(4), paragraph(3)],
      photos: [photo('sit.jpg', '#c2410c', 'orange', 'circle'), photo('consectetur.jpg', '#1c5cab', 'blue', 'band', true), photo('elit.jpg', '#0c7a43', 'green', 'circle')],
    },
    { when: '2025-07-19', paragraphs: [paragraph(3), paragraph(4)], photos: [photo('tempor.jpg', '#7a3fa0', 'purple', 'band')] },
    { when: '2025-11', paragraphs: [paragraph(4), paragraph(2)] },
  ],
});
