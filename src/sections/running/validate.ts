// Validates every published and owner file under data/running/ (T038, FR-070): the schemas, then
// the referential checks of contracts/data-files.md, the fundraising files' (spec 002) and the
// journey story's (specs/003-journey-story/contracts/content-files.md). scripts/validate-data.ts
// runs it in the gate and prints the file/entry/field messages. Messages about the journey files
// never quote a value from them (FR-035): they name the file, chapter ID, field and paragraph.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { today as londonToday } from '../../shared/format/dates.ts';
import { parseTime } from '../../shared/format/parse.ts';
import type { DataIssue } from '../../shared/storage/index.ts';
import { LOGO_FILE, OWNER_DIR, PHOTO_FILE, PUBLISHED_DIR, locate, loadRunningData } from './data/store/files.ts';
import type { JourneyChapter, RacePredictionEntry } from './data/store/index.ts';
import { SECTION_DEFAULTS } from './data/load.ts';
import type { RunningSchema } from './data/store/schemas.ts';
import { parseDistance } from './domain/distances.ts';
import { isAfter, parseProse, parseText, parseWhen, placedFigures, startsBeforeEnd, type ProseIssue } from './domain/journey.ts';

const DUPLICATE_RACE_TOLERANCE = 0.02;

const JOURNEY_DIR = `${OWNER_DIR}/journey`;
const JOURNEY_CHAPTER_FILE = /^data\/running\/owner\/journey\/chapters\/[^/]+\/chapter\.yaml$/;
export const STORY_PAGE = '/running/story/';

type Figure = NonNullable<JourneyChapter['figures']>[number];
type HealthRefMetric = 'weight_avg7' | 'body_fat_pct' | 'vo2max' | 'fitness_ctl' | 'resting_hr' | 'hrv';

/** data-model.md §3 *Ref kinds by category*: the health metric or manual kind a stored figure names. */
const CATEGORY_METRIC: Partial<Record<Figure['category'], HealthRefMetric>> = {
  weight: 'weight_avg7',
  body_fat: 'body_fat_pct',
  vo2_max: 'vo2max',
  fitness: 'fitness_ctl',
  resting_hr: 'resting_hr',
  hrv: 'hrv',
};
const CATEGORY_MANUAL: Partial<Record<Figure['category'], 'training_status' | 'race_predictions'>> = {
  training_status: 'training_status',
  race_prediction: 'race_predictions',
};

