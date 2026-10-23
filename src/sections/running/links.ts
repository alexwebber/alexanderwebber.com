// Links between Running areas that only exist once the target area has shipped, so an increment
// never links to a page that isn't built yet (the same rule as the section nav, FR-027).
import { shippedAreas } from './integration.ts';

/** Whether some shipped area serves pages under this path prefix (e.g. "/running/runs/"). */
function served(prefix: string): boolean {
  return shippedAreas().some((area) => area.routes.some((route) => route.pattern.startsWith(prefix)));
}

/** A run's detail page (contracts/routes.md), or undefined until run pages ship (US1/US3). */
export function runHref(runId: string): string | undefined {
  return served('/running/runs/') ? `/running/runs/${runId}/` : undefined;
}
