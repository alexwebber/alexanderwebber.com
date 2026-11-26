// Text budgets (specs/004-interactive-cv/data-model.md; owner decisions 5 and 10, 2026-11-25): one
// table per kind and field, counted in Unicode code points. Not in the schemas, so the message can
// give the count: "card is 281 characters (budget 280)". validate.ts and scripts/import-cv.ts
// refuse anything over budget. Pure.
import type { CvKind } from './hashes.ts';

export const BUDGETS: Readonly<Partial<Record<CvKind, Readonly<Record<string, number>>>>> = {
  page: { title: 60, description: 160 },
  theme: { line: 100 },
  change: { label: 72, card: 280 },
  role: { label: 48, card: 280 },
  thread: { name: 40, line: 100 },
  next: { title: 72, card: 280 },
};

export interface OverBudget {
  field: string;
  length: number;
  budget: number;
}

/** Length in code points, as a reader counts characters (an emoji or accented letter is one). */
export const textLength = (text: string): number => [...text].length;

/** Each field of `item` longer than its budget. */
export function overBudget(kind: CvKind, item: unknown): OverBudget[] {
  const out: OverBudget[] = [];
  for (const [field, budget] of Object.entries(BUDGETS[kind] ?? {})) {
    const value = item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[field] : undefined;
    if (typeof value !== 'string') continue;
    const length = textLength(value);
    if (length > budget) out.push({ field, length, budget });
  }
  return out;
}

/** `card is 281 characters (budget 280)`: the count, never the text. */
export const overBudgetMessage = ({ field, length, budget }: OverBudget): string => `${field} is ${length} characters (budget ${budget})`;
