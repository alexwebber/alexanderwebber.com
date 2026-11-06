// PR screenshots (/pr-screenshots skill): shoots pages of the built site in a real browser, at phone
// width and on a desktop, light and dark, saves them as WebP, and with --publish puts them on a side
// branch that never merges, then prints the Markdown for the PR body, linked by commit SHA (`gh`
// can't attach images to a PR).
//
//   node scripts/process/screenshots.ts <path>[=<name>][,width=<px>][,height=<px>][,first-screen][,open] ... [--build]
//     [--dist=<dir>] [--first-screen] [--no-dark] [--no-desktop] [--width=360] [--publish]
//
// - Serves dist/ itself (no `astro preview`, which a coding agent's session backgrounds and which
//   blocks Playwright's webServer). Preview pages need a SHELL_PREVIEW=1 build: --build makes one.
//   --dist=<dir> serves another built site instead, e.g. a drill's scratch copy kept with
//   DRILL_KEEP_DIST (tests/e2e/story-launch.spec.ts).
// - Each path gives <name>-phone, <name>-phone-dark, <name>-desktop (and -desktop-dark with
//   --desktop-dark). The name defaults to the path's segments joined by "-". One path can be shot
//   more than once under different names, e.g. `/running/=landing,first-screen
//   /running/=menu-320,width=320,first-screen`.
// - Phone shots are full-page at 360 px wide (--width, or `,width=` for one path) with isMobile off
//   (Playwright can't capture a full page with it on), at 2x. --first-screen (or `,first-screen`)
//   shoots only the first screen (width x 780, or `,height=` for one path, e.g. 640 for the small
//   phone landing.spec.ts holds Donate to), for "what a visitor sees first" checks. `,open` opens
//   every <details> on the page first (e.g. the story's chapter list shown open). A full-page shot
//   loads every lazy image first. Pages taller than WebP's limit are cropped, and say so.
// - Files go to spikes/screens/out/ (gitignored). --publish commits them with git plumbing (the
//   working tree is untouched) to `<branch>-screens`, pushes, and prints the PR body's table. The
//   side branch stays after the merge, so the merged PR's images keep working. It triggers no
//   workflow (gate.yml runs on PRs and main only).
//
// Made-up data only: the screenshots are public the moment they're pushed (Principle VI).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { walk } from '../lib/walk.ts';
import { REPO, run } from './lib.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const distArg = args.find((a) => a.startsWith('--dist='))?.slice('--dist='.length);
const DIST = distArg ? resolve(ROOT, distArg) : join(ROOT, 'dist');
const OUT = join(ROOT, 'spikes', 'screens', 'out');
const ASTRO = join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
/** WebP's largest side, in pixels. */
const WEBP_MAX = 16383;
const PHONE_HEIGHT = 780;
const DESKTOP = { width: 1280, height: 800 };

const git = (...args: string[]) => run('git', args, ROOT).trim();

const flag = (name: string) => args.includes(`--${name}`);
const width = Number(args.find((a) => a.startsWith('--width='))?.slice(8) ?? 360);
const targets = args
  .filter((a) => !a.startsWith('--'))
  .map((a) => {
    const [spec, ...options] = a.split(',') as [string, ...string[]];
    const [path, name] = spec.split('=') as [string, string | undefined];
    const clean = path.endsWith('/') || extname(path) ? path : `${path}/`;
    const own = options.find((o) => o.startsWith('width='));
    const ownHeight = options.find((o) => o.startsWith('height='));
    return {
      path: clean,
      name: name ?? (clean.split('/').filter(Boolean).join('-') || 'home'),
      width: own ? Number(own.slice('width='.length)) : width,
      height: ownHeight ? Number(ownHeight.slice('height='.length)) : PHONE_HEIGHT,
      firstScreen: options.includes('first-screen') || flag('first-screen'),
      open: options.includes('open'),
    };
  });
if (distArg && flag('build')) {
  console.error('! --build builds dist/, so it can\'t be used with --dist.');
  process.exit(2);
}
if (new Set(targets.map((t) => t.name)).size !== targets.length) {
  console.error('! Two shots share a name: name each with <path>=<name>.');
  process.exit(2);
}
const rewritten = targets.find((t) => !t.path.startsWith('/'));
if (rewritten) {
  console.error(`! "${rewritten.path}" isn't a site path. Git Bash rewrites /paths into Windows ones: run it from PowerShell, or prefix MSYS_NO_PATHCONV=1.`);
  process.exit(2);
}
if (targets.length === 0) {
  console.error('Usage: node scripts/process/screenshots.ts <path>[=<name>][,width=<px>][,height=<px>][,first-screen][,open] ... [--build] [--dist=<dir>] [--first-screen] [--no-dark] [--no-desktop] [--desktop-dark] [--width=360] [--publish]');
  process.exit(2);
}

