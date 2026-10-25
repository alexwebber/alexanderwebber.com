// Links to a run's and a race's page (contracts/routes.md).

/** A run's detail page. */
export function runHref(runId: string): string {
  return `/running/runs/${runId}/`;
}

/** A race's page. */
export function raceHref(slug: string): string {
  return `/running/races/${slug}/`;
}
