// /og/race-preview-<slug>.png (SHELL_PREVIEW=1 only): each synthetic race's share image, from the
// real raceCard().
import type { APIRoute, GetStaticPaths } from 'astro';
import { raceCard } from '../../../src/sections/running/og/race.ts';
import { loadRaces } from '../../../src/sections/running/data/races.ts';
import type { RaceHistoryEntry } from '../../../src/sections/running/domain/races.ts';
import { ogEndpoint } from '../../../src/shared/og/render.ts';
import { PREVIEW_TODAY, previewStore } from './store.ts';

export const getStaticPaths = (async () => {
  const { history } = await loadRaces(PREVIEW_TODAY, previewStore);
  return history.map((race) => ({ params: { slug: race.slug }, props: { race } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ race: RaceHistoryEntry }> = (context) => ogEndpoint(raceCard(context.props.race))(context);
