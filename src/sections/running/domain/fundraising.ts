// Fundraising's pure rules (T045; specs/002-fundraising/data-model.md §7): amounts, progress and
// the words the card shows. Nothing here reads data, so tests pin every input.
//
// Amounts and percentages round down (FR-032, FR-063): the site never overstates what was raised,
// and 99.9% never shows as 100%. So £1,030.75 reads £1,030 here where JustGiving's page shows
// £1,031, on purpose.
import { addDays, formatDate, londonDate } from '../../../shared/format/dates.ts';
import { formatDuration, formatNumber } from '../../../shared/format/units.ts';
import type { Campaign, CampaignFigures, UpcomingRace } from '../data/store/index.ts';
import { raceState } from './races.ts';

/**
 * What a `donationCount` is called. JustGiving's count equalled the supporters its page shows, in
 * the staging check of 1 Nov 2026 (quickstart.md §4), so the word is "supporter".
 */
const SUPPORTER_WORD = 'supporter';

export interface CampaignProgress {
  /** floor(raised * 100 / target), so it can pass 100. */
  percent: number;
  /** percent / 100, capped at 1: what the bar draws. */
  fraction: number;
  /** Raised equals the target. */
  reached: boolean;
  /** Raised is above the target. */
  beaten: boolean;
}

/**
 * Where a campaign stands (data-model.md §7, FR-023, FR-033). Before its race, and on race day
 * itself until a result is recorded, the card leads with the total against the target; once the day
 * has passed or a result is recorded, with "Raised £X for <charity>"; once the owner marks it
 * finished, the same with "Final total" and no Donate, whatever the race's date.
 */
export type CampaignPhase = 'before_race' | 'after_race' | 'finished';

/**
 * The phase from raceState(). A race known only from races/<slug>/race.yaml is passed as
 * `{ date, result_ref: slug }`, so it reads as completed.
 */
export function campaignPhase(race: Pick<UpcomingRace, 'date' | 'result_ref'>, finished: boolean, today: string): CampaignPhase {
  if (finished) return 'finished';
  const state = raceState(race, today);
  return state === 'upcoming' || state === 'race_day' ? 'before_race' : 'after_race';
}

/** "Raised £2,340 for Martlets": the lead after race day (FR-033, US4.1). */
export function raisedForText(raisedPence: number, charity: string): string {
  return `Raised ${poundsText(raisedPence)} for ${charity}`;
}

/** "Brighton Marathon: 3:18:42": the race result beside it, as the hero gives it (FR-033). */
export function resultText(raceName: string, timeS: number): string {
  return `${raceName}: ${formatDuration(timeS)}`;
}

/**
 * The target as secondary detail after race day (FR-032, FR-033): "62% of the £2,000 target", or,
 * once reached or beaten, "£2,000 target beaten: 117%", which still says so with the percentage.
 */
export function targetDetail(targetPence: number, progress: CampaignProgress): string {
  const target = poundsText(targetPence);
  if (progress.beaten) return `${target} target beaten: ${progress.percent}%`;
  if (progress.reached) return `${target} target reached: ${progress.percent}%`;
  return `${progress.percent}% of the ${target} target`;
}

/** "Final total, last updated 3 Jul 2027": a finished campaign's date is its last read (FR-023). */
export function finalTotalText(lastReadAt: string): string {
  return `Final total, last updated ${formatDate(londonDate(new Date(lastReadAt)))}`;
}

/** "£1,250", rounded down to the whole pound (FR-063). */
export function poundsText(pence: number): string {
  return `£${formatNumber(Math.floor(pence / 100))}`;
}

/** Undefined without a target: no bar and no percentage (FR-032). */
export function campaignProgress(raisedPence: number, targetPence: number | undefined): CampaignProgress | undefined {
  if (targetPence === undefined) return undefined;
  const percent = Math.floor((raisedPence * 100) / targetPence);
  return { percent, fraction: Math.min(percent / 100, 1), reached: raisedPence === targetPence, beaten: raisedPence > targetPence };
}

/** The bar's value in words: "£1,250 of £2,000, 62%" (FR-061). */
export function barValueText(raisedPence: number, targetPence: number, progress: CampaignProgress): string {
  return `${poundsText(raisedPence)} of ${poundsText(targetPence)}, ${progress.percent}%`;
}

/** "Target reached: 100%" or "Target beaten: 108%"; undefined below the target (FR-032). */
export function targetNote(progress: CampaignProgress | undefined): string | undefined {
  if (progress?.beaten) return `Target beaten: ${progress.percent}%`;
  return progress?.reached ? `Target reached: ${progress.percent}%` : undefined;
}

/** "37 supporters", "1 supporter", "No supporters yet". */
export function supportersText(count: number): string {
  if (count === 0) return `No ${SUPPORTER_WORD}s yet`;
  return `${formatNumber(count)} ${SUPPORTER_WORD}${count === 1 ? '' : 's'}`;
}

/** A story's paragraphs: blank lines separate them (data-model.md §6). */
export function storyParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

/** The figures were last read more than `staleAfterHours` ago (FR-005). */
export function isStale(lastReadAt: string, now: Date, staleAfterHours: number): boolean {
  return now.getTime() - Date.parse(lastReadAt) > staleAfterHours * 3_600_000;
}

/** "Part of <name>, registered charity <number>"; undefined without a registered charity. */
export function registeredText(charity: Campaign['charity']): string | undefined {
  const { registered } = charity;
  if (!registered) return undefined;
  return registered.name === charity.name ? `Registered charity ${registered.number}` : `Part of ${registered.name}, registered charity ${registered.number}`;
}

type CampaignPoint = CampaignFigures['points'][number];

/**
 * The total by day, for the chart (FR-042). A total holds until it changes, so each change gets a
 * point the day before it at the old value, plus a closing point today: a straight line between
 * two reads would suggest the money arrived gradually. The chart's table lists the real points.
 */
export function chartPoints(points: readonly Pick<CampaignPoint, 'date' | 'raised_pence'>[], today: string): { date: string; value: number }[] {
  const line: { date: string; value: number }[] = [];
  for (const { date, raised_pence: value } of points) {
    const previous = line.at(-1);
    const dayBefore = addDays(date, -1);
    if (previous && previous.value !== value && dayBefore > previous.date) line.push({ date: dayBefore, value: previous.value });
    line.push({ date, value });
  }
  const last = line.at(-1);
  if (last && last.date < today) line.push({ date: today, value: last.value });
  return line;
}

/** The chart's key message: "£1,250 raised since 10 Nov 2026, 62% of the £2,000 target" (FR-061). */
export function chartSummary(points: readonly CampaignPoint[]): string {
  const latest = points.at(-1)!;
  const since = `${poundsText(latest.raised_pence)} raised since ${formatDate(points[0]!.date)}`;
  const progress = campaignProgress(latest.raised_pence, latest.target_pence);
  return progress ? `${since}, ${progress.percent}% of the ${poundsText(latest.target_pence!)} target` : since;
}
