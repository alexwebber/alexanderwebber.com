// The races page's share image, /og/running-races.png (T133, FR-072): the next race with its
// countdown, and how many races are in the history. No Garmin figures (the PBs stay on the
// page), so no Garmin attribution.
import { ogEndpoint, type OgCard } from '../../../shared/og/render.ts';
import { loadRaces, type RacesData } from '../data/races.ts';
import { countdownText } from '../domain/races.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

/** The card's words (exported for tests). */
export function racesCard({ history, upcoming }: Pick<RacesData, 'history' | 'upcoming'>): OgCard {
  const next = upcoming[0];
  const races = history.length === 0 ? 'No races yet' : `${history.length} race${history.length === 1 ? '' : 's'} so far`;
  const countdown = next && countdownText(next.days).filter(Boolean).join(' ');
  return {
    eyebrow: 'Running',
    title: 'Races and personal bests',
    subtitle: next ? `Next: ${next.race.name}, ${countdown?.toLowerCase()}. ${races}.` : `${races}.`,
    colours: RUNNING_OG_COLOURS,
  };
}

export const GET = ogEndpoint(async () => racesCard(await loadRaces()));
