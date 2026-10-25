// Share-preview images (T075, FR-072): satori lays a card out as SVG, sharp rasterises it to a
// 1200 x 630 PNG, at build time only. Text is drawn with the bundled Inter (OFL 1.1, fontsource
// 5.3.0, Latin subset; see fonts/OFL.txt), so the images look the same on every build machine.
// Satori reads WOFF but not WOFF2.
//
// Pages link to /og/<name>.png (contracts/routes.md); each image is a static endpoint built with
// ogEndpoint(). Sections pass their own colours, so shared code holds no section identity.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';
import satori from 'satori';
import sharp from 'sharp';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export interface OgColours {
  background: string;
  text: string;
  muted: string;
  accent: string;
}

export interface OgCard {
  /** Small line above the title, e.g. "Running". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Data attribution an exported image must carry, e.g. Garmin's (FR-077). */
  attribution?: string;
  colours?: OgColours;
}

// The shared light tokens (src/shared/design/tokens.css).
const SITE_COLOURS: OgColours = {
  background: '#f9f9f7',
  text: '#0b0b0b',
  muted: '#52514e',
  accent: '#1c5cab',
};

// Read from the repo root (builds and tests run there), not relative to this module: Astro
// bundles endpoints into dist/, where a module-relative path no longer points at src/.
const FONT_DIR = 'src/shared/og/fonts';

let fonts: Promise<Parameters<typeof satori>[1]['fonts']> | undefined;

function loadFonts() {
  fonts ??= Promise.all(
    ([400, 700] as const).map(async (weight) => ({
      name: 'Inter',
      weight,
      style: 'normal' as const,
      data: await readFile(resolve(FONT_DIR, `inter-latin-${weight}-normal.woff`)),
    })),
  );
  return fonts;
}

// Satori takes React-style element objects; no JSX or React is needed to build them.
interface Node {
  type: string;
  props: { style?: Record<string, string | number>; children?: (Node | string)[] | Node | string };
}

const h = (style: Node['props']['style'], children: Node['props']['children']): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children },
});

/** The card layout: eyebrow, title, subtitle, then the site name and any attribution. */
export function cardTree(card: OgCard): Node {
  const c = card.colours ?? SITE_COLOURS;
  const top: Node[] = [];
  if (card.eyebrow) {
    top.push(h({ fontSize: 34, fontWeight: 700, color: c.accent, marginBottom: 20 }, card.eyebrow));
  }
  top.push(h({ fontSize: card.title.length > 40 ? 64 : 80, fontWeight: 700, lineHeight: 1.1, color: c.text }, card.title));
  if (card.subtitle) {
    top.push(h({ fontSize: 38, color: c.muted, marginTop: 28, lineHeight: 1.3 }, card.subtitle));
  }
  const bottom: Node[] = [h({ fontSize: 30, fontWeight: 700, color: c.text }, 'alexanderwebber.com')];
  if (card.attribution) bottom.push(h({ fontSize: 26, color: c.muted }, card.attribution));
  // Satori sizes boxes content-box, so the sized root carries no padding or border: the accent
  // bar and the padded body are children that share its height.
  return h(
    { width: '100%', height: '100%', flexDirection: 'column', backgroundColor: c.background, fontFamily: 'Inter' },
    [
      h({ height: 16, backgroundColor: c.accent }, []),
      h({ flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between', padding: '56px 80px 64px' }, [
        h({ flexDirection: 'column' }, top),
        h({ justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }, bottom),
      ]),
    ],
  );
}

async function renderOgSvg(card: OgCard): Promise<string> {
  return satori(cardTree(card) as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(),
  });
}

/** The card as PNG bytes. Satori draws text as paths, so sharp needs no fonts. */
export async function renderOgPng(card: OgCard): Promise<Buffer> {
  const svg = await renderOgSvg(card);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** A static endpoint (e.g. src/pages/og/site.png.ts) serving the card as a PNG. */
export function ogEndpoint(card: OgCard | (() => OgCard | Promise<OgCard>)): APIRoute {
  return async () => {
    const png = await renderOgPng(typeof card === 'function' ? await card() : card);
    return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
  };
}

/** The site path of a page's own share image: /running/goals/ -> /og/running-goals.png. */
export function ogPath(pagePath: string): string {
  const name = pagePath.replace(/^\/+|\/+$/g, '').replaceAll('/', '-');
  return `/og/${name || 'site'}.png`;
}
