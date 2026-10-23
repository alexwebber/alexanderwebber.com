// The Goals page's share image, /og/running-goals.png (T091, FR-072). It reflects the page: the
// top active goal and how many are active and achieved. It shows goal titles and counts only, no
// Garmin figures, so it carries no Garmin attribution.
import { ogEndpoint } from '../../../shared/og/render.ts';
import { loadGoals } from '../data/goals.ts';
import { achievedGoals, activeGoals } from '../domain/goals.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const GET = ogEndpoint(async () => {
  const { evaluations } = await loadGoals();
  const active = activeGoals(evaluations);
  const achieved = achievedGoals(evaluations);
  const counts = `${plural(active.length, 'active goal')}, ${achieved.length} achieved.`;
  return {
    eyebrow: 'Running',
    title: 'Goals',
    subtitle: active[0] ? `Leading the way: ${active[0].goal.title}. ${counts}` : counts,
    colours: RUNNING_OG_COLOURS,
  };
});
