// Dates in UK format and Europe/London local time (FR-075). A "date" is a YYYY-MM-DD string,
// already local; instants (Date) are converted to London dates before any day arithmetic, so
// day counts are right across BST/GMT changes.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

const londonParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parts(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`not a YYYY-MM-DD date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function toDays(date: string): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function fromDays(days: number): string {
  return new Date(days * DAY_MS).toISOString().slice(0, 10);
}

/** "4 Apr 2027" */
export function formatDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Apr 2027" */
export function formatMonth(date: string): string {
  const [y, m] = parts(date);
  return `${MONTHS[m - 1]} ${y}`;
}

/** The Europe/London calendar date of an instant. */
export function londonDate(instant: Date): string {
  const p = Object.fromEntries(londonParts.formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Today in Europe/London. */
export function today(now: Date = new Date()): string {
  return londonDate(now);
}

export function addDays(date: string, days: number): string {
  return fromDays(toDays(date) + days);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return toDays(to) - toDays(from);
}

/** The Monday starting the week that contains `date` (weeks run Monday to Sunday). */
export function weekStart(date: string): string {
  const days = toDays(date);
  const weekday = (new Date(days * DAY_MS).getUTCDay() + 6) % 7; // Monday = 0
  return fromDays(days - weekday);
}

/** The first day of the month containing `date`. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
