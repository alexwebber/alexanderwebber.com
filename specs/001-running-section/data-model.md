# Data Model: Running Section

**Feature**: 001-running-section | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Three data zones. The zone a field lives in is the privacy control.

| Zone | Where | Written by | Contains |
|---|---|---|---|
| **Raw** | Private R2 bucket (`raw/`, `state/`) | fetch stage | Provider payloads exactly as received (GPS, start times, every metric), tokens, cursors, back-off state |
| **Published** | Git: `data/running/published/` | publish stage only (gated bot) | Sanitised, normalised JSON that is safe to be public. Schemas: `schemas/published/*.schema.json`, `additionalProperties: false` |
| **Owner** | Git: `data/running/owner/` | Owner/agent via PR | Hand-edited YAML + race photos. Schemas: `schemas/owner/*.schema.json` |

Derived values (goal status, PBs, weekly totals, race/hand-entry merge) are computed at build time
from Published + Owner and are never stored.

---

## 1. Raw zone (R2)

```text
raw/garmin/activities/<activityId>/{summary,details,splits,hr-zones,weather?}.json   # as received
raw/garmin/health/<metric>/<yyyy-mm-dd>.json        # vo2max, training-status, training-load,
                                                    # race-predictions, resting-hr, hrv, body-composition
state/garmin_tokens.enc                             # Garmin tokens, Fernet-encrypted (key = secret
                                                    #   GARMIN_TOKEN_KEY), re-uploaded on rotation
state/run-ids.json                                  # {<garminActivityId>: "<YYYY-MM-DD-xxxx>"} APPEND-ONLY;
                                                    #   the ONLY place Garmin IDs meet public run IDs
state/cursor.json                                   # {activities:{last_start_utc,last_id}, health:{metric:date}}
state/backfill.json                                 # resumable backfill progress
state/fetch-status.json                             # last attempt, last_success per source, failure class,
                                                    #   login_blocked_until, consecutive_failures
public/freshness.json                               # ONLY non-sensitive: last_success_at per source (+ generated_at)
```

Only `public/freshness.json` is reachable by a Worker. Everything else is private. Sleep, stress,
Body Battery etc. are never requested from Garmin at all (FR-015: not fetched, so not archived).

Raw weigh-in readings are archived (needed to recompute averages after an exclusion) but never
published.

---

## 2. Normalised types (in-memory, adapter output)

The adapter (`providers/garmin`) maps raw payloads to provider-neutral types; the processor works
only on these. Full-fidelity (still private).

- **NormalisedActivity**: `provider_id` (Garmin activity ID; private, never leaves the processor), `source`, `start_local` (datetime, Europe/London), `type`
  (`road|track|trail|indoor`), `is_race_flag` (Garmin event type), `distance_m`, `moving_s`,
  `elapsed_s`, `elevation_gain_m`, `elevation_loss_m`, `avg_hr`, `max_hr`, `avg_cadence`,
  `avg_stride_m`, `avg_power_w`, `dynamics{gct_ms, gct_balance_pct, vert_osc_mm, vert_ratio_pct}`,
  `training_effect{aerobic, anaerobic}`, `title_raw`, `splits[]`, `hr_zones[]`,
  `samples[]` (t_s, dist_m, speed_mps, hr, cadence, power, elev_m, lat, lon).
- **NormalisedHealthReading**: `metric`, `date`, `value` (+ `extra` e.g. HRV baseline range,
  training-status label, race-prediction distance), `recorded_at` (private).

Failure taxonomy (adapter raises, never leaks provider exceptions): `AuthRejected`,
`LoginBlocked(until)`, `ProviderForbidden` (Cloudflare 403), `RateLimited`, `ProviderChanged`
(schema drift), `Transient`.

---

## 3. Published entities (git, JSON)

### Run — `published/runs/<yyyy>/<run-id>.json` (spec: Run, Run Recording, Best Effort)

