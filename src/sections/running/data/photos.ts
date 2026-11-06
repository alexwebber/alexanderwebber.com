// Owner photos for astro:assets: every photo file beside a race.yaml (T132; FR-055) or a journey
// chapter's chapter.yaml (spec 003 T064; FR-060 to FR-064), imported at build time so Astro can
// optimise it, looked up by the race's or chapter's `photos` list. A photo the list names but the
// folder lacks is left out (validate-data reports it).
import type { ImageMetadata } from 'astro';
import type { Race } from './store/index.ts';

export interface GalleryPhoto {
  image: ImageMetadata;
  /** Alternative text: what the photo shows. */
  description: string;
  caption?: string;
}

/** A chapter's photo: its caption is required (FR-063). */
export interface ChapterPhoto extends GalleryPhoto {
  caption: string;
}

/** Imported photo files by root-relative path, e.g. /data/running/owner/races/<slug>/finish.jpg. */
export type PhotoFiles = Readonly<Record<string, ImageMetadata>>;

const OWNER_PHOTOS: PhotoFiles = import.meta.glob<ImageMetadata>('/data/running/owner/races/*/*.{jpg,webp,avif}', { eager: true, import: 'default' });
const CHAPTER_PHOTOS: PhotoFiles = import.meta.glob<ImageMetadata>('/data/running/owner/journey/chapters/*/*.{jpg,webp,avif}', { eager: true, import: 'default' });

/** Where the chapter folders sit among CHAPTER_PHOTOS' paths. */
export const CHAPTER_PHOTO_FOLDER = '/data/running/owner/journey/chapters';

/** A race's gallery, in race.yaml order. `folder` is where the race folders sit within `files`. */
export function galleryPhotos(entry: Race | undefined, files: PhotoFiles = OWNER_PHOTOS, folder = '/data/running/owner/races'): GalleryPhoto[] {
  return (entry?.photos ?? []).flatMap((photo) => {
    const image = files[`${folder}/${entry!.slug}/${photo.file}`];
    return image ? [{ image, description: photo.description, ...(photo.caption ? { caption: photo.caption } : {}) }] : [];
  });
}

/** A chapter's photos, in chapter.yaml order. `folder` is where the chapter folders sit within `files`. */
export function chapterPhotos(
  chapter: { id: string; photos?: readonly { file: string; description: string; caption: string }[] } | undefined,
  files: PhotoFiles = CHAPTER_PHOTOS,
  folder = CHAPTER_PHOTO_FOLDER,
): ChapterPhoto[] {
  return (chapter?.photos ?? []).flatMap((photo) => {
    const image = files[`${folder}/${chapter!.id}/${photo.file}`];
    return image ? [{ image, description: photo.description, caption: photo.caption }] : [];
  });
}
