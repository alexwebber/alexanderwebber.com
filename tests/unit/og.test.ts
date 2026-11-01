// Share images (T075, FR-072): 1200 x 630 PNGs from satori + sharp, at build time.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { OG_HEIGHT, OG_WIDTH, cardTree, ogEndpoint, ogPath, renderOgPng } from '../../src/shared/og/render.ts';

const texts = (node: unknown): string[] => {
  if (typeof node === 'string') return [node];
  const children = (node as { props: { children?: unknown } }).props.children;
  return (Array.isArray(children) ? children : [children]).filter((c) => c !== undefined).flatMap(texts);
};

describe('renderOgPng', () => {
  it('renders a 1200 x 630 PNG', async () => {
    const png = await renderOgPng({ eyebrow: 'Running', title: 'Goals', subtitle: 'Sub-3:30 at Brighton' });
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height]).toEqual([OG_WIDTH, OG_HEIGHT]);
  });
});

describe('cardTree', () => {
  it('carries every line of the card, including data attribution', () => {
    const tree = cardTree({ eyebrow: 'Running', title: 'Health', subtitle: 'VO2 max and weight', attribution: 'Source: Garmin' });
    expect(texts(tree)).toEqual(['Running', 'Health', 'VO2 max and weight', 'alexanderwebber.com', 'Source: Garmin']);
  });

  it('leaves out lines that are not given', () => {
    expect(texts(cardTree({ title: 'Alexander Webber' }))).toEqual(['Alexander Webber', 'alexanderwebber.com']);
  });
});

describe('ogEndpoint', () => {
  it('serves image/png', async () => {
    const response = (await ogEndpoint(() => ({ title: 'T' }))({} as never)) as Response;
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
});

describe('ogPath', () => {
  it.each([
    ['/', '/og/site.png'],
    ['/running/', '/og/running.png'],
    ['/running/goals/', '/og/running-goals.png'],
    ['/running/fundraising/', '/og/running-fundraising.png'],
    ['/running/races/brighton-2027/', '/og/running-races-brighton-2027.png'],
  ])('%s -> %s', (page, image) => {
    expect(ogPath(page)).toBe(image);
  });
});
