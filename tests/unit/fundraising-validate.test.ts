// validate-data's fundraising checks (specs/002-fundraising/contracts/data-files.md): every
// referential rule, with file, entry, field and severity.
import { afterEach, describe, expect, it } from 'vitest';
import { formatIssue } from '../../src/shared/storage/errors.ts';
import { validateData } from '../../scripts/validate-data.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const TODAY = '2026-11-10';
const issues = (severity: 'error' | 'warning') =>
  validateData(repo.root, { today: TODAY })
    .filter((i) => i.severity === severity)
    .map(formatIssue);

const OWNER = 'data/running/owner';
const CAMPAIGNS = `${OWNER}/campaigns.yaml`;
const figuresFile = (id: string) => `data/running/published/fundraising/${id}.json`;

const campaign = (id: string, extra: Record<string, string> = {}) => {
  const fields = {
    race_id: 'brighton-2027',
    charity: '{ name: Martlets }',
    page_url: `https://www.justgiving.com/page/example-${id}`,
    ...extra,
  };
  return `- { id: ${id}, ${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join(', ')} }\n`;
};

const figures = (id: string, extra: Record<string, unknown> = {}) => ({
  schema_version: 1,
  campaign_id: id,
  last_read_at: '2026-11-10T09:17:03Z',
  points: [{ date: '2026-11-09', raised_pence: 100, target_pence: 50000, supporters: 1 }],
  ...extra,
});

function owner() {
  repo = tempRepo();
  repo.write(`${OWNER}/section.yaml`, 'focus_race: { race_id: brighton-2027, build_start: 2026-11-16, charity: { name: Martlets } }\n');
  repo.write(`${OWNER}/upcoming-races.yaml`, '- { id: brighton-2027, name: Brighton Marathon, date: 2027-04-04, distance: marathon }\n- { id: hove-10k, name: Hove 10k, date: 2027-06-06, distance: 10k }\n');
}

describe('fundraising validation', () => {
  it('passes a consistent campaign and its figures', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('brighton-2027'));
    repo.write(figuresFile('brighton-2027'), figures('brighton-2027'));
    expect(issues('error')).toEqual([]);
    expect(issues('warning')).toEqual([]);
  });

  it('treats no campaigns file as no campaigns', () => {
    owner();
    expect(issues('error')).toEqual([]);
  });

  it('rejects a repeated campaign id, race and page', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('a') + campaign('a', { race_id: 'hove-10k', page_url: 'https://www.justgiving.com/page/example-a' }));
    expect(issues('error')).toEqual([
      `${CAMPAIGNS}  campaign "a"  field id: is used by another campaign`,
      `${CAMPAIGNS}  campaign "a"  field page_url: is used by another campaign`,
    ]);
    repo.write(CAMPAIGNS, campaign('a') + campaign('b'));
    expect(issues('error')).toEqual([`${CAMPAIGNS}  campaign "b"  field race_id: "brighton-2027" has another campaign (both would be current)`]);
  });

  it('needs a known race, from either list', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('a', { race_id: 'paris-2027', charity: '{ name: Other }' }));
    expect(issues('error')).toEqual([
      `${CAMPAIGNS}  campaign "a"  field race_id: "paris-2027" is not an id in upcoming-races.yaml or a race under ${OWNER}/races/`,
    ]);
    repo.write(`${OWNER}/races/paris-2027/race.yaml`, 'slug: paris-2027\nname: Paris\ndate: 2026-04-05\ndistance: marathon\nofficial_time: "3:40:00"\n');
    expect(issues('error')).toEqual([]);
  });

  it('gives the contract\'s message when the charity differs from the focus race', () => {
    owner();
    repo.write(`${OWNER}/section.yaml`, 'focus_race: { race_id: brighton-2027, build_start: 2026-11-16, charity: { name: Martlets hospice } }\n');
    repo.write(CAMPAIGNS, campaign('brighton-2027'));
    expect(issues('error')).toEqual([
      'data/running/owner/campaigns.yaml  campaign "brighton-2027"  field charity.name: "Martlets" differs from section.yaml focus_race.charity.name "Martlets hospice"; the hero and the card would name different charities',
    ]);
  });

  it('only compares the charity for the focus race\'s campaign', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('hove', { race_id: 'hove-10k', charity: '{ name: Other Charity }' }));
    expect(issues('error')).toEqual([]);
  });

  it('says a target comes from JustGiving', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('a', { target: '500' }));
    const [message, ...rest] = issues('error');
    expect(rest).toEqual([]);
    expect(message).toContain(`${CAMPAIGNS}  campaign "a"  field target:`);
    expect(message).toContain('read from the JustGiving page');
  });

  it('names the entry and field for a mistyped page address', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('a', { page_url: 'https://www.justgiving.com/page/Example/' }));
    expect(issues('error')).toEqual([
      `${CAMPAIGNS}  campaign "a"  field page_url: "https://www.justgiving.com/page/Example/" is not a JustGiving page address (expected https://www.justgiving.com/page/<name>, lowercase, no trailing slash)`,
    ]);
  });

  it('needs a published file\'s campaign_id to match its name', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('brighton-2027'));
    repo.write(figuresFile('brighton-2027'), figures('other'));
    expect(issues('error')).toEqual([
      `${figuresFile('brighton-2027')}  campaign figures "other"  field campaign_id: does not match the file name "brighton-2027"`,
    ]);
  });

  it('needs points sorted, one per date, none in the future', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('brighton-2027'));
    const point = (date: string) => ({ date, raised_pence: 1, supporters: 1 });
    repo.write(figuresFile('brighton-2027'), figures('brighton-2027', { points: [point('2026-11-09'), point('2026-11-08')] }));
    expect(issues('error')).toEqual([
      `${figuresFile('brighton-2027')}  campaign figures "brighton-2027"  field points[1].date: "2026-11-08" is not after the previous point (2026-11-09); points must be sorted, one per day`,
    ]);
    repo.write(figuresFile('brighton-2027'), figures('brighton-2027', { points: [point('2026-11-09'), point('2026-11-09')] }));
    expect(issues('error')).toHaveLength(1);
    repo.write(figuresFile('brighton-2027'), figures('brighton-2027', { points: [point('2026-11-11')] }));
    expect(issues('error')).toEqual([`${figuresFile('brighton-2027')}  campaign figures "brighton-2027"  field points[0].date: 2026-11-11 is in the future`]);
  });

  it('rejects a published file that carries a donor key', () => {
    owner();
    repo.write(figuresFile('brighton-2027'), { ...figures('brighton-2027'), donorName: 'A Person' });
    expect(issues('error')[0]).toContain('field donorName: is not a known field');
  });

  it('warns about a published file with no campaign, and keeps it', () => {
    owner();
    repo.write(figuresFile('old-2026'), figures('old-2026'));
    expect(issues('error')).toEqual([]);
    expect(issues('warning')).toEqual([`${figuresFile('old-2026')}  campaign figures "old-2026": has no campaign in campaigns.yaml: its history is kept and not shown`]);
  });

  it('warns about a finished campaign with no published file', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('a', { finished: 'true' }));
    expect(issues('error')).toEqual([]);
    expect(issues('warning')).toEqual([`${CAMPAIGNS}  campaign "a"  field finished: is set but the campaign has no published figures, so it would never appear`]);
  });

  it('lets the owner-file provider-ID scan pass the 6-digit charity number', () => {
    owner();
    repo.write(CAMPAIGNS, campaign('a', { charity: '{ name: Martlets, registered: { name: Southern Hospice Group, number: "256789" } }' }));
    expect(issues('error')).toEqual([]);
  });
});
