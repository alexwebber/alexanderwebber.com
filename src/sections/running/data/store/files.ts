// Running's file map: reads and schema-validates every file under data/running/
// (contracts/data-files.md layout). Shared by JsonFileStore (which throws on any problem) and
// ../../validate.ts (which adds referential checks and reports everything at once).
//
// Approved text is checked here, not in validate.ts, because the store and the build's first step
// load through this: the campaign story's hash (spec 002) and each journey file's hash, photos'
// bytes included (specs/003-journey-story/data-model.md §2). Messages about journey files never
// quote a value from them (FR-035).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fieldPath, listDataFiles, parseDataFile, SchemaSet, type DataIssue, type SchemaIssue } from '../../../../shared/storage/index.ts';
import type {
  Campaign,
  CampaignFigures,
  CampaignStory,
  Goal,
  HealthExclusion,
  HealthSeries,
  JourneyChapter,
  JourneyClosing,
  JourneyNote,
  JourneyPage,
  LabMeasurement,
  Manifest,
  ManualMetrics,
  Race,
  RaceTrack,
  RefreshRecord,
  Run,
  RunOverride,
  SectionSettings,
  UpcomingRace,
} from './generated/index.ts';
import { RUNNING_SCHEMAS, type RunningSchema } from './schemas.ts';

export const DATA_DIR = 'data/running';
export const PUBLISHED_DIR = `${DATA_DIR}/published`;
export const OWNER_DIR = `${DATA_DIR}/owner`;
const CAMPAIGNS_FILE = `${OWNER_DIR}/campaigns.yaml`;

/** A value and the repo-relative file it came from. */
export interface Loaded<T> {
  file: string;
  value: T;
}

export interface RunningData {
  runs: Loaded<Run>[];
  raceTracks: Loaded<RaceTrack>[];
  health: Loaded<HealthSeries>[];
  refresh: Loaded<RefreshRecord> | undefined;
  manifest: Loaded<Manifest> | undefined;
  fundraising: Loaded<CampaignFigures>[];
  section: Loaded<SectionSettings> | undefined;
  goals: Loaded<Goal[]> | undefined;
  upcomingRaces: Loaded<UpcomingRace[]> | undefined;
  races: Loaded<Race>[];
  overrides: Loaded<RunOverride[]> | undefined;
  exclusions: Loaded<HealthExclusion[]> | undefined;
  lab: Loaded<LabMeasurement>[];
  manualMetrics: Loaded<ManualMetrics> | undefined;
  campaigns: Loaded<Campaign[]> | undefined;
  stories: Loaded<CampaignStory>[];
  /** The journey story's files (spec 003): each approved, or dropped with an error. */
  journey: {
    page?: Loaded<JourneyPage>;
    note?: Loaded<JourneyNote>;
    closing?: Loaded<JourneyClosing>;
    /** One per journey/chapters/<id>/chapter.yaml, sorted by file. */
    chapters: Loaded<JourneyChapter>[];
  };
  /** Every file under data/running/, repo-relative (photos included). */
  files: string[];
}

export interface LoadResult {
  data: RunningData;
  issues: DataIssue[];
}

const LIST_NOUNS: Partial<Record<RunningSchema, string>> = {
  'owner/goals': 'goal',
  'owner/upcoming-races': 'upcoming race',
  'owner/run-overrides': 'override',
  'owner/health-exclusions': 'exclusion',
  'owner/campaigns': 'campaign',
};

/**
 * The schema's x-error on `approved`, for when the field is missing (FR-052). The shared machinery
 * says "is required" for any missing field, because x-error describes a value that is there.
 */
const NEEDS_APPROVAL = "needs the owner's approval before it can be published";

const JOURNEY_SCHEMAS: ReadonlySet<RunningSchema> = new Set<RunningSchema>(['owner/journey-page', 'owner/journey-note', 'owner/journey-closing', 'owner/journey-chapter']);
const APPROVED_TEXT: ReadonlySet<RunningSchema> = new Set<RunningSchema>(['owner/campaign-story', ...JOURNEY_SCHEMAS]);

function problemMessage(schema: RunningSchema, value: unknown, problem: SchemaIssue): string {
  const noApproval = APPROVED_TEXT.has(schema) && problem.message === 'is required' && fieldPath(problem.path) === 'approved';
  if (noApproval) return NEEDS_APPROVAL;
  return JOURNEY_SCHEMAS.has(schema) ? withoutValue(problem.message, problem.path.reduce<unknown>(at, value)) : problem.message;
}

