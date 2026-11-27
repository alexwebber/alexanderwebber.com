// Phone numbers in CV text (specs/004-interactive-cv/data-model.md *Rules across entities*): the
// CV publishes an email and LinkedIn, never a phone number (FR-003). One definition, used by
// validate.ts, scripts/import-cv.ts, scripts/scan-privacy.ts and (slice 5) the PDFs' text, so the
// rule is the same everywhere. Pure, no dependency.
//
// Found: UK and international forms (07700 900123, 020 7946 0018, +44 (0)20 7946 0018,
// +1 202 555 0143), with spaces, dots, hyphens or brackets between the digits, and any tel: link.
// Not found: the CV's own numbers, which have too few digits or sit against letters: years and
// year ranges (an en dash isn't a separator here), YYYY-MM-DD and YYYY-MM dates, sha256 and commit
// hex, sizes ("123 KB") and counts. A run of four-digit years (2012 2013 2014) isn't a number.

export interface PhoneMatch {
  index: number;
  length: number;
}

/** A plus, an opening bracket or a digit, then digits and single separators, ending in a digit. */
const CANDIDATE = /(?<![A-Za-z0-9+])\+?\(?\d(?:[\d.\- ()])*\d(?![A-Za-z0-9])/g;
const TEL = /tel:\s*\+?[\d.\- ()]*\d/gi;
const MIN_DIGITS = 10;
const MIN_DIGITS_WITH_PLUS = 8;
const MAX_DIGITS = 15;
const YEAR = /^(19|20)\d{2}$/;

/** Every phone number in `text`, in order, without overlaps. */
export function findPhone(text: string): PhoneMatch[] {
  const found: PhoneMatch[] = [];
  for (const m of text.matchAll(TEL)) found.push({ index: m.index, length: m[0].length });
  for (const m of text.matchAll(CANDIDATE)) {
    for (const part of numbersIn(m[0])) found.push({ index: m.index + part.index, length: part.length });
  }
  found.sort((a, b) => a.index - b.index || b.length - a.length);
  const out: PhoneMatch[] = [];
  for (const match of found) {
    const last = out.at(-1);
    if (last && match.index < last.index + last.length) continue;
    out.push(match);
  }
  return out;
}

/** The phone numbers inside one candidate run: itself, or its space-separated groups split into numbers when too long for one. */
function numbersIn(run: string): PhoneMatch[] {
  if (isPhone(run)) return [{ index: 0, length: run.length }];
  if (digitCount(run) <= MAX_DIGITS) return [];
  // Two numbers with only spaces between them: from each group, the shortest run of groups that
  // holds a number (the longest would swallow the next number's first group).
  const groups = [...run.matchAll(/\S+/g)];
  const out: PhoneMatch[] = [];
  let first = 0;
  while (first < groups.length) {
    let matched = false;
    for (let last = first; last < groups.length; last++) {
      const start = groups[first]!.index;
      const end = groups[last]!.index + groups[last]![0].length;
      const slice = run.slice(start, end);
      if (isPhone(slice)) {
        out.push({ index: start, length: end - start });
        first = last + 1;
        matched = true;
        break;
      }
    }
    if (!matched) first++;
  }
  return out;
}

function isPhone(text: string): boolean {
  const digits = digitCount(text);
  const min = text.startsWith('+') ? MIN_DIGITS_WITH_PLUS : MIN_DIGITS;
  if (digits < min || digits > MAX_DIGITS) return false;
  if (/[.\- ]{2,}|\(\(|\)\)/.test(text.replace(/\) /g, ')').replace(/ \(/g, '('))) return false;
  if (!balanced(text)) return false;
  const groups = text.split(/[^\d]+/).filter(Boolean);
  return !groups.every((g) => YEAR.test(g));
}

function digitCount(text: string): number {
  return text.replace(/\D/g, '').length;
}

function balanced(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0;
}
