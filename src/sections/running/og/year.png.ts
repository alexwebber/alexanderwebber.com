// The one share image every year's run list uses, /og/running-year.png (T120; FR-072, research
// R8): a generic card, like the run pages', so no run data goes into an image and the deployed
// file count stays bounded. No Garmin figures, so no attribution.
import { ogEndpoint } from '../../../shared/og/render.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

export const GET = ogEndpoint({
  eyebrow: 'Running',
  title: 'A year of running',
  subtitle: "Alexander Webber's training log, run by run.",
  colours: RUNNING_OG_COLOURS,
});
