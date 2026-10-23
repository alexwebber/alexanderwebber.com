// The landing page's share image, /og/running.png (T104, FR-072): it reflects the page today,
// e.g. "163 days to Brighton", with the target and the charity. The daily 00:17 UTC deploy
// re-renders it, so the count follows the UK date. It shows no Garmin figures (the prediction
// stays on the page), so it carries no Garmin attribution.
import { formatDuration } from '../../../shared/format/units.ts';
import { ogEndpoint, type OgCard } from '../../../shared/og/render.ts';
import { loadLanding, type FocusRaceView } from '../data/landing.ts';
import { shortRaceName } from '../domain/races.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

/** The card's words for the focus race (exported for tests). */
export function landingCard(focus: FocusRaceView | undefined): OgCard {
  if (!focus) {
    return { eyebrow: 'Running', title: 'Running', subtitle: 'Goals, training and races.', colours: RUNNING_OG_COLOURS };
  }
  const short = shortRaceName(focus.race.name);
  let title: string;
  switch (focus.state) {
    case 'upcoming':
      title = `${focus.days} ${focus.days === 1 ? 'day' : 'days'} to ${short}`;
      break;
    case 'race_day':
      title = `Race day: ${focus.race.name}`;
      break;
    case 'awaiting_result':
      title = `${focus.race.name}: result coming soon`;
      break;
    case 'completed':
      title = focus.result?.time_s !== undefined ? `${focus.race.name}: ${formatDuration(focus.result.time_s)}` : `${focus.race.name}: finished`;
      break;
  }
  const subtitle = [focus.target && focus.state !== 'completed' ? `Target: ${focus.target}` : undefined, `For ${focus.charity}`].filter(Boolean).join(' · ');
  return { eyebrow: 'Running', title, subtitle, colours: RUNNING_OG_COLOURS };
}

export const GET = ogEndpoint(async () => landingCard((await loadLanding()).focus));