// --- Build, then serve dist/ ---------------------------------------------------------------------

if (flag('build')) {
  console.log('Building with SHELL_PREVIEW=1 ...');
  const env = { ...process.env, SHELL_PREVIEW: '1' };
  for (const cmd of [[join(ROOT, 'scripts', 'gen-types.ts')], [ASTRO, 'build', '--silent']]) {
    const result = spawnSync(process.execPath, cmd, { cwd: ROOT, env, stdio: 'inherit' });
    if (result.status !== 0) process.exit(1);
  }
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
};

/**
 * Every file under dist/, by the URL path that serves it, as Cloudflare's static assets do:
 * "/a/b.css", and "/a/" for "/a/index.html". The server only serves what's listed here, so no
 * request reaches the file system with a path of its own.
 */
const FILES = new Map<string, string>();
for (const rel of existsSync(DIST) ? walk(DIST, '.') : []) {
  const url = rel.slice(1); // "./a/b.css" -> "/a/b.css"
  FILES.set(url, join(DIST, rel));
  if (url.endsWith('/index.html')) FILES.set(url.slice(0, -'index.html'.length), join(DIST, rel));
}

/** The file a request's URL path is served from, if dist/ has one. */
function distFile(urlPath: string): string | undefined {
  try {
    return FILES.get(decodeURIComponent(urlPath.split('?')[0]!));
  } catch {
    return undefined; // a malformed escape
  }
}

function serve(): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => {
    const file = distFile(req.url ?? '/');
    const path = file ?? FILES.get('/404.html');
    res.writeHead(file ? 200 : 404, { 'content-type': TYPES[extname(path ?? '.txt')] ?? 'application/octet-stream' });
    res.end(path ? readFileSync(path) : 'Not found');
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    done({ server, base: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}` });
  }));
}

for (const { path } of targets) {
  if (!distFile(path)) {
    console.error(`! ${path} isn't in ${distArg ?? 'dist/'}. Build first (--build makes a SHELL_PREVIEW=1 build, which the preview pages need).`);
    process.exit(1);
  }
}

// --- Shoot ---------------------------------------------------------------------------------------

interface Shot {
  file: string;
  /** The target's name: one path can be shot under several names. */
  name: string;
  variant: string;
  cropped: boolean;
}

