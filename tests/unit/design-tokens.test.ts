// Token contrast checks (T072; plan.md graduation plan "token contrast checks"): WCAG 2.2 AA for
// every text token on every page and surface colour, 3:1 for non-text UI and chart marks, in
// light and dark mode, for the shared tokens and for each section theme layered on them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Tokens = Record<string, string>;

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/** Custom properties declared in a CSS fragment. */
function declarations(css: string): Tokens {
  return Object.fromEntries([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

/** Splits a token file into its light declarations and its prefers-color-scheme: dark ones. */
function modes(css: string): { light: Tokens; dark: Tokens } {
  const at = css.indexOf('@media (prefers-color-scheme: dark)');
  expect(at, 'token file has a dark-mode block').toBeGreaterThan(0);
  return { light: declarations(css.slice(0, at)), dark: declarations(css.slice(at)) };
}

function resolve(tokens: Tokens, name: string): string {
  let value = tokens[name];
  for (let depth = 0; value?.startsWith('var(') && depth < 5; depth++) {
    value = tokens[/var\((--[\w-]+)\)/.exec(value)![1]!];
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} does not resolve to a hex colour`);
  return value;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const shared = modes(read('src/shared/design/tokens.css'));
const running = modes(read('src/sections/running/styles/theme.css'));

const themes: [string, Tokens][] = [
  ['shared light', shared.light],
  ['shared dark', { ...shared.light, ...shared.dark }],
  ['running light', { ...shared.light, ...running.light }],
  ['running dark', { ...shared.light, ...shared.dark, ...running.light, ...running.dark }],
];

const BACKGROUNDS = ['--color-page', '--color-surface'];
const TEXT = ['--color-text', '--color-text-secondary', '--color-text-muted', '--color-accent', '--color-accent-strong', '--color-good-text', '--chart-label'];
const NON_TEXT = ['--color-focus', '--color-border-strong', '--chart-reference'];
// Light slots 3-5 are below 3:1 on light surfaces by design; charts using them carry direct
// labels or the data table (the dataviz relief rule, noted in tokens.css).
const SERIES_LIGHT = ['--series-1', '--series-2', '--series-6', '--series-7', '--series-8'];
const SERIES_ALL = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--series-${n}`);

describe.each(themes)('%s', (name, tokens) => {
  const dark = name.endsWith('dark');

  it.each(TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg])))('text %s on %s >= 4.5:1', (fg, bg) => {
    expect(contrast(resolve(tokens, fg!), resolve(tokens, bg!))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg])))('UI %s on %s >= 3:1', (fg, bg) => {
    expect(contrast(resolve(tokens, fg!), resolve(tokens, bg!))).toBeGreaterThanOrEqual(3);
  });

  it.each(dark ? SERIES_ALL : SERIES_LIGHT)('chart %s on the surface >= 3:1', (series) => {
    expect(contrast(resolve(tokens, series), resolve(tokens, '--color-surface'))).toBeGreaterThanOrEqual(3);
  });

  it('notice text on the notice background >= 4.5:1', () => {
    expect(contrast(resolve(tokens, '--color-notice-text'), resolve(tokens, '--color-notice-bg'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('token files', () => {
  it('a section theme only overrides tokens the shared file defines', () => {
    const own = new Set(['--running-series']);
    for (const name of [...Object.keys(running.light), ...Object.keys(running.dark)]) {
      if (!own.has(name)) expect(shared.light, name).toHaveProperty([name]);
    }
  });

  it('every dark token also has a light value', () => {
    for (const name of Object.keys(shared.dark)) expect(shared.light, name).toHaveProperty([name]);
  });
});
