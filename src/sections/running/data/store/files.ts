// Running's file map: reads and schema-validates every file under data/running/
// (contracts/data-files.md layout). Shared by JsonFileStore (which throws on any problem) and
// ../../validate.ts (which adds referential checks and reports everything at once).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fieldPath, listDataFiles, parseDataFile, SchemaSet, type DataIssue, type SchemaIssue } from '../../../../shared/storage/index.ts';
import type {
  Campaign,
  CampaignFigures,
  CampaignStory,
  Goal,
  HealthExclusion,
  HealthSeries,
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

function problemMessage(schema: RunningSchema, problem: SchemaIssue): string {
  const noApproval = schema === 'owner/campaign-story' && problem.message === 'is required' && fieldPath(problem.path) === 'approved';
  return noApproval ? NEEDS_APPROVAL : problem.message;
}

/** What an approval is tied to: the sha256 of a story's text as parsed (FR-052, SC-007). */
export function storySha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
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
  const entry = named[schema];
  if (entry) {
    const id = at(value, entry[1]);
    return { entry: typeof id === 'string' ? `${entry[0]} "${id}"` : entry[0], field: fieldPath(path) };
  }
  return { entry: '', field: fieldPath(path) };
}

/** Recognises a data file's schema from its path; undefined for photos and unexpected files. */
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
  ];
  return rules.find(([pattern]) => pattern.test(rel))?.[1];
}

export const PHOTO_FILE = /^data\/running\/owner\/races\/[^/]+\/[^/]+\.(jpg|webp|avif)$/;
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
    files: listDataFiles(root, DATA_DIR),
  };

  for (const file of data.files) {
    const schema = schemaForFile(file);
    if (!schema) {
      if (!PHOTO_FILE.test(file) && !IGNORED_FILE.test(file)) {
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
      issues.push({ file, ...locate(schema, value, problem.path), message: problemMessage(schema, problem), severity: 'error' });
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
    store(data, schema, { file, value });
  }

  data.runs.sort((a, b) => b.value.date.localeCompare(a.value.date) || b.value.id.localeCompare(a.value.id));
  data.races.sort((a, b) => b.value.date.localeCompare(a.value.date) || a.value.slug.localeCompare(b.value.slug));
  data.lab.sort((a, b) => a.value.date.localeCompare(b.value.date) || a.value.type.localeCompare(b.value.type));
  data.fundraising.sort((a, b) => a.value.campaign_id.localeCompare(b.value.campaign_id));
  data.stories.sort((a, b) => a.value.campaign.localeCompare(b.value.campaign));
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
  }
}
