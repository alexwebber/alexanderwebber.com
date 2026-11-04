// Charity logos for astro:assets (T116): every file in data/running/owner/logos/, imported at build
// time so Astro can size it, looked up by a campaign's charity.logo. A logo the campaign names but
// the folder lacks is left out (validate-data reports it). The file is the charity's own, as it
// supplied it; only its size changes at build.
import type { ImageMetadata } from 'astro';
import type { Campaign } from './store/index.ts';

export interface CharityLogo {
  image: ImageMetadata;
  /** What the logo says, naming the charity. */
  alt: string;
}

/** Imported logo files by root-relative path, e.g. /data/running/owner/logos/martlets.webp. */
export type LogoFiles = Readonly<Record<string, ImageMetadata>>;

const OWNER_LOGOS: LogoFiles = import.meta.glob<ImageMetadata>('/data/running/owner/logos/*.{webp,avif}', { eager: true, import: 'default' });

/** A campaign's charity logo, if it names one that exists. `folder` is where the logos sit within `files`. */
export function charityLogo(campaign: Campaign | undefined, files: LogoFiles = OWNER_LOGOS, folder = '/data/running/owner/logos'): CharityLogo | undefined {
  const logo = campaign?.charity.logo;
  const image = logo && files[`${folder}/${logo.file}`];
  return image ? { image, alt: logo.alt } : undefined;
}
