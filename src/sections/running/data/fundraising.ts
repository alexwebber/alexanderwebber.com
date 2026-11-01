// Campaigns as the pages show them (T046; specs/002-fundraising/data-model.md §7). A campaign with
// figures is one whose published file exists; others appear nowhere (FR-022). The current campaign
// is the one linked to the focus race. Memoised per store and day.
import { today as londonToday } from '../../../shared/format/dates.ts';
import { campaignProgress, type CampaignProgress } from '../domain/fundraising.ts';
import { runningStore, sectionSettings } from './load.ts';
import { perStoreAndDay } from './memo.ts';
import type { Campaign, CampaignFigures, RunningStore, UpcomingRace } from './store/index.ts';

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
  staleAfterHours: number;
}

export interface FundraisingData {
  current?: CampaignView;
  /** Every other campaign with figures. */
  past: CampaignView[];
}

export function loadFundraising(today: string = londonToday(), store: RunningStore = runningStore()): Promise<FundraisingData> {
  return load(today, store);
}

const load = perStoreAndDay(async (_today, store): Promise<FundraisingData> => {
  const [owner, published, settings] = await Promise.all([store.getOwner(), store.getCampaignFigures(), sectionSettings(store)]);
  const campaign = owner.campaigns.find((c) => c.race_id === settings.focus_race?.race_id);
  const file = published.find((f) => f.campaign_id === campaign?.id);
  const race = owner.upcomingRaces.find((r) => r.id === campaign?.race_id);
  if (!campaign || !file || !race) return { past: [] };

  const figures = file.points.at(-1)!;
  const progress = campaignProgress(figures.raised_pence, figures.target_pence);
  return {
    current: {
      campaign,
      race: { name: race.name, date: race.date },
      figures,
      lastReadAt: file.last_read_at,
      points: file.points,
      ...(progress ? { progress } : {}),
      staleAfterHours: settings.stale_after_hours,
    },
    past: [],
  };
});
