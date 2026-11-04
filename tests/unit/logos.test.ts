// charityLogo() (T116): a campaign's logo by its charity.logo, from the real data and from a given
// file map, and nothing when the campaign names none or the file is missing.
import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import { charityLogo } from '../../src/sections/running/data/logos.ts';
import type { Campaign } from '../../src/sections/running/data/store/index.ts';

const image = { src: '/x.webp', width: 10, height: 14, format: 'webp' } as ImageMetadata;
const campaign = (logo?: Campaign['charity']['logo']): Campaign => ({
  id: 'a',
  race_id: 'a',
  charity: { name: 'Example hospice', ...(logo ? { logo } : {}) },
  page_url: 'https://www.justgiving.com/page/example-a',
});

describe('charityLogo', () => {
  it('finds the named file in the given folder, with its alt text', () => {
    const files = { '/f/logos/example.webp': image };
    expect(charityLogo(campaign({ file: 'example.webp', alt: 'In aid of Example hospice' }), files, '/f/logos')).toEqual({ image, alt: 'In aid of Example hospice' });
  });

  it('gives nothing without a logo, a campaign or the file', () => {
    const files = { '/f/logos/example.webp': image };
    expect(charityLogo(campaign(), files, '/f/logos')).toBeUndefined();
    expect(charityLogo(undefined, files, '/f/logos')).toBeUndefined();
    expect(charityLogo(campaign({ file: 'other.webp', alt: 'x' }), files, '/f/logos')).toBeUndefined();
  });

  it('finds the real Martlets logo in data/running/owner/logos/', () => {
    const logo = charityLogo(campaign({ file: 'martlets.webp', alt: 'In aid of Martlets' }));
    expect(logo?.alt).toBe('In aid of Martlets');
    expect([logo?.image.width, logo?.image.height]).toEqual([1514, 2151]);
  });
});
