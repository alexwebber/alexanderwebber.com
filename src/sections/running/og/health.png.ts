// The health page's share image, /og/running-health.png (T141, FR-072). Generic words, no figures:
// health readings would be Garmin data in an exported image, needing attribution, and would go
// stale in a shared link's cached preview.
import { ogEndpoint } from '../../../shared/og/render.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

export const GET = ogEndpoint({
  eyebrow: 'Running',
  title: 'Health and fitness',
  subtitle: "Weight, body fat, VO2 max, Garmin's race predictions, fitness and heart rate.",
  colours: RUNNING_OG_COLOURS,
});
