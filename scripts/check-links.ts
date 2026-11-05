// Link check over the built site (specs/003-journey-story/contracts/gate.md §1; FR-015, FR-042,
// research.md R9): every link to a page of this site must lead to a page the build made. It runs in
// the gate after the build, before the privacy scan, so a dead link stops the deploy and the live
// site stays as it was.
//
// - Every `href` in every .html file under dist/ that is a site path (one leading `/`) must resolve
//   to a built file, with any #fragment (and ?query) stripped first: `<path>index.html` for a path
//   ending in `/`, else the file itself.
// - Fragments are checked against element ids only for links to the story page (/running/story/),
//   including the story page's own `#…` links; elsewhere they're ignored.
// - Ignored: external links (https:, http:), mailto:, links into /_astro/ and the /running/api/
//   Worker routes, which aren't files.
// - A link inside a chapter carries `data-chapter-link="<id>"`, so its message names the chapter
//   instead of quoting the link's text. Paths are printed: they're site addresses, not story text.
//
//   node scripts/check-links.ts [--dist=<dir>]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { isMain, walk } from './lib/walk.ts';

export interface LinkIssue {
  /** The page holding the link, e.g. dist/running/index.html. */
  file: string;
  /** The link's site path, with its fragment. */
  path: string;
  /** The chapter the link sits in (`data-chapter-link`), if any. */
  chapter?: string;
  message: string;
}

export const STORY_PAGE = '/running/story/';
const IGNORED = [/^\/_astro\//, /^\/running\/api\//];
const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ID = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function attributes(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) out.set(match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  return out;
}

const decodeEntities = (s: string) =>
  s.replace(/&(amp|quot|#39|apos|lt|gt);/g, (_, e: string) => ({ amp: '&', quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>' })[e]!);

function decodePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

/** The built file a site path (no fragment or query) resolves to, relative to dist/. */
function targetFile(path: string): string {
  const rel = decodePath(path).slice(1);
  return path.endsWith('/') ? `${rel}index.html` : rel;
}

/** What a run looked at, for the summary line. */
export interface LinkStats {
  pages: number;
  links: number;
}

export function checkLinks(distDir: string, stats: LinkStats = { pages: 0, links: 0 }): LinkIssue[] {
  const root = dirname(resolve(distDir));
  const dist = basename(resolve(distDir));
  const pages = walk(root, dist).filter((f) => f.endsWith('.html'));
  const exists = new Map<string, boolean>();
  const isFile = (rel: string) => {
    if (!exists.has(rel)) {
      const abs = join(root, dist, rel);
      exists.set(rel, existsSync(abs) && statSync(abs).isFile());
    }
    return exists.get(rel)!;
  };
  let storyIds: Set<string> | undefined;
  const idsOfStory = () => {
    if (!storyIds) {
      const file = join(root, dist, targetFile(STORY_PAGE));
      const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
      storyIds = new Set([...html.matchAll(ID)].map((m) => decodeEntities(m[1] ?? m[2] ?? m[3] ?? '')));
    }
    return storyIds;
  };
  const storyFile = `${dist}/${targetFile(STORY_PAGE)}`;

  const issues: LinkIssue[] = [];
  stats.pages = pages.length;
  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf8');
    for (const match of html.matchAll(TAG)) {
      const attrs = attributes(match[2] ?? '');
      const raw = attrs.get('href');
      if (raw === undefined) continue;
      let href = decodeEntities(raw.trim());
      // The story page's own #… links are links to the story page.
      if (href.startsWith('#') && page === storyFile) href = `${STORY_PAGE}${href}`;
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      if (IGNORED.some((pattern) => pattern.test(href))) continue;
      stats.links++;

      const hashAt = href.indexOf('#');
      const fragment = hashAt >= 0 ? href.slice(hashAt + 1) : '';
      const path = (hashAt >= 0 ? href.slice(0, hashAt) : href).replace(/\?.*$/, '');
      const chapter = attrs.get('data-chapter-link');
      const shown = fragment ? `${path}#${fragment}` : path;
      const report = () =>
        issues.push({
          file: page,
          path: shown,
          ...(chapter ? { chapter } : {}),
          message: `${chapter ? `chapter "${chapter}" ` : ''}links to ${shown}, which the build didn't make`,
        });

      if (!isFile(targetFile(path))) report();
      else if (path === STORY_PAGE && fragment && !idsOfStory().has(decodePath(fragment))) report();
    }
  }
  return issues;
}

if (isMain(import.meta.url)) {
  const distArg = process.argv.find((a) => a.startsWith('--dist='))?.slice('--dist='.length);
  const distDir = resolve(distArg ?? join(import.meta.dirname, '..', 'dist'));
  if (!existsSync(distDir)) {
    console.error(`error: ${distDir} doesn't exist: build the site first`);
    process.exit(1);
  }
  const stats = { pages: 0, links: 0 };
  const issues = checkLinks(distDir, stats);
  for (const issue of issues) console.error(`error: ${issue.file}: ${issue.message}`);
  console.log(`check-links: ${basename(distDir)}/: ${stats.pages} page(s), ${stats.links} site link(s), ${issues.length} issue(s)`);
  if (issues.length > 0) process.exit(1);
}
