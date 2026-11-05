// The journey story as its page shows it (spec 003; data-model.md §10): the approved files from
// the store, chapters oldest first with their prose parsed, their dates as shown and their figures
// by ID, then the closing section and the note. Undefined until a chapter exists, so nothing
// anywhere renders (FR-042). Memoised per store.
//
// validate-data refuses everything the page couldn't show before the gate builds. A plain build
// runs only the schema and loader checks, so this still throws DataValidationError on what would
// otherwise reach the page wrong: chapters without the note or page wording (FR-008, FR-039), stray
// markup, or a placeholder naming no figure. Its messages name file, entry and field, and never
// quote story text (FR-035).
import { DataValidationError, type DataIssue } from '../../../shared/storage/index.ts';
import {
  parseProse,
  parseText,
  parseWhen,
  placedFigures,
  sortChapters,
  sourceText,
  whenParts,
  type Paragraph,
  type ParsedText,
  type WhenPart,
} from '../domain/journey.ts';
import { runningStore } from './load.ts';
import { perStore } from './memo.ts';
import type { JourneyChapter, JourneyPage, RunningStore } from './store/index.ts';

const JOURNEY_DIR = 'data/running/owner/journey';
export const chapterFile = (id: string) => `${JOURNEY_DIR}/chapters/${id}/chapter.yaml`;

/** A figure as the page shows it. */
export interface FigureView {
  id: string;
  label: string;
  /** `as_of` as shown: "15 Mar 2001" or "March 2001". */
  asOf: string;
  text: string;
  /** "Garmin <device>", "Garmin" or the derived wording; undefined for the owner's own figure. */
  source?: string;
}

export interface ChapterView {
  id: string;
  name: string;
  when: WhenPart[];
  paragraphs: Paragraph[];
  figures: Readonly<Record<string, FigureView>>;
  takeaway: string;
}

export interface JourneyView {
  page: JourneyPage;
  /** Oldest first (FR-002). At least one. */
  chapters: ChapterView[];
  closing?: { heading: string; paragraphs: Paragraph[] };
  note: string;
}

export function loadJourney(store: RunningStore = runningStore()): Promise<JourneyView | undefined> {
  return load(store);
}

const load = perStore(async (store: RunningStore): Promise<JourneyView | undefined> => {
  const { journey } = await store.getOwner();
  if (journey.chapters.length === 0) return undefined;

  const issues: DataIssue[] = [];
  const issue = (file: string, entry: string, field: string, message: string) => issues.push({ file, entry, field, message, severity: 'error' });
  const parsed = (file: string, entry: string, field: string, text: ParsedText): Paragraph[] => {
    for (const found of text.issues) issue(file, entry, `${field}, paragraph ${found.paragraph}`, found.message);
    return text.paragraphs;
  };

  if (!journey.note) issue(`${JOURNEY_DIR}/note.yaml`, 'note', '', 'is missing: the story needs its approved note before it can be published (FR-008)');
  if (!journey.page) issue(`${JOURNEY_DIR}/page.yaml`, 'page wording', '', 'is missing: the story needs its approved page wording before it can be published (FR-039)');

  const chapters = sortChapters(journey.chapters).map((chapter) => chapterView(chapter, issue, parsed));
  const closing = journey.closing && {
    heading: journey.closing.heading,
    paragraphs: parsed(`${JOURNEY_DIR}/closing.yaml`, 'closing section', 'text', parseText(journey.closing.text)),
  };
  if (issues.length > 0) throw new DataValidationError(issues);
  return { page: journey.page!, chapters, ...(closing ? { closing } : {}), note: journey.note!.text };
});

function chapterView(
  chapter: JourneyChapter,
  issue: (file: string, entry: string, field: string, message: string) => void,
  parsed: (file: string, entry: string, field: string, text: ParsedText) => Paragraph[],
): ChapterView {
  const file = chapterFile(chapter.id);
  const entry = `chapter "${chapter.id}"`;
  const when = parseWhen(chapter.when);
  if (!when) issue(file, entry, 'when', "names a day that doesn't exist");
  const prose = parseProse(chapter.prose);
  const paragraphs = parsed(file, entry, 'prose', prose);
  if (paragraphs[0]?.kind === 'figure') issue(file, entry, 'prose, paragraph 1', 'is a figure on its own: a chapter opens with prose');

  const figures: Record<string, FigureView> = {};
  for (const figure of chapter.figures ?? []) {
    const asOf = parseWhen(figure.as_of);
    const source = sourceText(figure.garmin);
    figures[figure.id] = { id: figure.id, label: figure.label, asOf: asOf ? whenParts(asOf)[0]!.text : figure.as_of, text: figure.text, ...(source ? { source } : {}) };
  }
  for (const id of placedFigures(prose)) {
    if (!figures[id]) issue(file, entry, 'prose', `has a placeholder naming no figure in this chapter's figures`);
  }

  return { id: chapter.id, name: chapter.name, when: when ? whenParts(when) : [], paragraphs, figures, takeaway: chapter.takeaway };
}