`<run-id>` is an **opaque public run ID**, `YYYY-MM-DD-xxxx` (pattern `^\d{4}-\d{2}-\d{2}-[a-z2-7]{4}$`):
the run's local date plus 4 random base32 characters, assigned once by `process/run_ids.py` and
recorded in R2 `state/run-ids.json`. **Garmin activity IDs are never published** - not in data
files, filenames, URLs, HTML, manifest or logs (a Garmin activity link can expose a training run's
GPS under some Garmin privacy settings).

| Field | Type | Notes / rule |
|---|---|---|
| `id` | string | Opaque public run ID (matches the filename); no Garmin ID anywhere in the file |
| `date` | `YYYY-MM-DD` | Local date only. **No time of day** (FR-011) |
| `type` | `road\|track\|trail\|indoor` | Indoor => excluded from PBs/goals by default (FR-057) |
| `is_race` | bool | From Garmin flag **or** owner override |
| `title` | string | Neutral generated, e.g. `Easy run · 8.2 km`; owner custom title wins (FR-012, FR-049). Race: owner/Garmin race name |
| `note` | string? | Owner note |
| `distance_m`, `moving_s`, `elapsed_s` | number | |
| `elevation_gain_m`, `elevation_loss_m` | number? | |
| `avg_pace_s_per_km`, `best_pace_s_per_km` | number | |
| `hr` | `{avg,max}`? | Omitted when not recorded (FR-048) |
| `cadence_avg`, `stride_m_avg`, `power_w_avg` | number? | Omitted when absent |
| `dynamics` | object? | gct, balance, vertical oscillation, vertical ratio; omitted when absent |
| `training_effect` | `{aerobic,anaerobic}`? | |
| `splits` | `[{km, time_s, pace_s_per_km, hr?, elev_delta_m?}]` | Per-km |
| `hr_zones` | `[{zone, seconds}]`? | |
| `series` | `{x_dist_m[], x_elapsed_s[], pace[], hr?[], elev?[], cadence?[], power?[]}` | **Downsampled to <= 600 points**; x-axis is distance/elapsed, never clock time (FR-013). No lat/lon. |
| `best_efforts` | `[{distance_m, label, time_s, plausible}]` | Computed in processor; `plausible:false` efforts kept for audit but ignored downstream (FR-057) |
| `flags` | `{excluded_from_records?, include_indoor_in_records?}` | Mirrors owner override so published JSON is self-explanatory; evaluation also re-applies owner file at build |
| `track_ref` | string? | Present only if `is_race` and map not hidden -> `race-tracks/<run-id>` |

Hidden runs (owner `hide: true`) are **not written at all** (FR-017). The manifest records only
that the id is hidden (no content).

### Race track — `published/race-tracks/<run-id>.json`

`{id, points: [[lat,lon,dist_m,elev_m]...] (<= ~1000, simplified), trim_ends_m, bbox, source}`.
Exists **only** for runs that are races and not map-hidden (FR-014). Absent otherwise; there is no
GPS anywhere else in published data.

### Health series — `published/health/<metric>/<yyyy>.json`

`{metric, unit, points:[{date, value, ...}]}` sorted by date, one file per year (bounded size,
git-friendly diffs). Metrics (approved list only, FR-015/060): `vo2max`, `training_status`
(value = status label code + optional numeric), `training_load`, `race_prediction_5k|10k|half|
marathon` (seconds), `resting_hr`, `hrv` (value + baseline low/high, `starts_on` implied by first
point, FR/Story5.7), `weight_avg7` (trailing 7-day mean of non-excluded readings in kg; day omitted
if no readings in window), `body_fat_pct` (as recorded, date only, multiple/day allowed; displayed
as recorded per FR-062 - its 7-day average for goal evaluation is derived at build time, never
stored).
**Individual weights are never published** (FR-061). Excluded readings (owner) are removed before
computation (FR-067).

### Refresh Record — `published/state/refresh.json`

`{sources:{garmin:{last_data_change_at, last_success_at_build}}, generated_at}` — updated only
when data changes; `last_success_at_build` is the last successful fetch time as known when this file
was written (the live, poll-level value is `last_success_at` in `public/freshness.json` in R2,
served by the Worker). Used for the build-time "as of" fallback (FR-005).

