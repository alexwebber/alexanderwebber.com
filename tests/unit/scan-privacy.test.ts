import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { scanImageFiles } from '../../scripts/scan-images.ts';
import { scanPrivacy, scanText } from '../../scripts/scan-privacy.ts';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const RUN_FILE = 'data/running/published/runs/2026/2026-10-11-k3f7.json';
const RUN_PAGE = 'dist/running/runs/2026-10-11-k3f7/index.html';
const rules = (file: string, text: string, ids?: Set<string>) => scanText(file, text, ids).map((f) => f.rule);

describe('scan-privacy', () => {
  it('finds times of day in run files and run pages', () => {
    expect(rules(RUN_FILE, '{"date":"2026-10-11T07:15:00"}')).toEqual(['time of day (ISO datetime) in a run file or run page']);
    expect(rules(RUN_FILE, '{"startTime":"07:15"}')).toEqual(['start time key in a run file or run page']);
    expect(rules(RUN_PAGE, '<p>Started at</p><script>{"start_date_local":"x"}</script>')).toEqual([
      'start time key in a run file or run page',
    ]);
  });

  it('does not mistake durations, paces or dates for times of day', () => {
    expect(rules(RUN_FILE, '{"date":"2026-10-11","title":"Run · 06:42 tempo","splits":[{"time_s":268}]}')).toEqual([]);
    expect(rules(RUN_PAGE, '<p>11 Oct 2026 · 44:41 · 4:28 /km · moving 06:42</p>')).toEqual([]);
  });

  it('allows ISO timestamps in pipeline bookkeeping', () => {
    expect(rules('data/running/published/state/refresh.json', '{"generated_at":"2026-10-17T10:02:11Z"}')).toEqual([]);
  });

  it('finds coordinates outside race tracks and race pages', () => {
    expect(rules(RUN_FILE, '{"series":{"latlng":[[50.8,-0.1]]}}')).toEqual(['coordinates outside race tracks and race pages']);
    expect(rules('dist/running/index.html', '<script>{"lat":50.82,"lon":-0.13}</script>')).toEqual([
      'coordinates outside race tracks and race pages',
    ]);
    expect(rules('data/running/published/race-tracks/2026-05-17-q2mb.json', '{"lat":50.8}')).toEqual([]);
    expect(rules('dist/running/races/hastings-half/index.html', '<script>{"lat":50.8}</script>')).toEqual([]);
    expect(rules('dist/_astro/maplibre.js', 'function f(e){return{lng:e.lng,lat:e.lat}}')).toEqual([]);
  });

  it('finds unapproved categories by key in data and by label on pages', () => {
    const category = (where: string) => `unapproved category (sleep, stress, Body Battery, steps, SpO2) ${where}`;
    expect(rules('data/running/published/health/hrv/2026.json', '{"points":[{"date":"2026-01-01","sleepSecs":27000}]}')).toEqual([category('in data')]);
    expect(rules('data/running/owner/manual-metrics.yaml', 'steps: 10000\n')).toEqual([category('in data')]);
    expect(rules('dist/running/health/index.html', '<td>SpO2 96%</td>')).toEqual([category('on a page')]);
    expect(rules('dist/running/index.html', '<p>12,345 steps today</p>')).toEqual([category('on a page')]);
    expect(rules('dist/running/index.html', '<p>Body Battery 80</p>')).toEqual([category('on a page')]);
  });

  it('does not flag prose about steps or stride', () => {
    expect(rules('dist/running/runs/x/index.html', '<p>Step length 1.21 m. Next steps: rest.</p><p>A stressful week</p>')).toEqual([]);
    expect(rules(RUN_FILE, '{"stride_m_avg":1.21,"title":"Run · steps and strides"}')).toEqual([]);
  });

  it('finds provider links, ID keys and free text in published runs', () => {
    expect(rules('dist/running/runs/x/index.html', '<a href="https://intervals.icu/activities/i1234567">x</a>')).toEqual(['provider activity link']);
    expect(rules('dist/running/index.html', '<a href="https://connect.garmin.com/modern/activity/1723">x</a>')).toEqual(['provider activity link']);
    expect(rules('dist/running/index.html', '<a href="https://www.garmin.com/">Garmin</a>')).toEqual([]);
    expect(rules(RUN_FILE, '{"activityId":1}')).toEqual(['provider activity ID key']);
    expect(rules('data/running/published/state/manifest.json', '{"external_id":"x"}')).toEqual(['provider activity ID key']);
    expect(rules(RUN_FILE, '{"note":"see i12345678"}')).toEqual(['intervals.icu-style activity ID']);
    expect(rules(RUN_FILE, '{"name":"Morning Run in Hove"}')).toEqual(['name or description key in a published run (titles use "title")']);
    expect(rules('data/running/owner/upcoming-races.yaml', '- { id: b, name: Brighton Marathon }\n')).toEqual([]);
  });

  it('finds known provider IDs anywhere', () => {
    const ids = new Set(['i98765432', '17234567890']);
    expect(rules('dist/running/index.html', '<!-- 17234567890 -->', ids)).toEqual(['known provider activity ID']);
    expect(rules('dist/running/index.html', '<p>172345678901</p>', ids)).toEqual([]);
  });

  it('reports a position and the key, never the values it caught', () => {
    const [coord] = scanText(RUN_FILE, '{"date":"2026-10-11",\n"lat":50.8231,"lon":-0.1372}');
    expect(coord).toMatchObject({ line: 2, column: 1, excerpt: '"lat":' });
    const [time] = scanText(RUN_FILE, '{"date":"2026-10-11T07:15:00"}');
    expect(time).toMatchObject({ line: 1, column: 10, excerpt: '[16 chars redacted]' });
    const [id] = scanText('dist/running/index.html', '<p>17234567890</p>', new Set(['17234567890']));
    expect(id.excerpt).toBe('[11 chars redacted]');
    const printed = JSON.stringify([coord, time, id]);
    for (const value of ['50.8231', '07:15', '17234567890']) expect(printed).not.toContain(value);
  });

  describe('fundraising', () => {
    const FIGURES = 'data/running/published/fundraising/brighton-2027.json';
    const OWNER_YAML = 'data/running/owner/campaigns.yaml';
    const PAGE = 'dist/running/index.html';
    const IN_DATA = 'donor, Gift Aid or JustGiving account key in data';
    const ON_PAGE = 'donor, Gift Aid or JustGiving account key on a page';
    const FIGURE = 'Gift Aid figure on a page';
    const KEYS = [
      'donor', 'donorName', 'donor_display_name', 'donation', 'donations', 'donationAmount', 'donation_amount', 'giftAid', 'gift_aid',
      'gift_aid_total', 'totalEstimatedGiftAid', 'ownerGuid', 'owner_guid', 'pageGuid', 'page_guid', 'campaignGuid', 'campaign_guid',
      'consumerId', 'consumer_id', 'pageId', 'page_id', 'eventId', 'event_id',
    ];

    it.each(KEYS)('finds %s in published JSON, owner YAML and quoted on a page', (name) => {
      expect(rules(FIGURES, `{"${name}":"x"}`)).toEqual([IN_DATA]);
      expect(rules(OWNER_YAML, `- ${name}: x\n`)).toEqual([IN_DATA]);
      expect(rules(PAGE, `<script>{"${name}":"x"}</script>`)).toEqual([ON_PAGE]);
      expect(rules(PAGE, `<script>{'${name}' : 'x'}</script>`)).toEqual([ON_PAGE]);
    });

    it('fails a quoted key on a page but not a bare one, or a sentence', () => {
      expect(rules(PAGE, '<p>Donations: thank you to everyone</p>')).toEqual([]);
      expect(rules(PAGE, '<p>Donor: anonymous</p>')).toEqual([]);
      expect(rules(PAGE, '<script>const a = {pageId: 1}</script>')).toEqual([]);
    });

    it('leaves the figures the file really holds alone', () => {
      const clean = '{"campaign_id":"brighton-2027","last_read_at":"2026-11-10T09:17:03Z","points":[{"date":"2026-11-10","raised_pence":100,"supporters":1,"target_pence":50000}],"schema_version":1}\n';
      expect(rules(FIGURES, clean)).toEqual([]);
    });

    it('leaves bundled library code alone', () => {
      expect(rules('dist/_astro/maplibre.js', '{"pageId":1,"donor":2}')).toEqual([]);
    });

    it('exempts approved stories from the key rule', () => {
      expect(rules('data/running/owner/stories/brighton-2027.yaml', 'text: |\n  Donations: every one helps.\n')).toEqual([]);
      expect(rules(OWNER_YAML, '# donations: a note\n')).toEqual([IN_DATA]);
    });

    it('finds a Gift Aid figure on a page, either way round', () => {
      expect(rules(PAGE, '<p>Gift Aid adds £312 to this</p>')).toEqual([FIGURE]);
      expect(rules(PAGE, '<p>£312.50 more with gift aid</p>')).toEqual([FIGURE]);
      expect(rules(PAGE, '<p>Gift Aid</p>\n<span>£1,250</span>')).toEqual([FIGURE]);
    });

    it('allows Gift Aid as a word, and a figure further away', () => {
      expect(rules(PAGE, '<p>Gift Aid makes every donation go further.</p>')).toEqual([]);
      expect(rules(PAGE, `<p>Gift Aid helps.${' '.repeat(41)}£1,250 raised</p>`)).toEqual([]);
      expect(rules(PAGE, `<p>£1,250 raised.${' '.repeat(41)}Gift Aid helps</p>`)).toEqual([]);
      expect(rules(PAGE, '<p>£1,250 raised of £2,000</p>')).toEqual([]);
    });

    it('only applies the page rules to pages', () => {
      expect(rules('data/running/owner/stories/a.yaml', 'text: Gift Aid adds £312\n')).toEqual([]);
      expect(rules('dist/_astro/x.js', 'Gift Aid adds £312')).toEqual([]);
    });

    it('SC-004: a published file with a planted Gift Aid figure and donor name fails the scan (T105)', async () => {
      // quickstart.md §10: the scan over the repo, as the gate runs it, not just scanText.
      repo = tempRepo();
      const clean = { schema_version: 1, campaign_id: 'brighton-2027', last_read_at: '2026-11-10T09:17:03Z', points: [{ date: '2026-11-10', raised_pence: 100, supporters: 1, target_pence: 50000 }] };
      repo.write(FIGURES, clean);
      expect(await scanPrivacy(repo.root)).toEqual([]);
      // The scan reports a rule's first match in a file, so each key is planted alone, then both.
      const planted = [
        { ...clean, totalEstimatedGiftAid: '12.50' },
        { ...clean, points: [{ ...clean.points[0], donorName: 'A Person' }] },
        { ...clean, totalEstimatedGiftAid: '12.50', points: [{ ...clean.points[0], donorName: 'A Person' }] },
      ];
      const findings: Awaited<ReturnType<typeof scanPrivacy>> = [];
      for (const [i, file] of planted.entries()) {
        repo.write(FIGURES, file);
        const found = await scanPrivacy(repo.root);
        expect(found.map((f) => [f.file, f.rule]), `planted ${i}`).toEqual([[FIGURES, IN_DATA]]);
        findings.push(...found);
      }
      expect(findings.map((f) => f.excerpt)).toEqual(['"totalEstimatedGiftAid":', '"donorName":', '"donorName":']);
      expect(JSON.stringify(findings)).not.toMatch(/12\.50|A Person/);
    });

    it('never reports the matched value', () => {
      const [figure] = scanText(PAGE, '<p>Gift Aid adds £312 to this</p>');
      expect(figure).toMatchObject({ line: 1, column: 4, excerpt: expect.stringMatching(/^\[\d+ chars redacted\]$/) });
      const [key] = scanText(FIGURES, '{"donorName":"A Person"}');
      expect(key).toMatchObject({ line: 1, column: 2, excerpt: '"donorName":' });
      expect(JSON.stringify([figure, key])).not.toMatch(/312|A Person/);
    });
  });

  it('finds image metadata in dist/ and owner photos that break the rules', async () => {
    repo = tempRepo();
    const pixel = { create: { width: 10, height: 10, channels: 3 as const, background: '#c33' } };
    await sharp(pixel).jpeg().withExif({ IFD0: { Copyright: 'x' } }).toFile(`${repo.root}/clean-not.jpg`);
    repo.write('dist/x.txt', '');
    await sharp(pixel).jpeg().withExif({ IFD0: { Copyright: 'x' } }).toFile(`${repo.root}/dist/photo.jpg`);
    await sharp(pixel).jpeg().toFile(`${repo.root}/dist/clean.jpg`);
    expect((await scanPrivacy(repo.root)).map((f) => [f.file, f.rule])).toEqual([
      ['dist/photo.jpg', 'image metadata in the built site'],
    ]);

    repo.write('data/running/owner/races/r/x.txt', '');
    const big = { create: { width: 2401, height: 10, channels: 3 as const, background: '#c33' } };
    await sharp(big).jpeg().toFile(`${repo.root}/data/running/owner/races/r/big.jpg`);
    await sharp(pixel).png().toFile(`${repo.root}/data/running/owner/races/r/photo.png`);
    await sharp(pixel).jpeg().withExif({ IFD0: { Copyright: 'x' } }).toFile(`${repo.root}/data/running/owner/races/r/exif.jpg`);
    const findings = await scanImageFiles(repo.root, [
      'data/running/owner/races/r/big.jpg',
      'data/running/owner/races/r/photo.png',
      'data/running/owner/races/r/exif.jpg',
    ]);
    expect(findings.map((f) => f.message)).toEqual([
      'is 2401x10; the long edge must be at most 2400 px',
      'owner photos must be .jpg, .webp or .avif',
      'contains EXIF metadata (strip it before committing)',
    ]);
  });
});
