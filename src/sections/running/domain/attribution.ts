// Which Garmin devices a view's attribution names (FR-077, T152). Each run carries the watch that
// recorded it (`device`, from intervals.icu); a view over several runs names each watch once,
// newest first. Past MAX_DEVICES the list stops being useful, so it falls back to plain "Garmin",
// which the guidelines allow when the device isn't known.
import type { Run } from '../../../shared/storage/index.ts';
import type { Effort } from './efforts.ts';
import type { GoalEvaluation } from './goals.ts';

export const MAX_DEVICES = 3;

/** The distinct watches behind `runs` (newest-first input gives newest-first output). */
export function runDevices(runs: readonly Pick<Run, 'device'>[]): string[] {
  const devices = [...new Set(runs.flatMap((run) => (run.device ? [run.device] : [])))];
  return devices.length > MAX_DEVICES ? [] : devices;
}

/** What a view passes to GarminAttribution: watches, or the scale from section.yaml. */
export interface AttributionProps {
  device?: string | readonly string[];
  scale?: boolean;
}

/** The effort a race-time goal card shows: the achieving effort, else the fastest. */
export function shownEffort(evaluation: GoalEvaluation): Effort | undefined {
  if (evaluation.kind !== 'race_time') return undefined;
  return evaluation.status === 'achieved' ? evaluation.achievement?.effort : evaluation.fastest;
}

/**
 * A goal card's Garmin attribution, or undefined when the card shows no Garmin-sourced data:
 * - race time: the watch that recorded the effort shown; a hand-entered race result isn't Garmin
 *   data, but an active goal's Garmin prediction is (plain "Garmin");
 * - weight and body fat: the scale; VO2 max, resting HR and HRV: plain "Garmin";
 * - milestones and manual achievements: none.
 */
export function goalAttribution(evaluation: GoalEvaluation): AttributionProps | undefined {
  if (evaluation.kind === 'race_time') {
    const effort = shownEffort(evaluation);
    if (effort?.run_id) return effort.device ? { device: effort.device } : {};
    return evaluation.status !== 'achieved' && evaluation.prediction ? {} : undefined;
  }
  if (evaluation.kind === 'value') {
    const shows = evaluation.status === 'achieved' ? evaluation.achievement?.by === 'reading' : evaluation.current !== undefined;
    if (!shows) return undefined;
    return evaluation.averaged ? { scale: true } : {};
  }
  return undefined;
}

/**
 * The attribution under a goals view's heading: every watch behind the efforts shown (newest
 * first), then the scale when a weight or body-fat card shows data. Undefined when no card shows
 * Garmin data.
 */
export function goalsViewAttribution(evaluations: readonly GoalEvaluation[], scale: string | undefined): AttributionProps | undefined {
  return viewAttribution({ goals: evaluations, scale });
}

export interface ViewSources {
  /** Runs the view shows (cards, charts, totals). */
  runs?: readonly Pick<Run, 'date' | 'device'>[];
  /** Goal cards the view shows. */
  goals?: readonly GoalEvaluation[];
  /** section.yaml garmin_devices.scale */
  scale?: string | undefined;
  /** The view also shows the owner's manual Garmin figures (plain "Garmin"). */
  manual?: boolean;
}

/**
 * The attribution under a page heading that mixes runs, goal cards and manual Garmin figures (the
 * landing page): every watch behind the runs and efforts shown, newest first, then the scale when
 * a weight or body-fat card shows data. Undefined when nothing on the view is Garmin data.
 */
export function viewAttribution({ runs = [], goals = [], scale, manual = false }: ViewSources): AttributionProps | undefined {
  const cards = goals.map((e) => ({ e, a: goalAttribution(e) })).filter(({ a }) => a !== undefined);
  if (cards.length === 0 && runs.length === 0 && !manual) return undefined;
  const efforts = cards.flatMap(({ e }) => {
    const effort = shownEffort(e);
    return effort?.run_id ? [effort] : [];
  });
  const dated = [...runs, ...efforts].sort((a, b) => b.date.localeCompare(a.date));
  const sources = [...dated.map((d) => ({ device: d.device })), ...(cards.some(({ a }) => a!.scale) && scale ? [{ device: scale }] : [])];
  return { device: runDevices(sources) };
}