/**
 * The shared schema messages start with the offending value when it's a string or a number
 * ('"…" must be one line of text'). In a journey file that value is story text, so it's dropped
 * (FR-035): the file, entry and field path are enough to find it.
 */
function withoutValue(message: string, value: unknown): string {
  if (value === null || value === undefined || typeof value === 'object') return message;
  const shown = typeof value === 'string' ? `"${value}" ` : `${String(value)} `;
  return message.startsWith(shown) ? message.slice(shown.length) : message;
}

/** What an approval is tied to: the sha256 of a story's text as parsed (FR-052, SC-007). */
export function storySha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export type JourneyKind = 'chapter' | 'closing' | 'note' | 'page';

/**
 * Each journey file's hashed fields (data-model.md §2), by name: a field added later (a video, say)
 * isn't in the list, so it doesn't move the hash of chapters already approved (FR-053).
 */
export const JOURNEY_HASHED_FIELDS: Readonly<Record<JourneyKind, readonly string[]>> = {
  chapter: ['id', 'name', 'when', 'order', 'prose', 'takeaway', 'figures', 'photos'],
  closing: ['heading', 'text'],
  note: ['text'],
  page: ['title', 'description', 'share_text', 'link_label'],
};
/** A chapter photo's hashed fields; `sha256`, the sha256 of the photo file's bytes, is added to them. */
export const JOURNEY_PHOTO_FIELDS = ['file', 'description', 'caption'] as const;

/** JSON with keys sorted at every level (by UTF-16 code unit) and no whitespace. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256Hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

/**
 * What a journey file's approval is tied to (FR-033, research.md R3): the sha256 of the canonical
 * JSON (keys sorted at every level, no whitespace, UTF-8) of the file's hashed fields only, as YAML
 * parsed them. Absent optional fields are left out, not hashed as null. Each chapter photo
 * contributes its `file`, `description` and `caption`, plus `sha256`: the sha256 of the photo
 * file's bytes (`photoBytes`, by file name), so a photo swapped under the same name needs a fresh
 * approval. Throws when a listed photo has no bytes: callers report that first.
 */
export function journeySha256(kind: JourneyKind, value: unknown, photoBytes: ReadonlyMap<string, Uint8Array> = new Map()): string {
  const hashed: Record<string, unknown> = {};
  for (const field of JOURNEY_HASHED_FIELDS[kind]) {
    const fieldValue = at(value, field);
    if (fieldValue === undefined) continue;
    if (kind === 'chapter' && field === 'photos' && Array.isArray(fieldValue)) {
      hashed[field] = fieldValue.map((photo) => {
        const entry: Record<string, unknown> = {};
        for (const key of JOURNEY_PHOTO_FIELDS) if (at(photo, key) !== undefined) entry[key] = at(photo, key);
        const bytes = photoBytes.get(String(at(photo, 'file')));
        if (!bytes) throw new Error('a listed photo has no bytes to hash');
        entry.sha256 = sha256Hex(bytes);
        return entry;
      });
    } else {
      hashed[field] = fieldValue;
    }
  }
  return sha256Hex(canonicalJson(hashed));
}

const JOURNEY_KIND: Partial<Record<RunningSchema, JourneyKind>> = {
  'owner/journey-chapter': 'chapter',
  'owner/journey-closing': 'closing',
  'owner/journey-note': 'note',
  'owner/journey-page': 'page',
};

/** The bytes of the photos a chapter lists, read from its folder, and the indexes of any missing. */
export function chapterPhotoBytes(root: string, chapterFile: string, chapter: unknown): { bytes: Map<string, Uint8Array>; missing: number[] } {
  const folder = chapterFile.slice(0, chapterFile.lastIndexOf('/'));
  const bytes = new Map<string, Uint8Array>();
  const missing: number[] = [];
  const photos = at(chapter, 'photos');
  (Array.isArray(photos) ? photos : []).forEach((photo, i) => {
    const name = String(at(photo, 'file'));
    const path = join(root, folder, name);
    if (existsSync(path)) bytes.set(name, readFileSync(path));
    else missing.push(i);
  });
  return { bytes, missing };
}

const MANUAL_NOUNS: Record<string, string> = {
  training_status: 'training status',
  race_predictions: 'race prediction',
};

type Path = (string | number)[];

function at(value: unknown, key: string | number): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