### Manifest — `published/state/manifest.json`

`{runs:{<run-id>:{input_hash, path, hidden?}}, health:{...}, schema_version, processed_at}`; drives
idempotent incremental reprocessing (input_hash = raw ETag + hash of the owner overrides relevant
to that run).

---

## 4. Owner entities (git, YAML)

All validated at build; errors report `file`, entry (index/id) and `field` (FR-070).

| File | Entity (spec) | Fields |
|---|---|---|
| `owner/goals.yaml` | **Goal** | list of `{id, type: race_time\|body_composition\|metric\|milestone, title, description?, priority, featured, deadline?, start_value?, linked_race?, status_override?, retired?, achieved_override?{date,note}, target...}` where target is by type: race_time `{distance_m\|distance:"10k", time:"44:59"}`; body_composition/metric `{metric, value, direction: at_most\|at_least}`; milestone none. Prior targets kept via git history (FR-040), not in file |
| `owner/section.yaml` | **Section settings** (+ focus race) | `{focus_race: {race_id (from upcoming-races), build_start, charity: {name}}, story_link?: {href, label} (link hidden until set, FR-024), stale_after_hours: 12, featured_goal_limit: 6, recent_highlight_days: {pb: 14, goal: 14}}` (FR-020/021/026/042). Every field except `focus_race` has a schema default; all are owner-editable |
| `owner/upcoming-races.yaml` | **Upcoming Race** | list `{id, name, date, distance_m\|distance, target_time?, url?, result_ref?}`; `result_ref` = slug of the owner race entry holding the result (see state machine below) |
| `owner/races/<slug>/race.yaml` | **Race** (+ **Race Photo**) | `{slug, run_id? (opaque public run ID), name?, date, distance, official_time?, official_distance_m?, position?, results_url?, note?, hide_map?, trim_ends_m?, designate: race\|not_race?, photos:[{file, description (required), caption?}]}`; `run_id` absent => hand-entered (FR-051); present => details for that Garmin-recorded race. Photos are files beside it |
| `owner/run-overrides.yaml` | **Run** flags | list `{id, title?, note?, hide?, exclude_from_records?, include_in_records?, is_race?}` (FR-049/050) |
| `owner/health-exclusions.yaml` | **Health Reading** excluded flag | list `{metric, date, reason?}` (FR-067) |
| `owner/lab/<date>-<type>.yaml` | **Lab Reference Measurement** | `{date, type: dexa\|lab_vo2max, provider, values:{body_fat_pct?, weight_kg?, vo2max?}}`. Only those three value keys are allowed; any other key fails validation (FR-066). Published as-is (owner-entered, owner-approved) |

Goal `target.metric` values: `weight_kg`, `body_fat_pct` (type `body_composition`; both judged on
the 7-day average), and `vo2max`, `resting_hr`, `hrv` etc. (type `metric`; judged on the recorded
value). Health-exclusion `metric` uses the same names.

Distance names accepted: `5k, 10k, 10mi, half, marathon, 1k, 1mi, 3k, 15k, 20k, 30k` or metres.
Times: `h:mm:ss` or `mm:ss`.

---

## 5. Derived entities (build time, pure functions)

- **Best Effort index**: flatten `best_efforts` of all eligible runs (not indoor unless included,
  not excluded, `plausible`) + manual race results (official time, owner-entered) -> per distance
  list sorted by date.
- **Personal Best**: per distance, fastest *race result* (official time wins over device time;
  hand-entered included) + fastest *any-run effort* if faster (FR-053). Highlighted "recent" for
  `recent_highlight_days.pb` days (default 14, US4.7).
- **Race** (linked): Garmin-flagged/designated runs + hand entries, joined **only** on an explicit
  `run_id` reference (no fuzzy merge). A hand-entered race (no `run_id`) that matches a Garmin race
  (same date, distance within 2%) **fails validation** telling the owner to add `run_id` to it, so
  each race appears exactly once (FR-052). For a linked race the owner's official details win over
  device values (FR-051). Race slug = owner `slug`, else the run ID.
