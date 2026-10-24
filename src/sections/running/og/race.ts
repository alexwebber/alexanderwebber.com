// Each race's own share image, /og/running-races-<slug>.png (T133, FR-072): the race's name, its
// finish time, distance and date, and the position if recorded. A time from the watch is Garmin
// data, so it carries Garmin attribution; an official or hand-entered time isn't (FR-077).
import type { APIRoute, GetStaticPaths } from 'astro';
import { formatDate } from '../../../shared/format/dates.ts';
import { formatDuration } from '../../../shared/format/units.ts';
import { ogEndpoint, type OgCard } from '../../../shared/og/render.ts';
import { loadRaces } from '../data/races.ts';
import { capitalise, distanceLabel } from '../domain/goal-text.ts';
import type { RaceHistoryEntry } from '../domain/races.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

/** The card's words for one race (exported for tests and the race preview). */
export function raceCard(race: RaceHistoryEntry): OgCard {
  const facts = [
    race.time_s !== undefined ? `${formatDuration(race.time_s)}${race.official ? ' (official)' : ''}` : undefined,
    capitalise(distanceLabel(race.distance_m)),
    formatDate(race.date),
    race.position !== undefined ? `Position ${race.position}` : undefined,
  ].filter(Boolean);
  const watchTime = !race.official && race.run && race.time_s !== undefined;
  return {
    eyebrow: 'Running · Race',
    title: race.name,
    subtitle: facts.join(' · '),
    ...(watchTime ? { attribution: `Source: Garmin${race.run!.device ? ` ${race.run!.device}` : ''}` } : {}),
    colours: RUNNING_OG_COLOURS,
  };
}

export const getStaticPaths = (async () => {
  const { history } = await loadRaces();
  return history.map((race) => ({ params: { slug: race.slug }, props: { race } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ race: RaceHistoryEntry }> = (context) => ogEndpoint(raceCard(context.props.race))(context);
