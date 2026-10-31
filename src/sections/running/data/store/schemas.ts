// The file schemas Running's data is validated against (schemas/<name>.schema.json). gen-types
// writes their TypeScript types into ./generated/. Kept free of imports, so gen-types can read it
// before the types exist.
export const RUNNING_SCHEMAS = [
  'published/run',
  'published/race-track',
  'published/health-series',
  'published/refresh',
  'published/manifest',
  'published/fundraising-campaign',
  'owner/section',
  'owner/goals',
  'owner/upcoming-races',
  'owner/race',
  'owner/run-overrides',
  'owner/health-exclusions',
  'owner/lab',
  'owner/manual-metrics',
  'owner/campaigns',
] as const;
export type RunningSchema = (typeof RUNNING_SCHEMAS)[number];