/** Provider activity links, and IDs outside links, that must never appear in owner files (data-model §3). */
const PROVIDER_LINK_PATTERNS: [RegExp, string][] = [
  [/intervals\.icu\/activities\//, 'is an intervals.icu activity link'],
  [/connect\.garmin\.com\/modern\/activity\//, 'is a Garmin Connect activity link'],
];
// Checked with links removed: race results URLs often carry long numeric IDs of their own.
const PROVIDER_ID_PATTERNS: [RegExp, string][] = [
  [/\bi\d{6,}\b/, 'looks like an intervals.icu activity ID'],
  [/\b\d{9,}\b/, 'looks like a Garmin activity ID'],
];

export interface ValidateOptions {
  /** Europe/London date used for "not in the future" checks. Defaults to today. */
  today?: string;
  /** Where schemas/ is, when not under `root` (a fixture data tree). */
  schemaRoot?: string;
}

export function validateRunning(root: string, options: ValidateOptions = {}): DataIssue[] {
  const today = options.today ?? londonToday();
  const { data, issues } = loadRunningData(root, options.schemaRoot);
  const error = (file: string, entry: string, field: string, message: string) =>
    issues.push({ file, entry, field, message, severity: 'error' });
  const warning = (file: string, entry: string, field: string, message: string) =>
    issues.push({ file, entry, field, message, severity: 'warning' });
  const where = (schema: RunningSchema, value: unknown, path: (string | number)[]) => locate(schema, value, path);

  // --- Published -------------------------------------------------------------------------------
  const runsById = new Map(data.runs.map((r) => [r.value.id, r]));
  const runIds = new Set<string>();
  for (const { file, value: run } of data.runs) {
    const entry = `run "${run.id}"`;
    if (runIds.has(run.id)) error(file, entry, 'id', 'is used by another run file');
    runIds.add(run.id);
    if (file !== `${PUBLISHED_DIR}/runs/${run.date.slice(0, 4)}/${run.id}.json`) {
      error(file, entry, '', `should be at ${PUBLISHED_DIR}/runs/${run.date.slice(0, 4)}/${run.id}.json`);
    }
    if (!run.id.startsWith(`${run.date}-`)) error(file, entry, 'id', `does not start with the run's date ${run.date}`);
    if (run.treadmill && run.type !== 'indoor') error(file, entry, 'type', 'a treadmill run must be indoor');
    if (run.track_ref) {
      if (!run.is_race) error(file, entry, 'track_ref', 'only races may have a published track');
      if (run.treadmill) error(file, entry, 'track_ref', 'a treadmill run never has a track');
      if (run.track_ref !== `race-tracks/${run.id}`) error(file, entry, 'track_ref', `should be race-tracks/${run.id}`);
    }
  }

  for (const { file, value: track } of data.raceTracks) {
    const entry = `race track "${track.id}"`;
    if (file !== `${PUBLISHED_DIR}/race-tracks/${track.id}.json`) {
      error(file, entry, '', `should be at ${PUBLISHED_DIR}/race-tracks/${track.id}.json`);
    }
    const run = runsById.get(track.id)?.value;
    // GPS for anything but a published race would break Principle VI.
    if (!run || run.track_ref !== `race-tracks/${track.id}`) {
      error(file, entry, '', 'has no published race run pointing at it (GPS is published for races only)');
    }
  }

  for (const { file, value: series } of data.health) {
    const [, metric, year] = /health\/([^/]+)\/(\d{4})\.json$/.exec(file) ?? [];
    const entry = `health series "${series.metric}"`;
    if (metric !== series.metric) error(file, entry, 'metric', `does not match the folder name "${metric}"`);
    series.points.forEach((point, i) => {
      if (!point.date.startsWith(`${year}-`)) error(file, entry, `points[${i}].date`, `"${point.date}" is not in ${year}`);
      const previous = series.points[i - 1];
      if (previous && previous.date >= point.date) {
        error(file, entry, `points[${i}].date`, `"${point.date}" is not after the previous point (${previous.date}); points must be sorted, one per day`);
      }
    });
  }

  const manifest = data.manifest;
  if (manifest) {
    for (const [id, item] of Object.entries(manifest.value.runs)) {
      if (!item) continue;
      const run = runsById.get(id);
      if (item.hidden && run) error(run.file, `run "${id}"`, '', 'is hidden by the owner but still published');
      if (item.path && !run) error(manifest.file, '', `runs.${id}.path`, `${item.path} does not exist`);
      if (item.path && run && `${PUBLISHED_DIR}/${item.path}` !== run.file) {
        error(manifest.file, '', `runs.${id}.path`, `does not match ${run.file}`);
      }
    }
    for (const { file, value: run } of data.runs) {
      if (!manifest.value.runs[run.id]) warning(file, `run "${run.id}"`, '', 'is not in the manifest');
    }
  }
  const knownRunIds = new Set([...runIds, ...Object.keys(manifest?.value.runs ?? {})]);

  // --- Owner -----------------------------------------------------------------------------------
  const upcoming = data.upcomingRaces?.value ?? [];
  const upcomingIds = new Map<string, number>();
  upcoming.forEach((race, i) => {
    const file = data.upcomingRaces!.file;
    const { entry } = where('owner/upcoming-races', upcoming, [i]);
    if (upcomingIds.has(race.id)) error(file, entry, 'id', 'is used by another upcoming race');
    upcomingIds.set(race.id, i);
    if (race.target_time !== undefined && parseTime(race.target_time) === undefined) {
      error(file, entry, 'target_time', `"${race.target_time}" is not a valid time (expected mm:ss or h:mm:ss)`);
    }
  });

  const raceSlugs = new Set<string>();
  const racesByRunId = new Map<string, string>();
  for (const { file, value: race } of data.races) {
    const entry = `race "${race.slug}"`;
    const folder = file.split('/').at(-2);
    if (race.slug !== folder) error(file, entry, 'slug', `does not match the folder name "${folder}"`);
    if (raceSlugs.has(race.slug)) error(file, entry, 'slug', 'is used by another race');
    raceSlugs.add(race.slug);
    if (race.official_time !== undefined && parseTime(race.official_time) === undefined) {
      error(file, entry, 'official_time', `"${race.official_time}" is not a valid time (expected mm:ss or h:mm:ss)`);
    }
    for (const [i, photo] of (race.photos ?? []).entries()) {
      const photoFile = `${file.slice(0, file.lastIndexOf('/'))}/${photo.file}`;
      if (!existsSync(join(root, photoFile))) error(file, entry, `photos[${i}].file`, `${photoFile} does not exist`);
    }
    if (race.run_id) {
      const other = racesByRunId.get(race.run_id);
      if (other) error(file, entry, 'run_id', `is already used by race "${other}" (one race entry per run)`);
      racesByRunId.set(race.run_id, race.slug);
      const run = runsById.get(race.run_id)?.value;
      if (!run) {
        warning(file, entry, 'run_id', `run "${race.run_id}" is not published (yet); the race shows once it is ingested`);
      } else if (run.date !== race.date) {
        error(file, entry, 'date', `${race.date} differs from the date of run "${race.run_id}" (${run.date}); check the run_id`);
      }
    } else {
      // A hand-entered race matching a recorded race would show twice (FR-052).
      const metres = parseDistance(race.distance);
      const twin = data.runs.find(
        ({ value: run }) =>
          run.is_race &&
          run.date === race.date &&
          metres !== undefined &&
          Math.abs(run.distance_m - metres) <= metres * DUPLICATE_RACE_TOLERANCE,
      );
      if (twin) {
        error(file, entry, 'run_id', `matches recorded race run "${twin.value.id}": add run_id: ${twin.value.id} so it shows once`);
      }
    }
  }
  const usedPhotos = new Set(
    data.races.flatMap(({ file, value }) => (value.photos ?? []).map((p) => `${file.slice(0, file.lastIndexOf('/'))}/${p.file}`)),
  );
  for (const file of data.files.filter((f) => PHOTO_FILE.test(f) && !usedPhotos.has(f))) {
    warning(file, '', '', 'is not listed in its race.yaml photos, so it is not shown');
  }

  for (const [i, race] of upcoming.entries()) {
    if (race.result_ref && !raceSlugs.has(race.result_ref)) {
      const { entry } = where('owner/upcoming-races', upcoming, [i]);
      error(data.upcomingRaces!.file, entry, 'result_ref', `no race entry ${OWNER_DIR}/races/${race.result_ref}/race.yaml`);
    }
  }

  const section = data.section;
  if (!section) {
    warning(`${OWNER_DIR}/section.yaml`, '', '', 'not found: the landing page has no focus race yet');
  } else if (!upcomingIds.has(section.value.focus_race.race_id)) {
    error(section.file, '', 'focus_race.race_id', `"${section.value.focus_race.race_id}" is not an id in upcoming-races.yaml`);
  }

  const goals = data.goals?.value ?? [];
  const goalIds = new Set<string>();
  const featuredPriorities = new Map<number, string>();
  let featured = 0;
  goals.forEach((goal, i) => {
    const file = data.goals!.file;
    const { entry } = where('owner/goals', goals, [i]);
    if (goalIds.has(goal.id)) error(file, entry, 'id', 'is used by another goal');
    goalIds.add(goal.id);
    if (goal.linked_race && !upcomingIds.has(goal.linked_race)) {
      error(file, entry, 'linked_race', `"${goal.linked_race}" is not an id in upcoming-races.yaml`);
    }
    if (goal.featured && !goal.retired) {
      featured++;
      const other = featuredPriorities.get(goal.priority);
      if (other) error(file, entry, 'priority', `${goal.priority} is also the priority of featured goal "${other}"`);
      featuredPriorities.set(goal.priority, goal.id);
    }
    if (goal.type === 'race_time') {
      if (parseTime(goal.target.time) === undefined) {
        error(file, entry, 'target.time', `"${goal.target.time}" is not a valid time (expected mm:ss or h:mm:ss)`);
      }
      // The landing hero shows the race's target_time and the goal card shows the goal's, so a
      // mismatch would show two targets (US1.2, T106). Retired goals and goals the owner marked
      // achieved by hand are history (a tightened target is a new goal), so they don't count.
      const race = goal.linked_race ? upcoming[upcomingIds.get(goal.linked_race) ?? -1] : undefined;
      const inPlay = !goal.retired && !goal.achieved_override;
      if (inPlay && race?.target_time && parseTime(race.target_time) !== parseTime(goal.target.time)) {
        const isFocus = section?.value.focus_race.race_id === race.id;
        warning(
          file,
          entry,
          'target.time',
          isFocus && goal.featured
            ? `"${goal.target.time}" differs from focus race "${race.id}" target_time "${race.target_time}" in upcoming-races.yaml; the landing page would show both`
            : `"${goal.target.time}" differs from upcoming race "${race.id}" target_time "${race.target_time}"`,
        );
      }
    }
  });
  const limit = section?.value.featured_goal_limit ?? SECTION_DEFAULTS.featured_goal_limit;
  if (featured > limit) {
    error(data.goals!.file, '', '', `${featured} goals are featured; at most ${limit} can be (featured_goal_limit in section.yaml)`);
  }

  const overrides = data.overrides?.value ?? [];
  const overrideIds = new Set<string>();
  overrides.forEach((override, i) => {
    const file = data.overrides!.file;
    const { entry } = where('owner/run-overrides', overrides, [i]);
    if (overrideIds.has(override.id)) error(file, entry, 'id', 'already has an entry (one entry per run)');
    overrideIds.add(override.id);
    if (!knownRunIds.has(override.id)) {
      if (manifest) error(file, entry, 'id', `run "${override.id}" does not exist`);
      else warning(file, entry, 'id', `run "${override.id}" is not published yet`);
    }
  });

  const exclusions = data.exclusions?.value ?? [];
  const exclusionKeys = new Set<string>();
  exclusions.forEach((exclusion, i) => {
    const key = `${exclusion.metric} ${exclusion.date}`;
    if (exclusionKeys.has(key)) {
      const { entry } = where('owner/health-exclusions', exclusions, [i]);
      error(data.exclusions!.file, entry, '', 'is listed twice');
    }
    exclusionKeys.add(key);
  });

  for (const { file, value: lab } of data.lab) {
    const expected = `${lab.date}-${lab.type}.yaml`;
    if (!file.endsWith(`/${expected}`)) error(file, '', '', `should be named ${expected}`);
  }

  if (data.manualMetrics) {
    const { file, value } = data.manualMetrics;
    for (const list of ['training_status', 'race_predictions'] as const) {
      const entries = value[list] ?? [];
      const seen = new Set<string>();
      entries.forEach((item, i) => {
        const { entry } = where('owner/manual-metrics', value, [list, i]);
        if (item.as_of > today) error(file, entry, 'as_of', `${item.as_of} is in the future`);
        if (seen.has(item.as_of)) error(file, entry, 'as_of', `${item.as_of} is used by another ${list === 'training_status' ? 'training status' : 'race prediction'} entry`);
        seen.add(item.as_of);
        if (list === 'race_predictions') {
          for (const distance of ['5k', '10k', 'half', 'marathon'] as const) {
            const time = (item as RacePredictionEntry)[distance];
            if (time !== undefined && parseTime(time) === undefined) {
              error(file, entry, distance, `"${time}" is not a valid time (expected mm:ss or h:mm:ss)`);
            }
          }
        }
      });
    }
  }

  // --- Fundraising (specs/002-fundraising/contracts/data-files.md) ------------------------------
  const campaigns = data.campaigns?.value ?? [];
  const campaignIds = new Set<string>();
  const campaignRaces = new Set<string>();
  const campaignPages = new Set<string>();
  campaigns.forEach((campaign, i) => {
    const file = data.campaigns!.file;
    const { entry } = where('owner/campaigns', campaigns, [i]);
    if (campaignIds.has(campaign.id)) error(file, entry, 'id', 'is used by another campaign');
    campaignIds.add(campaign.id);
    if (campaignRaces.has(campaign.race_id)) {
      error(file, entry, 'race_id', `"${campaign.race_id}" has another campaign (both would be current)`);
    }
    campaignRaces.add(campaign.race_id);
    if (campaignPages.has(campaign.page_url)) error(file, entry, 'page_url', 'is used by another campaign');
    campaignPages.add(campaign.page_url);
    if (!upcomingIds.has(campaign.race_id) && !raceSlugs.has(campaign.race_id)) {
      error(file, entry, 'race_id', `"${campaign.race_id}" is not an id in upcoming-races.yaml or a race under ${OWNER_DIR}/races/`);
    }
    const logo = campaign.charity.logo;
    if (logo && !existsSync(join(root, OWNER_DIR, 'logos', logo.file))) {
      error(file, entry, 'charity.logo.file', `${OWNER_DIR}/logos/${logo.file} does not exist`);
    }
    const focus = section?.value.focus_race;
    if (focus && campaign.race_id === focus.race_id && campaign.charity.name !== focus.charity.name) {
      error(
        file,
        entry,
        'charity.name',
        `"${campaign.charity.name}" differs from section.yaml focus_race.charity.name "${focus.charity.name}"; the hero and the card would name different charities`,
      );
    }
  });

  const publishedCampaigns = new Set<string>();
  for (const { file, value: figures } of data.fundraising) {
    const entry = `campaign figures "${figures.campaign_id}"`;
    const name = /([^/]+)\.json$/.exec(file)?.[1];
    if (figures.campaign_id !== name) error(file, entry, 'campaign_id', `does not match the file name "${name}"`);
    publishedCampaigns.add(figures.campaign_id);
    figures.points.forEach((point, i) => {
      const previous = figures.points[i - 1];
      if (previous && previous.date >= point.date) {
        error(file, entry, `points[${i}].date`, `"${point.date}" is not after the previous point (${previous.date}); points must be sorted, one per day`);
      }
      if (point.date > today) error(file, entry, `points[${i}].date`, `${point.date} is in the future`);
    });
    if (!campaignIds.has(figures.campaign_id)) warning(file, entry, '', 'has no campaign in campaigns.yaml: its history is kept and not shown');
  }
  campaigns.forEach((campaign, i) => {
    if (campaign.finished && !publishedCampaigns.has(campaign.id)) {
      const { entry } = where('owner/campaigns', campaigns, [i]);
      warning(data.campaigns!.file, entry, 'finished', 'is set but the campaign has no published figures, so it would never appear');
    }
  });
  const usedLogos = new Set(campaigns.flatMap((c) => (c.charity.logo ? [`${OWNER_DIR}/logos/${c.charity.logo.file}`] : [])));
  for (const file of data.files.filter((f) => LOGO_FILE.test(f) && !usedLogos.has(f))) {
    warning(file, '', '', 'is not named by any campaign charity.logo in campaigns.yaml, so it is not shown');
  }

  for (const { file, value: story } of data.stories) {
    const entry = `story "${story.campaign}"`;
    const name = /([^/]+)\.yaml$/.exec(file)?.[1];
    if (story.campaign !== name) error(file, entry, 'campaign', `does not match the file name "${name}"`);
    if (!campaignIds.has(story.campaign)) error(file, entry, 'campaign', `"${story.campaign}" is not a campaign in campaigns.yaml`);
    if (story.approved.date > today) error(file, entry, 'approved.date', `${story.approved.date} is in the future`);
  }

  // --- Journey story (specs/003-journey-story/contracts/content-files.md) ------------------------
  const journey = data.journey;
  const chapterFiles = data.files.filter((f) => JOURNEY_CHAPTER_FILE.test(f));
  const proseIssues = (file: string, entry: string, field: string, found: ProseIssue[]) => {
    for (const issue of found) error(file, entry, `${field}, paragraph ${issue.paragraph}`, issue.message);
  };

  // The first stored record of each kind, and what exists, for stored figures (FR-011, FR-012).
  const healthDates = new Map<string, Set<string>>();
  for (const { value: series } of data.health) {
    const dates = healthDates.get(series.metric) ?? new Set<string>();
    for (const point of series.points) dates.add(point.date);
    healthDates.set(series.metric, dates);
  }
  const earliest = (dates: Iterable<string>) => [...dates].sort()[0];
  const firstRunDate = earliest(data.runs.map((r) => r.value.date));
  const manual = data.manualMetrics?.value;
  const officialRaces = new Map(data.races.filter((r) => r.value.official_time !== undefined).map((r) => [r.value.slug, r.value]));
  const scale = section?.value.garmin_devices?.scale ?? 'Garmin';

  /** A stored figure's record: its date, the Garmin attribution it carries, and the first record of its kind. */
  const record = (figure: Figure): { exists: boolean; first: string | undefined; garmin: string | undefined } | undefined => {
    const ref = figure.ref;
    if (!ref) return undefined;
    if ('run' in ref) {
      const run = runsById.get(ref.run)?.value;
      return { exists: run !== undefined, first: firstRunDate, garmin: run ? (run.device ?? 'Garmin') : undefined };
    }
    if ('health' in ref) {
      const dates = healthDates.get(ref.health.metric) ?? new Set<string>();
      const metric = ref.health.metric;
      const garmin = metric === 'fitness_ctl' ? 'derived' : metric === 'weight_avg7' || metric === 'body_fat_pct' ? scale : 'Garmin';
      return { exists: dates.has(ref.health.date), first: earliest(dates), garmin };
    }
    if ('manual' in ref) {
      const entries: { as_of: string }[] = manual?.[ref.manual.kind] ?? [];
      return { exists: entries.some((e) => e.as_of === ref.manual.as_of), first: earliest(entries.map((e) => e.as_of)), garmin: 'Garmin' };
    }
    const race = officialRaces.get(ref.race);
    // A hand-entered race result isn't Garmin data, so it carries no attribution.
    return { exists: race !== undefined, first: earliest([...officialRaces.values()].map((r) => r.date)), garmin: undefined };
  };

  const starts = new Map<string, { id: string; order: number | undefined }[]>();
  for (const { file, value: chapter } of journey.chapters) {
    const entry = `chapter "${chapter.id}"`;
    const folder = file.split('/').at(-2);
    if (chapter.id !== folder) error(file, entry, 'id', 'does not match the name of its folder (a chapter\'s id is its folder name, FR-051)');

    const when = parseWhen(chapter.when);
    if (!when) error(file, entry, 'when', "names a day that doesn't exist");
    else {
      if (!startsBeforeEnd(when)) error(file, entry, 'when', 'must start before it ends');
      if (isAfter(when, today)) error(file, entry, 'when', 'is in the future');
      const tied = starts.get(when.start) ?? [];
      for (const other of tied) {
        if (other.order === undefined || chapter.order === undefined || other.order === chapter.order) {
          error(file, entry, 'order', `starts on the same day as chapter "${other.id}": give each a distinct order`);
        }
      }
      tied.push({ id: chapter.id, order: chapter.order });
      starts.set(when.start, tied);
    }
    if (chapter.approved.date > today) error(file, entry, 'approved.date', 'is in the future');

    const parsed = parseProse(chapter.prose);
    proseIssues(file, entry, 'prose', parsed.issues);
    if (parsed.paragraphs[0]?.kind === 'figure') {
      error(file, entry, 'prose, paragraph 1', 'is a figure on its own: a chapter opens with prose, so put the figure after a paragraph');
    }
    proseIssues(file, entry, 'takeaway', parseText(chapter.takeaway, { links: false }).issues);

    const figures = chapter.figures ?? [];
    const figureIds = new Set(figures.map((f) => f.id));
    parsed.paragraphs.forEach((paragraph, i) => {
      for (const id of placedFigures({ paragraphs: [paragraph], issues: [] })) {
        if (!figureIds.has(id)) error(file, entry, `prose, paragraph ${i + 1}`, `{{${id}}} names no figure in this chapter's figures`);
      }
    });
    const placed = placedFigures(parsed);
    const seenIds = new Set<string>();
    figures.forEach((figure, i) => {
      const field = `figures[${i}]`;
      if (seenIds.has(figure.id)) error(file, entry, `${field}.id`, 'is used by another figure in this chapter');
      seenIds.add(figure.id);
      const uses = placed.filter((id) => id === figure.id).length;
      if (uses === 0) error(file, entry, `${field}.id`, `has no {{${figure.id}}} placeholder in the prose (each figure has exactly one)`);
      if (uses > 1) error(file, entry, `${field}.id`, `has ${uses} {{${figure.id}}} placeholders in the prose (each figure has exactly one)`);

      const asOf = parseWhen(figure.as_of);
      if (!asOf) error(file, entry, `${field}.as_of`, "names a day that doesn't exist");
      else if (isAfter(asOf, today)) error(file, entry, `${field}.as_of`, 'is in the future');

      if (figure.source !== 'stored' || !figure.ref) return;
      const ref = figure.ref;
      const metric = CATEGORY_METRIC[figure.category];
      if ('health' in ref && metric && ref.health.metric !== metric) {
        error(file, entry, `${field}.ref.health.metric`, `must be ${metric} for a ${figure.category} figure`);
        return;
      }
      const kind = CATEGORY_MANUAL[figure.category];
      if ('manual' in ref && kind && ref.manual.kind !== kind) {
        error(file, entry, `${field}.ref.manual.kind`, `must be ${kind} for a ${figure.category} figure`);
        return;
      }
      const found = record(figure)!;
      if (asOf && (found.first === undefined || asOf.end < found.first)) {
        error(file, entry, `${field}.as_of`, 'is before the first stored record of its kind: before then only the owner can supply it (source: owner)');
        return;
      }
      if (!found.exists) {
        const refField = `${field}.ref.${Object.keys(ref)[0]}`;
        error(file, entry, refField, 'names no stored record (a published run, a published health point of that metric and date, a manual-metrics.yaml entry of that kind and date, or a race.yaml with an official time)');
        return;
      }
      if (found.garmin === undefined) {
        if (figure.garmin !== undefined) error(file, entry, `${field}.garmin`, "must be left out: a hand-entered race result isn't Garmin data");
      } else if (figure.garmin === undefined) {
        error(file, entry, `${field}.garmin`, `is required: its record is Garmin data (expected ${found.garmin})`);
      } else if (figure.garmin !== found.garmin) {
        error(file, entry, `${field}.garmin`, `doesn't match its record (expected ${found.garmin})`);
      }
    });
  }

  if (chapterFiles.length > 0) {
    // A file that exists but was refused (unapproved, changed) is already reported by the loader.
    const note = `${JOURNEY_DIR}/note.yaml`;
    const page = `${JOURNEY_DIR}/page.yaml`;
    if (!data.files.includes(note)) error(note, 'note', '', 'is missing: the story needs its approved note before it can be published (FR-008)');
    if (!data.files.includes(page)) error(page, 'page wording', '', 'is missing: the story needs its approved page wording before it can be published (FR-039)');
  }
  if (journey.closing) {
    const { file, value: closing } = journey.closing;
    if (chapterFiles.length === 0) warning(file, 'closing section', '', 'has no chapter to follow, so it is not shown');
    proseIssues(file, 'closing section', 'text', parseText(closing.text).issues);
    if (closing.approved.date > today) error(file, 'closing section', 'approved.date', 'is in the future');
  }
  if (journey.note) {
    const { file, value: note } = journey.note;
    proseIssues(file, 'note', 'text', parseText(note.text, { links: false }).issues);
    if (note.approved.date > today) error(file, 'note', 'approved.date', 'is in the future');
  }
  if (journey.page) {
    const { file, value: page } = journey.page;
    if (page.approved.date > today) error(file, 'page wording', 'approved.date', 'is in the future');
  }

  // The landing page's link to the story (data-model.md §9; FR-040, FR-042, research.md R8).
  const storyLink = section?.value.story_link;
  if (section && storyLink) {
    if (chapterFiles.length === 0) error(section.file, '', 'story_link.href', "leads to the story page, which doesn't exist until a chapter does");
    if (storyLink.href !== STORY_PAGE) error(section.file, '', 'story_link.href', `must be the story page, ${STORY_PAGE}`);
    const page = journey.page?.value;
    if (page && storyLink.label !== page.link_label) {
      error(section.file, '', 'story_link.label', `differs from link_label in ${JOURNEY_DIR}/page.yaml; they must match`);
    }
  }

  // Provider IDs never belong in owner files: runs are referenced by their public ID.
  for (const file of data.files.filter((f) => f.startsWith(`${OWNER_DIR}/`) && f.endsWith('.yaml'))) {
    readFileSync(join(root, file), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const withoutLinks = line.replace(/https?:\/\/\S+/g, '');
        const checks = [
          ...PROVIDER_ID_PATTERNS.map(([pattern, what]) => [pattern, what, withoutLinks] as const),
          ...PROVIDER_LINK_PATTERNS.map(([pattern, what]) => [pattern, what, line] as const),
        ];
        for (const [pattern, what, text] of checks) {
          const match = pattern.exec(text);
          // In the journey's files the match is part of the story, so it isn't quoted (FR-035).
          const shown = file.startsWith(`${JOURNEY_DIR}/`) ? 'this' : `"${match?.[0]}"`;
          if (match) error(file, `line ${i + 1}`, '', `${shown} ${what}; refer to runs by the ID in the run page URL`);
        }
      });
  }

  return issues;
}
