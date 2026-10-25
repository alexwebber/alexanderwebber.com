// Race photos for astro:assets (T132; FR-055): every photo file beside a race.yaml, imported at
// build time so Astro can optimise it, looked up by the race's `photos` list. A photo the list
// names but the folder lacks is left out (validate-data reports it).
import type { ImageMetadata } from 'astro';
import type { Race } from './store/index.ts';

export interface GalleryPhoto {
  image: ImageMetadata;
  /** Alternative text: what the photo shows. */
  description: string;
  caption?: string;
}

/** Imported photo files by root-relative path, e.g. /data/running/owner/races/<slug>/finish.jpg. */
export type PhotoFiles = Readonly<Record<string, ImageMetadata>>;

export const OWNER_PHOTOS: PhotoFiles = import.meta.glob<ImageMetadata>('/data/running/owner/races/*/*.{jpg,webp,avif}', { eager: true, import: 'default' });

/** A race's gallery, in race.yaml order. `folder` is where the race folders sit within `files`. */
export function galleryPhotos(entry: Race | undefined, files: PhotoFiles = OWNER_PHOTOS, folder = '/data/running/owner/races'): GalleryPhoto[] {
  return (entry?.photos ?? []).flatMap((photo) => {
    const image = files[`${folder}/${entry!.slug}/${photo.file}`];
    return image ? [{ image, description: photo.description, ...(photo.caption ? { caption: photo.caption } : {}) }] : [];
  });
}
