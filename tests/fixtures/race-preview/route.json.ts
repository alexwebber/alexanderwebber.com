// /race-preview/<slug>/route.json (SHELL_PREVIEW=1 only): the synthetic races' route files.
import type { APIRoute, GetStaticPaths } from 'astro';
import { loadRaces } from '../../../src/sections/running/data/races.ts';
import { routeJson } from '../../../src/sections/running/domain/race-map.ts';
import type { RaceTrack } from '../../../src/shared/storage/index.ts';
import { PREVIEW_TODAY, previewStore } from './store.ts';

export const getStaticPaths = (async () => {
  const { tracks } = await loadRaces(PREVIEW_TODAY, previewStore);
  return [...tracks].map(([slug, track]) => ({ params: { slug }, props: { track } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ track: RaceTrack }> = ({ props }) =>
  new Response(JSON.stringify(routeJson(props.track)), { headers: { 'Content-Type': 'application/json' } });
