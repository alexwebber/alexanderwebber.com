// The CV page's loader (T045): reads the approved CV through CvStore once and shapes it for the
// components: the page, the pitch separated out and the other blocks in file order
// (data-model.md *Text block*), the timeline with each item's parsed `when` and its words, the
// career scale, each theme's packed strip, the drill's lists, and the downloads. Undefined when
// there's no CV. Pure apart from the store; memoised per store.
import type { CvStore } from './store/index.ts';
import type { CvBlock, CvChange, CvDownloadFile, CvNextItem, CvPage, CvRole, CvStory, CvTheme, CvThread } from './store/index.ts';
import { durationText, parseAsOf, parseWhen, whenParts, whenText, type ParsedWhen, type WhenPart, type YearMonth } from '../domain/dates.ts';
import { byTime, themeList, threadList } from '../domain/lists.ts';
import { pack, type Packed } from '../domain/pack.ts';
import { careerScale, type CareerScale } from '../domain/scale.ts';

/** A dated item's `when`, parsed and in words. */
export interface WhenView {
  parsed: ParsedWhen;
  /** The *Shown as* words (whenText). */
  text: string;
  /** The same words in pieces, dates marked for <time>. */
  parts: WhenPart[];
  /** "4 years", "2 years 3 months so far"; undefined for a point. */
  duration?: string;
  /** On the career scale, 0..1. */
  x0: number;
  x1: number;
}

export interface ChangeView {
  kind: 'change';
  id: string;
  item: CvChange;
  when: WhenView;
  theme: CvTheme;
  thread?: CvThread;
  story?: CvStory;
}

export interface RoleView {
  kind: 'role';
  id: string;
  item: CvRole;
  when: WhenView;
}

export interface NextView {
  kind: 'next';
  id: string;
  item: CvNextItem;
}

/** A packed strip of marks (a theme's changes, or the roles) for the overview's tiles. */
export type Strip = Packed<{ id: string; x0: number; x1: number; point: boolean; rough: boolean; ongoing: boolean }>;

export interface ThemeView {
  theme: CvTheme;
  /** Oldest first. */
  changes: ChangeView[];
  /** How many add value (★). */
  valueCount: number;
  strip: Strip;
}

export interface ThreadView {
  thread: CvThread;
  /** In time order; at least two. */
  changes: ChangeView[];
  strip: Strip;
}

export interface TimelineView {
  asOf: YearMonth;
  scale: CareerScale;
  themes: ThemeView[];
  /** Oldest first. */
  roles: RoleView[];
  rolesStrip: Strip;
  /** In file order; only threads with two or more changes. */
  threads: ThreadView[];
  /** In file order. */
  next: NextView[];
  /** Every change, in file order. */
  changes: ChangeView[];
}

export interface CvView {
  page: CvPage;
  pitch: CvBlock;
  /** Every block but the pitch, in file order. */
  blocks: CvBlock[];
  timeline: TimelineView;
  downloads: CvDownloadFile[];
}

const cache = new WeakMap<CvStore, CvView | undefined>();

/** The CV shaped for the page, or undefined when there is none. Throws as CvStore does. */
export function loadCv(store: CvStore): CvView | undefined {
  if (cache.has(store)) return cache.get(store);
  const data = store.load();
  const view = data && shape(data.page, data.blocks, data.timeline, data.downloads);
  cache.set(store, view);
  return view;
}

function parsed(when: string, asOf: string): ParsedWhen {
  const result = parseWhen(when, asOf).when;
  // The store has validated every `when`; this only guards a caller that skipped it.
  if (!result) throw new Error('a `when` is not a date form');
  return result;
}

function stripOf(items: { id: string; when: WhenView }[]): Strip {
  return pack(items.map(({ id, when }) => ({ id, x0: when.x0, x1: when.x1, point: when.parsed.kind === 'point', rough: when.parsed.rough, ongoing: when.parsed.ongoing })));
}

function shape(page: CvPage, blocks: CvBlock[], timeline: { themes: CvTheme[]; threads: CvThread[]; roles: CvRole[]; changes: CvChange[]; next: CvNextItem[] }, downloads: CvDownloadFile[]): CvView {
  const asOf = parseAsOf(page.as_of);
  const whens = new Map<string, ParsedWhen>();
  for (const c of timeline.changes) whens.set(`change:${c.id}`, parsed(c.when, page.as_of));
  for (const r of timeline.roles) whens.set(`role:${r.id}`, parsed(r.when, page.as_of));
  const scale = careerScale([...whens.values()].map((w) => w.start), asOf);
  const view = (key: string): WhenView => {
    const w = whens.get(key)!;
    const [x0, x1] = scale.span(w);
    return { parsed: w, text: whenText(w), parts: whenParts(w), duration: durationText(w), x0, x1 };
  };

  const themes = new Map(timeline.themes.map((t) => [t.id, t]));
  const threads = new Map(timeline.threads.map((t) => [t.id, t]));
  const stories = new Map(blocks.flatMap((b) => b.stories ?? []).map((s) => [s.id, s]));
  const changes: ChangeView[] = timeline.changes.map((item) => ({
    kind: 'change',
    id: item.id,
    item,
    when: view(`change:${item.id}`),
    theme: themes.get(item.theme)!,
    thread: item.thread ? threads.get(item.thread) : undefined,
    story: item.value ? stories.get(item.value) : undefined,
  }));
  const dated = changes.map((c) => ({ ...c, when: c.when.parsed, theme: c.item.theme, thread: c.item.thread, view: c }));
  const roles = byTime(timeline.roles.map((item) => ({ kind: 'role' as const, id: item.id, item, when: view(`role:${item.id}`) })).map((r) => ({ ...r, when: r.when.parsed, view: r }))).map((r) => r.view);

  const pitch = blocks.find((b) => b.kind === 'pitch')!;
  return {
    page,
    pitch,
    blocks: blocks.filter((b) => b !== pitch),
    timeline: {
      asOf,
      scale,
      themes: timeline.themes.map((theme) => {
        const list = themeList(dated, theme.id).map((c) => c.view);
        return { theme, changes: list, valueCount: list.filter((c) => c.story).length, strip: stripOf(list) };
      }),
      roles,
      rolesStrip: stripOf(roles),
      threads: timeline.threads.flatMap((thread) => {
        const list = threadList(dated, thread.id)?.map((c) => c.view);
        return list ? [{ thread, changes: list, strip: stripOf(list) }] : [];
      }),
      next: timeline.next.map((item) => ({ kind: 'next' as const, id: item.id, item })),
      changes,
    },
    downloads,
  };
}
