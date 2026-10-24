// The training hub's share image, /og/running-training.png (T120, FR-072). Generic words, no run
// figures: totals would be Garmin data in an exported image, needing attribution, and would go
// stale between deploys of a shared link's preview.
import { ogEndpoint } from '../../../shared/og/render.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

export const GET = ogEndpoint({
  eyebrow: 'Running',
  title: 'Training',
  subtitle: 'Weekly, monthly and yearly running, and every run in detail.',
  colours: RUNNING_OG_COLOURS,
});
