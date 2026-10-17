# Contract: Data File Formats & Schemas

JSON Schema 2020-12 files in `schemas/` are authoritative; this document fixes layout, naming and
cross-cutting rules. Field-level definitions: [data-model.md](../data-model.md).

## Layout

```text
data/running/published/runs/<yyyy>/<run-id>.json     schemas/published/run.schema.json
data/running/published/race-tracks/<run-id>.json     schemas/published/race-track.schema.json
data/running/published/health/<metric>/<yyyy>.json   schemas/published/health-series.schema.json
data/running/published/state/refresh.json            schemas/published/refresh.schema.json
data/running/published/state/manifest.json           schemas/published/manifest.schema.json
data/running/owner/goals.yaml                        schemas/owner/goals.schema.json
data/running/owner/section.yaml                      schemas/owner/section.schema.json
data/running/owner/upcoming-races.yaml               schemas/owner/upcoming-races.schema.json
data/running/owner/run-overrides.yaml                schemas/owner/run-overrides.schema.json
data/running/owner/health-exclusions.yaml            schemas/owner/health-exclusions.schema.json
data/running/owner/races/<slug>/race.yaml            schemas/owner/race.schema.json
data/running/owner/lab/<date>-<type>.yaml            schemas/owner/lab.schema.json
data/running/owner/manual-metrics.yaml               schemas/owner/manual-metrics.schema.json
```

`<run-id>` is the opaque public run ID `YYYY-MM-DD-xxxx` (schema pattern
`^\d{4}-\d{2}-\d{2}-[a-z2-7]{4}$`). **Provider activity IDs (intervals.icu IDs, Garmin
`external_id`s) never appear in any file, filename or URL**; the mapping exists only in private R2 (`state/run-ids.json`). Owner files reference runs by
this ID (copy it from the run page URL).

## Cross-cutting rules

- Every published and owner file carries/gets a `schema_version` (published: in file; owner:
  optional, default current). Breaking changes bump it and ship a migration.
- Published schemas: `additionalProperties: false` everywhere; no fields named or typed for
  coordinates in anything but `race-track`; a schema test asserts no `lat|lon|latlng|latitude|
  longitude|start_time|startTime` key can validate outside `race-track`, and no `name|description`
  key can validate in a published run (run titles use the `title` field only). The health-series `metric` enum is exactly `vo2max,
  fitness_ctl, fatigue_atl, resting_hr, hrv, weight_avg7, body_fat_pct`; there is no published
  training-status or race-prediction series (those are owner data).
- Owner schemas: strict too (typos like `offical_time` are errors, not ignored). Lab `values` are
  limited to `body_fat_pct`, `weight_kg`, `vo2max` (FR-066). Manual metrics: `as_of` required on
  every entry, not in the future, unique within its list; `status` from the fixed Garmin
  training-status enum; each prediction entry has at least one of `5k`, `10k`, `half`, `marathon`.
- Formats: dates `YYYY-MM-DD`; durations/times as seconds in published JSON, `h:mm:ss`/`mm:ss`
  strings in owner YAML (parsed + range-checked); distances metres in JSON, named distances or
  metres in YAML; numbers finite; strings trimmed; photo `description` minLength 1.
- Referential checks beyond schema (run in `validate-data`): goal `linked_race` exists;
  `section.yaml` `focus_race.race_id` exists in upcoming races; upcoming `result_ref` names an
  existing race entry; race `run_id` exists in published runs (warning if run not yet ingested);
  override `id` exists; photo files exist and have no EXIF; unique ids; at most
  `featured_goal_limit` (default 6) featured goals; priorities unique among featured;
  **duplicate race**: a hand-entered race (no `run_id`) matching a recorded race run (same date,
  distance within 2%) is an error - add `run_id` to it (no fuzzy auto-merge); at most one entry per
  `run_id`; no provider-style activity IDs in any owner file.
## Owner-content examples (illustrative values)