- **Upcoming race state** (hero + upcoming list): `upcoming` (date > today) -> `race day` (date =
  today) -> `awaiting result` (date < today, no `result_ref`; hero: "result coming soon") ->
  `completed` (`result_ref` set; leaves the upcoming list, hero shows the result and the owner may
  point `section.yaml` `focus_race` at the next target). Evaluated at build in Europe/London.
  Days remaining / ">=0" / "Race day" derive from this state.
- **Goal status** (FR-033..041):
  - `race_time`: first date (earliest run date) with an eligible effort `< target` at the goal
    distance -> `achieved{date, effort, run_id}`; else `active`; if `deadline < today` ->
    `deadline_passed`; `retired` -> hidden. Progress = gap between fastest effort and target; also
    attaches the matching Garmin race prediction for 5k/10k/half/marathon (FR-038).
  - `body_composition` (weight or body fat): first date the **7-day average** first reaches the
    target in the stated direction (FR-034) - weight uses published `weight_avg7`; body fat uses a
    build-time trailing 7-day mean of the recorded readings (days with none in the window have no
    value). `metric` goals (VO2 max, etc.): first date the recorded value reaches the target. Progress =
    `(current-start)/(target-start)` clamped 0..1 (current = latest 7-day average for
    body-composition goals) (start = `start_value` else first reading on/after
    goal creation = first reading in series if none, per Assumption). No data -> "no data yet".
  - `milestone`: only `achieved_override`.
  - Owner `achieved_override` wins. Achieved stays achieved because "first date" is order-based.
  - Newly achieved within `recent_highlight_days.goal` days (default 14) -> landing highlight (FR-042).
- **Period totals** (FR-045): week (Mon-Sun, Europe/London), month, year, all-time: runs, distance,
  moving time, avg pace (distance-weighted), elevation. Includes indoor in totals.
- **This week snapshot**, **training build** (weekly km since `build_start`, longest run), **days
  remaining** (Europe/London date arithmetic; ">=0"; "Race day"; post-race state).
- **Lab comparison**: nearest Garmin reading within +/-7 days (FR-065): `{lab, device, diff}`.

---

## 6. State transitions

- **Goal**: `active -> achieved` (automatic or override; terminal for display; date immutable by
  construction), `active -> deadline_passed` (date-driven; returns to `active` when owner revises
  deadline), `* -> retired` (owner; hidden).
- **Race designation**: Garmin flag -> `race`; owner `designate: race|not_race` overrides; a
  race with `hide_map` loses its published track on next process.
- **Run visibility**: `visible -> hidden` (owner) removes published file on next process (git
  history retains the earlier file, which contained only sanitised data by design).
- **Pipeline**: `fetch (R2 updated) -> process (published diff) -> gate (validate+scan+build) ->
  commit -> deploy`; any failure before `commit` leaves published data and the live site
  untouched (FR-007).

## 7. Sanitisation rules (allow-list; contract-tested)

1. Output objects are constructed field by field from the allow-list in `process/sanitise.py`; the
   JSON Schemas (`additionalProperties:false`) are an independent second check.
2. `start_local` -> `date` only. Any timestamp in streams -> elapsed seconds.
3. `lat`/`lon`/location-derived strings (Garmin default titles, `locationName`, weather station)
   never copied for training runs. Race track only when `is_race` and not hidden.
4. Metrics outside the approved list are never read by the adapter (not fetched).
5. Weight: trailing-7-day mean only; individual readings never written.
6. A property test feeds random raw payloads (with injected sentinel lat/lon, times, location
   strings, Garmin activity IDs) and asserts none appear in serialized output; `scan-privacy` re-asserts on `dist/`.
7. Garmin activity IDs/URLs are never copied; public run IDs come only from `run_ids.py`; the
   published run schema pins `id` to the opaque pattern, and `scan-privacy` fails on any
   `connect.garmin.com` string, `activityId`/`garminId`-style key, or (when R2 credentials are
   available in the gate) any known Garmin ID from the map found in `data/` or `dist/`.
