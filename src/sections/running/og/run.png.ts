// The one share image every run page uses, /og/running-run.png (T102; FR-072, research R8). Run
// pages share a generic card rather than one each: no run data goes into an image, and the
// deployed file count stays bounded at thousands of runs. No Garmin figures, so no attribution.
import { ogEndpoint } from '../../../shared/og/render.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

export const GET = ogEndpoint({
  eyebrow: 'Running',
  title: 'A run from the training log',
  subtitle: "Alexander Webber's running, one run at a time.",
  colours: RUNNING_OG_COLOURS,
});
