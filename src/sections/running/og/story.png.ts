// The story page's share image, /og/running-story.png (T045, FR-075, SC-012): the approved
// share_text as the headline and the site name below, in Running's colours. Words only: no figure
// (the schema refuses digits in share_text), no photo, and so no Garmin attribution. It exists only
// once a chapter exists (integration.ts's story area), as the page does.
import { ogEndpoint, type OgCard } from '../../../shared/og/render.ts';
import type { JourneyPage } from '../data/store/index.ts';
import { loadJourney } from '../data/journey.ts';
import { RUNNING_OG_COLOURS } from './colours.ts';

/** The card for the approved page wording (exported for tests). */
export function storyCard(page: Pick<JourneyPage, 'share_text'>): OgCard {
  return { title: page.share_text, colours: RUNNING_OG_COLOURS };
}

export const GET = ogEndpoint(async () => {
  const journey = await loadJourney();
  if (!journey) throw new Error('/og/running-story.png was built with no chapter: the story area should exist only once one does');
  return storyCard(journey.page);
});
