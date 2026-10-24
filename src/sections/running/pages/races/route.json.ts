// /running/races/<slug>/route.json (T131): the route the interactive map draws, fetched only when
// a visitor clicks "Load interactive map". Races with a published track only; like the race
// pages, it is one of the few places coordinates are published (FR-014, Principle VI).
import type { APIRoute, GetStaticPaths } from 'astro';
import type { RaceTrack } from '../../../../shared/storage/index.ts';
import { loadRaces } from '../../data/races.ts';
import { routeJson } from '../../domain/race-map.ts';

export const getStaticPaths = (async () => {
  const { tracks } = await loadRaces();
  return [...tracks].map(([slug, track]) => ({ params: { slug }, props: { track } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ track: RaceTrack }> = ({ props }) =>
  new Response(JSON.stringify(routeJson(props.track)), { headers: { 'Content-Type': 'application/json' } });