```yaml
# section.yaml  (every field optional except focus_race; defaults shown)
focus_race: { race_id: brighton-2027, build_start: 2026-11-16, charity: { name: Martlets hospice } }
# story_link: { href: /story/, label: My story }   # hidden until set (FR-024)
stale_after_hours: 12
featured_goal_limit: 6
recent_highlight_days: { pb: 14, goal: 14 }
```

```yaml
# upcoming-races.yaml
- id: brighton-2027
  name: Brighton Marathon
  date: 2027-04-04
  distance: marathon
  target_time: "3:30:00"
  url: https://www.brightonmarathonweekend.co.uk/
# after the race, link the result and the race leaves this list:
# result_ref: brighton-2027        # slug of data/running/owner/races/brighton-2027/
```

```yaml
# goals.yaml
- id: brighton-sub-330
  type: race_time
  title: Brighton Marathon sub-3:30
  priority: 1
  featured: true
  deadline: 2027-04-04
  linked_race: brighton-2027
  target: { distance: marathon, time: "3:30:00" }
- id: weight-93
  type: body_composition
  title: Reach 93 kg
  priority: 5
  featured: true
  start_value: 102.4
  target: { metric: weight_kg, value: 93, direction: at_most }     # judged on the 7-day average
- id: body-fat-17-5
  type: body_composition
  title: Body fat 17.5%
  priority: 6
  target: { metric: body_fat_pct, value: 17.5, direction: at_most } # judged on the 7-day average (FR-034)
- id: vo2max-55
  type: metric
  title: VO2 max 55
  priority: 7
  target: { metric: vo2max, value: 55, direction: at_least }
```

```yaml
# races/hastings-half-2026/race.yaml  (links to a recorded race by run_id)
slug: hastings-half-2026
run_id: 2026-05-17-k3f7          # opaque ID from the run page URL; official details below win
name: Hastings Half Marathon
date: 2026-05-17
distance: half
official_time: "1:41:07"
position: 212
results_url: https://example.org/results
hide_map: false
photos:
  - { file: finish.jpg, description: "Alex crossing the finish line with both arms raised" }
```

```yaml
# races/2019-example-10k/race.yaml  (hand-entered, never in Garmin: NO run_id)
slug: 2019-example-10k
date: 2019-10-13
name: Example 10k
distance: 10k
official_time: "52:30"
```

```yaml
# run-overrides.yaml
- { id: 2026-09-28-q2mb, title: Long run with Sam, note: "Felt strong after 25 km" }
- { id: 2026-08-02-a7cd, exclude_from_records: true }   # GPS glitch
- { id: 2026-07-19-zz4k, hide: true }
- { id: 2026-06-01-p2rt, is_race: true }                # parkrun designated as a race
- { id: 2026-05-04-t6nb, include_in_records: true }     # treadmill run the owner marks PB-eligible
```

```yaml
# manual-metrics.yaml  (Garmin figures intervals.icu lacks; read in Garmin Connect, dated)
training_status:
  - { as_of: 2026-10-12, status: productive }
  - { as_of: 2026-10-17, status: maintaining, note: "Taper week" }
race_predictions:
  - { as_of: 2026-10-17, 5k: "21:05", 10k: "44:10", half: "1:38:30", marathon: "3:28:40" }
```

```yaml
# health-exclusions.yaml
- { metric: weight_kg, date: 2026-09-14, reason: "partner stepped on the scale" }
```

```yaml
# lab/2026-11-20-dexa.yaml
date: 2026-11-20
type: dexa
provider: Example Clinic
values: { body_fat_pct: 24.1, weight_kg: 102.4 }
```

## Validation errors

- Error format (FR-070): `data/running/owner/goals.yaml  goal "10k-sub-45"  field target.time:
  "44:7x" is not a valid time (expected mm:ss or h:mm:ss)`; process exits non-zero, deploy blocked.
- Images: owner photos are `.jpg|.webp|.avif`, long edge <= 2400 px, **zero metadata** (enforced by
  `scan-images`).
- Determinism: published JSON is written with sorted keys and fixed formatting so diffs reflect
  only real changes.
