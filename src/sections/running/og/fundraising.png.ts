// The fundraising page's share image, /og/running-fundraising.png (T070, FR-060): the charity, race
// and total raised at the last deploy, from the current campaign, else the most recent past one. A
// figure helps fundraising, and a shared link's cached preview may show an older one (spec
// assumption *Share image*). No JustGiving logo (research.md R3); no Garmin data, so no attribution.
import { formatLongDate } from '../../../shared/format/dates.ts';
import { ogEndpoint, type OgCard } from '../../../shared/og/render.ts';
import { loadFundraising, type CampaignView } from '../data/fundraising.ts';
import { poundsText } from '../domain/fundraising.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

/** The card's words for a campaign (exported for tests). */
export function fundraisingCard(view: CampaignView | undefined): OgCard {
  if (!view) return { eyebrow: 'Running', title: 'Fundraising', colours: RUNNING_OG_COLOURS };
  return {
    eyebrow: 'Running',
    title: `${poundsText(view.figures.raised_pence)} raised for ${view.campaign.charity.name}`,
    subtitle: `${view.race.name} · ${formatLongDate(view.race.date)}`,
    colours: RUNNING_OG_COLOURS,
  };
}

export const GET = ogEndpoint(async () => {
  const { current, past } = await loadFundraising();
  return fundraisingCard(current ?? past[0]);
});