const variantsFor = (w: number, h = PHONE_HEIGHT) => [
  { suffix: 'phone', viewport: { width: w, height: h }, scale: 2, scheme: 'light' as const },
  ...(flag('no-dark') ? [] : [{ suffix: 'phone-dark', viewport: { width: w, height: h }, scale: 2, scheme: 'dark' as const }]),
  ...(flag('no-desktop') ? [] : [{ suffix: 'desktop', viewport: DESKTOP, scale: 1, scheme: 'light' as const }]),
  ...(flag('desktop-dark') ? [{ suffix: 'desktop-dark', viewport: DESKTOP, scale: 1, scheme: 'dark' as const }] : []),
];
const variants = variantsFor(width);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await chromium.launch();
const shots: Shot[] = [];
try {
  for (const target of targets) {
    for (const v of variantsFor(target.width, target.height)) {
      const context = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: v.scale, colorScheme: v.scheme, isMobile: false });
      const page = await context.newPage();
      const response = await page.goto(`${base}${target.path}`, { waitUntil: 'load' });
      if (response?.status() !== 200) throw new Error(`${target.path} answered ${response?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      if (target.open) await page.evaluate(() => document.querySelectorAll('details').forEach((details) => (details.open = true)));
      // A full-page shot doesn't scroll, so lazy images below the first screen would show as empty
      // boxes: load every image first (one that fails stays as the page shows it).
      if (!target.firstScreen) {
        await page.evaluate(async () => {
          const images = [...document.images];
          for (const image of images) image.loading = 'eager';
          // `complete` reads true for a lazy image not yet requested, so wait on decode() instead.
          await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
        });
      }
      const png = await page.screenshot({ fullPage: !target.firstScreen });
      await context.close();
      const image = sharp(png);
      const { width: w = 0, height: h = 0 } = await image.metadata();
      const cropped = h > WEBP_MAX;
      const file = `${target.name}-${v.suffix}.webp`;
      await (cropped ? image.extract({ left: 0, top: 0, width: w, height: WEBP_MAX }) : image).webp({ quality: 80 }).toFile(join(OUT, file));
      shots.push({ file, name: target.name, variant: v.suffix, cropped });
      console.log(`  ${file}${cropped ? ` (cropped to the first ${WEBP_MAX / v.scale} px of ${h / v.scale})` : ''}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${shots.length} screenshot(s) in ${OUT}`);

// --- Publish to the side branch -------------------------------------------------------------------

if (!flag('publish')) {
  console.log('Look at them, then rerun with --publish to push them and print the PR body\'s table.');
  process.exit(0);
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch === 'main' || branch === 'HEAD') {
  console.error('! On main or a detached HEAD: switch to the PR\'s branch first.');
  process.exit(1);
}
const side = `${branch.replace(/\//g, '-')}-screens`;

// Keep what an earlier publish put there; a file of the same name is replaced.
const entries = new Map<string, string>();
let parent: string | undefined;
if (git('ls-remote', '--heads', 'origin', side) !== '') {
  git('fetch', '--quiet', 'origin', side);
  parent = git('rev-parse', 'FETCH_HEAD');
  for (const line of git('ls-tree', parent).split('\n').filter(Boolean)) {
    const [meta, name] = line.split('\t') as [string, string];
    entries.set(name, meta);
  }
}
for (const shot of shots) entries.set(shot.file, `100644 blob ${git('hash-object', '-w', join(OUT, shot.file))}`);
const tree = execFileSync('git', ['mktree'], { cwd: ROOT, input: [...entries].map(([name, meta]) => `${meta}\t${name}\n`).join(''), encoding: 'utf8' }).trim();
const message = `PR screenshots for ${branch} (never merges)`;
const sha = git('commit-tree', tree, '-m', message, ...(parent ? ['-p', parent] : []));
git('push', '--quiet', 'origin', `${sha}:refs/heads/${side}`);
console.log(`Pushed ${shots.length} file(s) to ${side} at ${sha}.\n`);

// --- The PR body's Markdown ----------------------------------------------------------------------

const url = (file: string) => `https://raw.githubusercontent.com/${REPO}/${sha}/${file}`;
/** A target as its row and links name it: the path, and its width, first screen and open details when they differ. */
const label = (t: (typeof targets)[number]) => {
  const notes = [
    ...(t.width !== width || t.height !== PHONE_HEIGHT ? [t.height !== PHONE_HEIGHT ? `${t.width} x ${t.height}` : `${t.width} px`] : []),
    ...(t.firstScreen && !flag('first-screen') ? ['first screen'] : []),
    ...(t.open ? ['details open'] : []),
  ];
  return `\`${t.path}\`${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`;
};
const pathOf = new Map(targets.map((t) => [t.name, t.path]));
const img = (shot: Shot) => `<img src="${url(shot.file)}" width="240" alt="${pathOf.get(shot.name)} ${shot.variant}">`;
const phones = (name: string) => shots.filter((s) => s.name === name && s.variant.startsWith('phone'));
const desktops = (name: string) => shots.filter((s) => s.name === name && s.variant.startsWith('desktop'));
const columns = variants.filter((v) => v.suffix.startsWith('phone')).map((v) => (v.suffix === 'phone' ? 'Phone' : 'Phone, dark'));
const lines = [
  '## Screenshots (made-up data)',
  '',
  `| Page | ${columns.join(' | ')} |`,
  `|---|${columns.map(() => '---').join('|')}|`,
  ...targets.map((t) => `| ${label(t)} | ${phones(t.name).map(img).join(' | ')} |`),
];
const desktopLinks = targets.flatMap((t) => desktops(t.name).map((s) => `[${label(t)}${s.variant === 'desktop' ? '' : ' (dark)'}](${url(s.file)})`));
if (desktopLinks.length > 0) lines.push('', `Desktop: ${desktopLinks.join(' · ')}`);
if (shots.some((s) => s.cropped)) lines.push('', 'Long pages are cropped to their top part.');
const markdown = `${lines.join('\n')}\n`;
writeFileSync(join(OUT, 'pr-body.md'), markdown);
console.log(markdown);
console.log(`(Also in ${join(OUT, 'pr-body.md')}.)`);
