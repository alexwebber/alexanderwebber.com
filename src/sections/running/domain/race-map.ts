// The static race map's geometry (T131; FR-054, research R6): a race track projected to an SVG
// path, with start, finish and km markers, and a km-axis elevation profile. Pure and built at
// build time, so the baseline map needs no JS and no third party. The page carries only these
// projected figures; the coordinates themselves go to the interactive map's route file, which
// is fetched on click.
import type { RaceTrack } from '../data/store/index.ts';

/** The SVG's width in user units; the height follows the route's shape. */
export const MAP_WIDTH = 1000;
/** Squat or tall routes are padded out to this range of width / height. */
const MIN_ASPECT = 0.8;
const MAX_ASPECT = 1.6;
/** Room around the route, as a share of each side, so markers at the edge stay inside. */
const PAD = 0.06;

export interface MapPoint {
  x: number;
  y: number;
}

export interface KmMarker extends MapPoint {
  km: number;
  /** Position as a percentage of the map's width and height, for the HTML label. */
  left: number;
  top: number;
}

export interface StaticMap {
  width: number;
  height: number;
  /** SVG path data in the map's user units. */
  path: string;
  start: KmMarker;
  finish: KmMarker;
  markers: KmMarker[];
  /** Metres from the first to the last point, as published (after trimming). */
  distance_m: number;
  /** km between markers: 1 for short races, 2 up to a half, 5 beyond. */
  step_km: number;
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Marker spacing for a route of this length. */
export function markerStep(distanceKm: number): number {
  return distanceKm <= 12 ? 1 : distanceKm <= 25 ? 2 : 5;
}

export function staticMap(track: Pick<RaceTrack, 'points' | 'bbox'>): StaticMap {
  const [minLat, minLon, maxLat, maxLon] = track.bbox;
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  // Equirectangular about the middle latitude: true to shape at race scale.
  const spanX = Math.max((maxLon - minLon) * k, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, spanX / spanY));
  const width = MAP_WIDTH;
  const height = Math.round(width / aspect);
  const scale = Math.min((width * (1 - 2 * PAD)) / spanX, (height * (1 - 2 * PAD)) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const project = (lat: number, lon: number): MapPoint => ({ x: round(offX + (lon - minLon) * k * scale), y: round(offY + (maxLat - lat) * scale) });
  const xy = track.points.map(([lat, lon]) => project(lat, lon));
  const marker = (p: MapPoint, km: number): KmMarker => ({ ...p, km, left: round((p.x / width) * 100), top: round((p.y / height) * 100) });

  const first = track.points[0]![2];
  const last = track.points.at(-1)![2];
  const step = markerStep((last - first) / 1000);
  const markers: KmMarker[] = [];
  let i = 1;
  for (let km = Math.ceil(first / 1000 / step) * step || step; km * 1000 < last; km += step) {
    while (i < track.points.length - 1 && track.points[i]![2] < km * 1000) i++;
    const [aLat, aLon, aDist] = track.points[i - 1]!;
    const [bLat, bLon, bDist] = track.points[i]!;
    const t = bDist > aDist ? (km * 1000 - aDist) / (bDist - aDist) : 0;
    markers.push(marker(project(aLat + (bLat - aLat) * t, aLon + (bLon - aLon) * t), km));
  }

  return {
    width,
    height,
    path: xy.map((p, n) => `${n === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(''),
    start: marker(xy[0]!, first / 1000),
    finish: marker(xy.at(-1)!, last / 1000),
    markers,
    distance_m: last - first,
    step_km: step,
  };
}

/** The course profile: elevation (m) against km, with gaps where the watch recorded none. */
export function elevationProfile(track: Pick<RaceTrack, 'points'>): { x: number; y: number | null }[] {
  return track.points.map(([, , dist, elev]) => ({ x: dist / 1000, y: elev }));
}

/** Elevation at each whole km (nearest point), for the profile's table. */
export function elevationByKm(track: Pick<RaceTrack, 'points'>): { km: number; elev_m: number }[] {
  const out: { km: number; elev_m: number }[] = [];
  const last = track.points.at(-1)?.[2] ?? 0;
  for (let km = Math.ceil((track.points[0]?.[2] ?? 0) / 1000); km * 1000 <= last; km++) {
    let best: (typeof track.points)[number] | undefined;
    for (const p of track.points) {
      if (p[3] !== null && (best === undefined || Math.abs(p[2] - km * 1000) < Math.abs(best[2] - km * 1000))) best = p;
    }
    if (best && best[3] !== null) out.push({ km, elev_m: Math.round(best[3]) });
  }
  return out;
}

/** The interactive map's route file: GeoJSON order ([lon, lat]), to about a metre. */
export function routeJson(track: Pick<RaceTrack, 'points' | 'bbox'>): { coordinates: [number, number][]; bounds: [[number, number], [number, number]] } {
  const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
  const [minLat, minLon, maxLat, maxLon] = track.bbox;
  return {
    coordinates: track.points.map(([lat, lon]) => [r5(lon), r5(lat)]),
    bounds: [
      [r5(minLon), r5(minLat)],
      [r5(maxLon), r5(maxLat)],
    ],
  };
}
