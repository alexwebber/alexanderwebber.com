# Spike 0 results: intervals.icu coverage check

Run 2026-10-17 locally with the owner's personal API key (`probe.py`), athlete `0`. Field
availability only; raw payloads stayed in the gitignored `out/` folder.

**Verdict: PASS.** Every field the spec needs from the provider is returned for Garmin-synced
data, except Garmin's own training status and race predictions (expected; these become manual
owner entries). No blocker, so Garmin direct stays shelved.

## Gotcha

intervals.icu sits behind Cloudflare, which returns **403 (HTML challenge page)** for Python
`urllib`'s default `Python-urllib/3.x` User-Agent. A descriptive UA
(`alexanderwebber.com-ingest-spike/0.1 (+https://alexanderwebber.com)`) gets 200. The adapter
must always send its own User-Agent.

## Activities

278 activities, all `source = GARMIN_CONNECT`, 2025-10-18 → 2026-10-16 (the 1-year sync
backfill; older history arrives via the Garmin export import). Runs: 189 = 137 `Run` +
52 `VirtualRun` (treadmill).

| Need (spec) | Field(s) | Coverage (of 189 runs) |
|---|---|---|
| Date (no start time published) | `start_date_local` | 189 |
| Distance, moving/elapsed time, pace | `distance`, `moving_time`, `elapsed_time`, `pace` | 189 |
| Elevation | `total_elevation_gain/loss` | 137 (outdoor runs; treadmill has none) |
| HR avg/max, HR zones | `average_heartrate`, `max_heartrate`, `icu_hr_zone_times`, `/time-at-hr` | 189 |
| Cadence, stride | `average_cadence`, `average_stride` | 189 |
| Running dynamics | `average_vertical_oscillation`, `average_vertical_ratio`, `average_stance_time` (GCT), `average_step_length` | 157 (from 2025-12-01, the current watch) |
| Running power | `device_watts` + `watts` stream (`icu_average_watts` empty in the list view) | 157 |
| Training load | `icu_training_load`, `trimp`; per-day `ctl`/`atl` (intervals.icu's model, not Garmin's) | 189 |
| Splits / laps | `icu_lap_count`, `icu_intervals`, streams (`distance`, `time`, `velocity_smooth`) → km splits computed | 189 |
| Race marker | `race` flag exists but is never set → races come from owner data | 0 set |
| Race maps | `latlng` stream (**must be stripped for training runs at ingest**) | present |
| Best efforts | `/activity/{id}/best-efforts`, `/athlete/0/pace-curves.json` | 200 |
| FIT / original file | `/activity/{id}/fit-file`, `/activity/{id}/file` | 200 |

Streams on the latest run: altitude, cadence, distance, fixed_altitude, heartrate, latlng,
respiration, stance_time, stance_time_balance, stance_time_percent, step_length, time, torque,
velocity_smooth, vertical_oscillation, vertical_ratio, watts.

Free-text `name`/`description` are returned. The spec's neutral titles mean the adapter
must not publish them for training runs.

## Wellness (367 days)

| Need (spec) | Field | Days filled | From |
|---|---|---|---|
| Weight (7-day average) | `weight` | 214 | 2025-10-21 |
| Body fat % | `bodyFat` | 206 | 2025-10-21 |
| Resting HR | `restingHR` | 366 | 2025-10-17 |
| HRV | `hrv` (rMSSD; `hrvSDNN` empty) | 318 | 2025-12-01 |
| VO2 max | `vo2max` | 143 | 2025-10-17 |
| Fitness / fatigue | `ctl`, `atl`, `rampRate` | 365 | 2025-10-18 |
| *Private (never published)* | `sleepSecs`, `steps`, `spO2` | ingest must drop | |
| Not supplied | `stress`, `readiness`, `respiration` | 0 | |

## Not available (→ manual owner entries)

- Garmin **training status** (Productive / Maintaining / …).
- Garmin **race predictions** (5k / 10k / half / marathon).

## From GitHub Actions

**PASS** (2026-10-17, run 39048175253, `ubuntu-latest`): all nine calls returned 200 from a
GitHub-hosted runner with the descriptive User-Agent. So Actions can fetch directly, and the
PC-fetch fallback isn't needed. The throwaway workflow was removed before merge.
