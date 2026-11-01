// Campaigns as the pages show them (T046, T065, T085; specs/002-fundraising/data-model.md §7). A campaign
// with figures is one whose published file exists; others appear nowhere (FR-022). The current
// campaign is the one linked to the focus race, and every other is past, most recent race first
// (FR-043). Memoised per store and day.
import { today as londonToday } from '../../../shared/format/dates.ts';
import { campaignProgress, storyParagraphs, type CampaignProgress } from '../domain/fundraising.ts';
import { runningStore, sectionSettings } from './load.ts';
import { perStoreAndDay } from './memo.ts';
import type { Campaign, CampaignFigures, CampaignStory, OwnerData, Run, RunningStore, UpcomingRace } from './store/index.ts';

export type CampaignPoint = CampaignFigures['points'][number];

export interface CampaignView {
  campaign: Campaign;
  race: Pick<UpcomingRace, 'name' | 'date'>;
  /** The current figures: the file's last point. */
  figures: CampaignPoint;
  /** When the figures were last seen to match JustGiving, as known at build time. */
  lastReadAt: string;
  /** Oldest first, one a day. */
  points: CampaignPoint[];
  /** Undefined when the page has no target. */
  progress?: CampaignProgress;
  /** The owner marked it finished: its last figures are final (FR-023). */
  finished: boolean;
  staleAfterHours: number;
  /** The approved story's paragraphs. Undefined until the campaign has one (FR-044). */
  story?: string[];
}

export interface FundraisingData {
  today: string;
  current?: CampaignView;
  /** Every other campaign with figures, most recent race first. */
  past: CampaignView[];
}

export function loadFundraising(today: string = londonToday(), store: RunningStore = runningStore()): Promise<FundraisingData> {
  return load(today, store);
}

/** A campaign's race: upcoming-races.yaml by id, else races/<slug>/race.yaml, named as raceHistory() does. */
function campaignRace(raceId: string, owner: OwnerData, runs: readonly Run[]): CampaignView['race'] | undefined {
  const upcoming = owner.upcomingRaces.find((r) => r.id === raceId);
  if (upcoming) return { name: upcoming.name, date: upcoming.date };
  const entry = owner.races.find((r) => r.slug === raceId);
  if (!entry) return undefined;
  const run = entry.run_id ? runs.find((r) => r.id === entry.run_id) : undefined;
  return { name: entry.name ?? run?.title ?? 'Race', date: entry.date };
}

function campaignView(campaign: Campaign, race: CampaignView['race'], file: CampaignFigures, staleAfterHours: number, story: CampaignStory | undefined): CampaignView {
  const figures = file.points.at(-1)!;
  const progress = campaignProgress(figures.raised_pence, figures.target_pence);
  return {
    campaign,
    race,
    figures,
    lastReadAt: file.last_read_at,
    points: file.points,
    ...(progress ? { progress } : {}),
    finished: campaign.finished === true,
    staleAfterHours,
    ...(story ? { story: storyParagraphs(story.text) } : {}),
  };
}

const load = perStoreAndDay(async (today, store): Promise<FundraisingData> => {
  const [owner, published, runs, settings] = await Promise.all([store.getOwner(), store.getCampaignFigures(), store.listRuns(), sectionSettings(store)]);
  const views = owner.campaigns.flatMap((campaign) => {
    const file = published.find((f) => f.campaign_id === campaign.id);
    const race = campaignRace(campaign.race_id, owner, runs);
    const story = owner.stories.find((s) => s.campaign === campaign.id);
    return file && race ? [campaignView(campaign, race, file, settings.stale_after_hours, story)] : [];
  });
  const current = views.find((view) => view.campaign.race_id === settings.focus_race?.race_id);
  return {
    today,
    ...(current ? { current } : {}),
    past: views.filter((view) => view !== current).sort((a, b) => b.race.date.localeCompare(a.race.date) || a.campaign.id.localeCompare(b.campaign.id)),
  };
});