/** Splits a JSON path into the FR-070 "entry" and "field" for a file of the given schema. */
export function locate(schema: RunningSchema, value: unknown, path: Path): { entry: string; field: string } {
  const [head, ...rest] = path;
  const listNoun = LIST_NOUNS[schema];
  if (listNoun && typeof head === 'number') {
    const item = at(value, head);
    const id = at(item, 'id');
    let label = typeof id === 'string' ? `"${id}"` : String(head + 1);
    if (schema === 'owner/health-exclusions') label = `${head + 1} (${at(item, 'metric')} ${at(item, 'date')})`;
    return { entry: `${listNoun} ${label}`, field: fieldPath(rest) };
  }
  if (schema === 'owner/manual-metrics' && typeof head === 'string' && typeof rest[0] === 'number') {
    const asOf = at(at(at(value, head), rest[0]), 'as_of');
    const noun = MANUAL_NOUNS[head] ?? head;
    const label = `${noun} ${rest[0] + 1}${typeof asOf === 'string' ? ` (as of ${asOf})` : ''}`;
    return { entry: label, field: fieldPath(rest.slice(1)) };
  }
  const named: Partial<Record<RunningSchema, [string, string]>> = {
    'published/run': ['run', 'id'],
    'published/race-track': ['race track', 'id'],
    'published/health-series': ['health series', 'metric'],
    'published/fundraising-campaign': ['campaign figures', 'campaign_id'],
    'owner/race': ['race', 'slug'],
    'owner/campaign-story': ['story', 'campaign'],
  };
  const journeyEntry = JOURNEY_ENTRY[schema];
  if (journeyEntry) return { entry: journeyEntry(value), field: fieldPath(path) };
  const entry = named[schema];
  if (entry) {
    const id = at(value, entry[1]);
    return { entry: typeof id === 'string' ? `${entry[0]} "${id}"` : entry[0], field: fieldPath(path) };
  }
  return { entry: '', field: fieldPath(path) };
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The entry of a journey file's messages (contracts/content-files.md *Messages*): never its text. */
const JOURNEY_ENTRY: Partial<Record<RunningSchema, (value: unknown) => string>> = {
  'owner/journey-chapter': (value) => {
    const id = at(value, 'id');
    return typeof id === 'string' && SLUG.test(id) ? `chapter "${id}"` : 'chapter';
  },
  'owner/journey-closing': () => 'closing section',
  'owner/journey-note': () => 'note',
  'owner/journey-page': () => 'page wording',
};

/** Recognises a data file's schema from its path; undefined for photos, logos and unexpected files. */
function schemaForFile(file: string): RunningSchema | undefined {
  const rel = file.slice(DATA_DIR.length + 1);
  const rules: [RegExp, RunningSchema][] = [
    [/^published\/runs\/\d{4}\/[^/]+\.json$/, 'published/run'],
    [/^published\/race-tracks\/[^/]+\.json$/, 'published/race-track'],
    [/^published\/health\/[^/]+\/\d{4}\.json$/, 'published/health-series'],
    [/^published\/state\/refresh\.json$/, 'published/refresh'],
    [/^published\/state\/manifest\.json$/, 'published/manifest'],
    [/^published\/fundraising\/[^/]+\.json$/, 'published/fundraising-campaign'],
    [/^owner\/section\.yaml$/, 'owner/section'],
    [/^owner\/goals\.yaml$/, 'owner/goals'],
    [/^owner\/upcoming-races\.yaml$/, 'owner/upcoming-races'],
    [/^owner\/run-overrides\.yaml$/, 'owner/run-overrides'],
    [/^owner\/health-exclusions\.yaml$/, 'owner/health-exclusions'],
    [/^owner\/manual-metrics\.yaml$/, 'owner/manual-metrics'],
    [/^owner\/campaigns\.yaml$/, 'owner/campaigns'],
    [/^owner\/stories\/[^/]+\.yaml$/, 'owner/campaign-story'],
    [/^owner\/races\/[^/]+\/race\.yaml$/, 'owner/race'],
    [/^owner\/lab\/[^/]+\.yaml$/, 'owner/lab'],
    [/^owner\/journey\/page\.yaml$/, 'owner/journey-page'],
    [/^owner\/journey\/note\.yaml$/, 'owner/journey-note'],
    [/^owner\/journey\/closing\.yaml$/, 'owner/journey-closing'],
    [/^owner\/journey\/chapters\/[^/]+\/chapter\.yaml$/, 'owner/journey-chapter'],
  ];
  return rules.find(([pattern]) => pattern.test(rel))?.[1];
}

export const PHOTO_FILE = /^data\/running\/owner\/races\/[^/]+\/[^/]+\.(jpg|webp|avif)$/;
/** A journey chapter's photo, beside its chapter.yaml. Apart from PHOTO_FILE, whose photos race.yaml lists. */
export const JOURNEY_PHOTO_FILE = /^data\/running\/owner\/journey\/chapters\/[^/]+\/[^/]+\.(jpg|webp|avif)$/;
/** A charity logo, named by a campaign's charity.logo.file (T116). */
export const LOGO_FILE = /^data\/running\/owner\/logos\/[^/]+\.(webp|avif)$/;
const IGNORED_FILE = /(^|\/)(\.gitkeep|README\.md)$/;

const schemaSets = new Map<string, SchemaSet<RunningSchema>>();
function schemasFor(root: string): SchemaSet<RunningSchema> {
  let set = schemaSets.get(root);
  if (!set) {
    set = new SchemaSet(join(root, 'schemas'), RUNNING_SCHEMAS);
    schemaSets.set(root, set);
  }
  return set;
}

/**
 * Loads everything under `<root>/data/running/`. Absent files are simply absent (no data yet).
 * The schemas come from `<schemaRoot>/schemas/` (default: the same root).
 */
export function loadRunningData(root: string, schemaRoot: string = root): LoadResult {
  const schemas = schemasFor(schemaRoot);
  const issues: DataIssue[] = [];
  const data: RunningData = {
    runs: [],
    raceTracks: [],
    health: [],
    refresh: undefined,
    manifest: undefined,
    fundraising: [],
    section: undefined,
    goals: undefined,
    upcomingRaces: undefined,
    races: [],
    overrides: undefined,
    exclusions: undefined,
    lab: [],
    manualMetrics: undefined,
    campaigns: undefined,
    stories: [],
    journey: { chapters: [] },
    files: listDataFiles(root, DATA_DIR),
  };

  for (const file of data.files) {
    const schema = schemaForFile(file);
    if (!schema) {
      if (!PHOTO_FILE.test(file) && !JOURNEY_PHOTO_FILE.test(file) && !LOGO_FILE.test(file) && !IGNORED_FILE.test(file)) {
        issues.push({ file, entry: '', field: '', severity: 'error', message: 'is not an expected data file (check the name and folder)' });
      }
      continue;
    }
    const parsed = parseDataFile(file, readFileSync(join(root, file), 'utf8'));
    if ('error' in parsed) {
      issues.push({ file, entry: '', field: '', severity: 'error', message: parsed.error });
      continue;
    }
    if (parsed.value === null && schema.startsWith('owner/')) continue; // an empty or all-comment file
    const value = parsed.value;
    const problems = schemas.validate(schema, value);
    for (const problem of problems) {
      issues.push({ file, ...locate(schema, value, problem.path), message: problemMessage(schema, value, problem), severity: 'error' });
    }
    if (problems.length > 0) continue;
    // Checked here, not with the other story rules in validate.ts, because the store and the build's
    // first step load through this: text changed after approval can't reach a page by any path.
    if (schema === 'owner/campaign-story') {
      const { text, approved } = value as CampaignStory;
      if (approved.text_sha256 !== storySha256(text)) {
        issues.push({ file, entry: '', field: 'approved.text_sha256', message: 'the text has changed since it was approved; the owner must approve it again', severity: 'error' });
        continue;
      }
    }
    const kind = JOURNEY_KIND[schema];
    if (kind) {
      const { entry } = locate(schema, value, []);
      const { bytes, missing } = kind === 'chapter' ? chapterPhotoBytes(root, file, value) : { bytes: new Map<string, Uint8Array>(), missing: [] };
      // Only the loader reads the bytes, so the rule is its own, and the hash isn't checked as well.
      for (const i of missing) issues.push({ file, entry, field: `photos[${i}].file`, message: "is listed but isn't in the chapter's folder", severity: 'error' });
      if (missing.length > 0) continue;
      if (at(at(value, 'approved'), 'sha256') !== journeySha256(kind, value, bytes)) {
        issues.push({ file, entry, field: 'approved.sha256', message: 'has changed since it was approved; the owner must approve it again', severity: 'error' });
        continue;
      }
    }
    store(data, schema, { file, value });
  }

  data.runs.sort((a, b) => b.value.date.localeCompare(a.value.date) || b.value.id.localeCompare(a.value.id));
  data.races.sort((a, b) => b.value.date.localeCompare(a.value.date) || a.value.slug.localeCompare(b.value.slug));
  data.lab.sort((a, b) => a.value.date.localeCompare(b.value.date) || a.value.type.localeCompare(b.value.type));
  data.fundraising.sort((a, b) => a.value.campaign_id.localeCompare(b.value.campaign_id));
  data.stories.sort((a, b) => a.value.campaign.localeCompare(b.value.campaign));
  data.journey.chapters.sort((a, b) => a.file.localeCompare(b.file));
  return { data, issues };
}

/**
 * The IDs of the campaigns with a published figures file (research.md R13), for integration.ts,
 * which asks while the site's config loads: it reads the campaign list and tests for each file,
 * rather than loading the whole data tree a second time. A list it can't read counts as none here,
 * because the build's validation stops on it with the file/entry/field message.
 */
export function campaignsWithFigures(root: string = process.cwd()): string[] {
  const path = join(root, CAMPAIGNS_FILE);
  if (!existsSync(path)) return [];
  const parsed = parseDataFile(CAMPAIGNS_FILE, readFileSync(path, 'utf8'));
  if ('error' in parsed || !Array.isArray(parsed.value)) return [];
  return parsed.value
    .map((campaign) => at(campaign, 'id'))
    .filter((id): id is string => typeof id === 'string' && existsSync(join(root, PUBLISHED_DIR, 'fundraising', `${id}.json`)));
}

/**
 * The IDs of the journey story's chapters (data-model.md §10): the folder names under
 * journey/chapters/ that hold a chapter.yaml, sorted. For integration.ts, which asks while the
 * site's config loads, as campaignsWithFigures() does, so the tree isn't loaded twice. A closing
 * section or note alone gives none, and so does a chapter folder with no chapter.yaml. Whether each
 * chapter is valid and approved is the build's first step's to say, which stops on any that isn't.
 */
export function journeyChapterIds(root: string = process.cwd()): string[] {
  const dir = join(root, OWNER_DIR, 'journey', 'chapters');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'chapter.yaml')))
    .map((entry) => entry.name)
    .sort();
}

