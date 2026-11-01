// Fundraising's pure rules (T045; specs/002-fundraising/data-model.md §7): amounts, progress and
// the words the card shows. Nothing here reads data, so tests pin every input.
//
// Amounts and percentages round down (FR-032, FR-063): the site never overstates what was raised,
// and 99.9% never shows as 100%. So £1,030.75 reads £1,030 here where JustGiving's page shows
// £1,031, on purpose.
import { formatNumber } from '../../../shared/format/units.ts';

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

/** The figures were last read more than `staleAfterHours` ago (FR-005). */
export function isStale(lastReadAt: string, now: Date, staleAfterHours: number): boolean {
  return now.getTime() - Date.parse(lastReadAt) > staleAfterHours * 3_600_000;
}