function store(data: RunningData, schema: RunningSchema, loaded: Loaded<unknown>): void {
  switch (schema) {
    case 'published/run': data.runs.push(loaded as Loaded<Run>); break;
    case 'published/race-track': data.raceTracks.push(loaded as Loaded<RaceTrack>); break;
    case 'published/health-series': data.health.push(loaded as Loaded<HealthSeries>); break;
    case 'published/refresh': data.refresh = loaded as Loaded<RefreshRecord>; break;
    case 'published/manifest': data.manifest = loaded as Loaded<Manifest>; break;
    case 'published/fundraising-campaign': data.fundraising.push(loaded as Loaded<CampaignFigures>); break;
    case 'owner/section': data.section = loaded as Loaded<SectionSettings>; break;
    case 'owner/goals': data.goals = loaded as Loaded<Goal[]>; break;
    case 'owner/upcoming-races': data.upcomingRaces = loaded as Loaded<UpcomingRace[]>; break;
    case 'owner/race': data.races.push(loaded as Loaded<Race>); break;
    case 'owner/run-overrides': data.overrides = loaded as Loaded<RunOverride[]>; break;
    case 'owner/health-exclusions': data.exclusions = loaded as Loaded<HealthExclusion[]>; break;
    case 'owner/lab': data.lab.push(loaded as Loaded<LabMeasurement>); break;
    case 'owner/manual-metrics': data.manualMetrics = loaded as Loaded<ManualMetrics>; break;
    case 'owner/campaigns': data.campaigns = loaded as Loaded<Campaign[]>; break;
    case 'owner/campaign-story': data.stories.push(loaded as Loaded<CampaignStory>); break;
    case 'owner/journey-page': data.journey.page = loaded as Loaded<JourneyPage>; break;
    case 'owner/journey-note': data.journey.note = loaded as Loaded<JourneyNote>; break;
    case 'owner/journey-closing': data.journey.closing = loaded as Loaded<JourneyClosing>; break;
    case 'owner/journey-chapter': data.journey.chapters.push(loaded as Loaded<JourneyChapter>); break;
  }
}
