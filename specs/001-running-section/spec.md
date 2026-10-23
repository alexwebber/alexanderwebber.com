# Feature Specification: Running Section

**Feature Branch**: `001-running-section`

**Created**: 2026-10-04

**Status**: Draft

**Amended**: 2026-10-17 — the data provider is **intervals.icu** (an official Garmin sync partner),
not Garmin Connect directly; Garmin training status and race predictions become dated owner
entries; training load is intervals.icu's fitness/fatigue model; treadmill runs are labelled; views
of Garmin-sourced data carry Garmin attribution (owner decisions, see `PROJECT_MEMORY.md`).

**Input**: User description: "The Running section of alexanderwebber.com: a warm, personal, data-rich home for Alexander's running, aimed at friends, family, sponsors and fellow runners. Data comes from Garmin Connect (activities, health and performance metrics, Garmin Index smart scale for weight and body fat) and is refreshed on a schedule into the site's own store. In scope: a Brighton-led goals hub landing page; goals as a first-class concept (race-time, body-composition and performance-metric targets, achieved by any recorded effort, shown with Garmin race predictions); training stats with full run detail (no start times, no training GPS); races & PBs with race-only GPS maps, race photos and full history plus manual entries; health & performance metrics (VO2 max, training status/load, race predictions, resting HR, HRV, 7-day-average weight, body fat %) with lab reference measurements (DEXA, lab VO2 max). Out of scope: fundraising, journey/story and educational videos, training-run photos." (Full owner answers gathered in question rounds on 2026-10-04.) (superseded; see Amended)

## Overview

The Running section is the first section of alexanderwebber.com. Its audience is people who care
about Alexander's running — friends, family, sponsors and fellow runners — so its tone is warm and
personal, and it leads with pictures (charts, progress bars, countdowns) rather than prose.

Its centrepiece is the **Brighton Marathon on 4 April 2027**, which Alexander is running for
**Martlets hospice**. Around it sit his other goals (faster 5k and 10k, lower weight and body fat,
higher VO2 max), a record of his training, his race history and personal bests, and his health
and performance trends.

All running and health data comes from his **Garmin** watch and Garmin Index smart scale, reaching
the site through **intervals.icu**, an official Garmin sync partner that the site reads with
Alexander's personal API key. His full history comes from his Garmin data export, imported into
intervals.icu. The site keeps its own copy of that data, refreshed every few hours, so pages never
depend on intervals.icu or Garmin being available. Two Garmin figures intervals.icu does not
provide — **training status** and **race predictions** — are entered by hand with the date they
were read and shown "as of" that date. Everything Alexander adds by hand — goals, older races,
upcoming races, race photos, lab test results, those Garmin figures, corrections — is added by
editing the site's files; there are no logins. Views showing Garmin-sourced data carry Garmin
attribution.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Landing page: the Brighton-led goals hub (Priority: P1)

A friend, family member or sponsor opens the Running section and immediately sees how Alexander is
getting on. The page is led by the Brighton Marathon: how many days are left, the time he is
currently aiming for, what Garmin last predicted he would run (as of the date he recorded it), and how his training is building
towards race day. Alongside it, his other high-priority goals are shown prominently with clear
progress (e.g. sub-45 min 10k, sub-20 min 5k, 17.5% body fat, 93 kg target weight with "about 10 kg
to go", a VO2 max target). Below that is a snapshot of this week's running and his most recent run.
A clearly visible link leads to his personal story once that page exists.

**Why this priority**: This is the page most visitors will see and share. On its own — even with
nothing else in the section — it answers "how is Alex doing and what is he aiming for?", which is
the core purpose of the section.

**Independent Test**: With a stored set of runs, health readings and goals, open the landing page on
a phone and confirm a first-time visitor can state the Brighton race date, days remaining, current
target time, and progress on each featured goal, plus this week's distance — without scrolling past
the first two screens.

**Acceptance Scenarios**:

1. **Given** today is 4 October 2026 and the Brighton target is sub-3:30, **When** a visitor opens the
   landing page, **Then** they see "Brighton Marathon · 4 April 2027", the number of days remaining
   (182), "Target: sub-3:30", "For Martlets hospice", and the latest owner-entered Garmin marathon
   prediction with its "as of" date.
2. **Given** the owner has tightened the Brighton target to sub-3:20, **When** the site next updates,
   **Then** the landing page shows "Target: sub-3:20" and no longer shows 3:30.
3. **Given** four goals are marked as featured with priorities 1–4, **When** a visitor views the
   landing page, **Then** the goals appear in priority order, each with its target, current value,
   and a visual progress indicator.
4. **Given** the 7-day average weight is 103.0 kg and the weight goal is 93 kg, **When** a visitor
   views the weight goal, **Then** it reads "10.0 kg to go" (or equivalent) with a progress
   indicator from the starting weight towards 93 kg.
5. **Given** Alexander has run three times since Monday, **When** a visitor views the this-week
   snapshot, **Then** they see the week's run count, total distance and time, a comparison with last
   week, and a summary card for the most recent run linking to its detail page.
6. **Given** the personal story page does not yet exist, **When** a visitor views the landing page,
   **Then** no story link or empty placeholder is shown; **Given** the story page has been
   published, **Then** a prominent link to it appears without any other change to the landing page.
7. **Given** data from intervals.icu has not refreshed for 2 days, **When** a visitor opens the landing page,
   **Then** the page still renders fully from the last stored data and shows when it was last
   updated, with a notice that data may be out of date.

---

### User Story 2 - Goals (Priority: P1)

A visitor opens the Goals page to see everything Alexander is working towards: the current active
goals in priority order, each with its target, current value, progress, optional deadline, and —
for race-time goals — his latest recorded Garmin race prediction (shown "as of" its date) as an
indicator of how close he is. Below,
achieved goals are celebrated with the date they were achieved and the effort or reading that
achieved them. Alexander adds, edits, reorders, revises and retires goals by editing the site's
files.

**Why this priority**: Goals are what turn raw data into a story people can follow and cheer on.
The landing page depends on goals, so goals must exist for the P1 landing page to be meaningful.

**Independent Test**: Define one goal of each type in the site's files (a race-time goal, a weight
goal, a body-fat goal, a VO2 max goal), refresh the site, and confirm each displays correct
progress; then add a run containing a qualifying effort and confirm the matching goal becomes
achieved with the right date.

**Acceptance Scenarios**:

1. **Given** an active goal "10k under 45:00" and a training run on 12 March 2027 containing a
   continuous 10 km segment covered in 44:41, **When** that run is ingested, **Then** the goal is
   marked achieved on 12 March 2027, shows the 44:41 effort with a link to the run, and moves to
   the achieved list with a celebratory treatment.
2. **Given** an active goal "5k under 20:00" and the owner's latest Garmin 5k prediction entry is
   20:47 as of 1 March 2027, **When** a visitor views the goal, **Then** they see the target
   (20:00), Alexander's fastest recorded 5k effort, and "Garmin predicted 20:47 (as of 1 Mar 2027)"
   as a progress indicator.
3. **Given** a goal "Body fat 17.5%" with a starting value of 26.0%, **When** the 7-day average body
   fat is 22.0%, **Then** progress is shown as roughly 47% of the way from 26.0% to 17.5%.
4. **Given** the owner edits the Brighton goal's target from 3:30:00 to 3:20:00, **When** the site
   updates, **Then** only the current target (3:20:00) is displayed everywhere.
5. **Given** a goal has a deadline that has passed without being achieved, **When** a visitor views
   it, **Then** it is shown as "deadline passed" until the owner revises the deadline or retires the
   goal; retired goals are no longer displayed.
6. **Given** an achieved goal, **When** a later effort or reading is worse than the target (e.g.
   weight rises back above 93 kg), **Then** the goal remains achieved with its original date.
7. **Given** the owner adds a goal with a malformed target (e.g. a time of "3:7x"), **When** the site
   is built, **Then** the build is stopped before going live with a message identifying the goal
   and the problem, and the live site is unaffected.

---

### User Story 3 - Training stats and run detail (Priority: P2)

A fellow runner or curious friend explores Alexander's training: totals and trends by week, month
and year (distance, time, number of runs, average pace, elevation), a browsable list of every run,
and a detail page for each run with the full Garmin detail — distance, time, pace, elevation, average
and maximum heart rate, per-km splits, heart-rate zone breakdown, cadence, stride length, power,
running dynamics, and charts of pace, heart rate, elevation and other measures over the course of
the run. For privacy, training runs show the date but not the start time, and never show a map or
location.

**Why this priority**: Training detail is what makes the site data-rich and credible to fellow
runners, and it powers the training-build view on the landing page — but the landing page and goals
deliver the core story without it.

**Independent Test**: With a full backfill of Garmin history stored, browse weekly/monthly/yearly
totals, open any training run, and confirm all available detail appears as charts and figures while
no start time, map, or location name appears anywhere on the page.

**Acceptance Scenarios**:

1. **Given** a backfilled history, **When** a visitor opens the training page, **Then** they see
   charts of weekly, monthly and yearly distance and time, with figures for run count, average pace
   and elevation gain, and can switch between those periods.
2. **Given** a training run recorded with a heart-rate strap and running dynamics, **When** a visitor
   opens its detail page, **Then** they see distance, moving and elapsed time, average pace,
   elevation gain/loss, average and max heart rate, a per-km splits table, heart-rate zone
   breakdown, cadence, stride length, power, ground contact time, vertical oscillation and vertical
   ratio, and time-series charts using elapsed time or distance (never time of day) on the
   horizontal axis.
3. **Given** a training run started at 06:42 from near home, **When** a visitor views it anywhere on
   the site, **Then** only its date is shown — no start time, no map, no route, no place name.
4. **Given** a run recorded without power or running-dynamics data, **When** a visitor opens its
   detail page, **Then** those panels are omitted cleanly rather than shown empty or as zeros.
5. **Given** several years of runs, **When** a visitor browses the run list, **Then** runs are listed
   newest first, grouped by month, each showing date, title, distance, time and pace, with races
   clearly badged, and every run back to the earliest record is reachable.
6. **Given** a treadmill run, **When** a visitor sees it in the run list, the totals or its detail
   page, **Then** it is counted in the totals, carries a "Treadmill" label, and has no map.

---

### User Story 4 - Races and personal bests (Priority: P2)

A visitor looks at Alexander's racing: a history of race results, a personal-best table for each
standard distance, a list of upcoming races (with the Brighton countdown), and a page for each race
showing the result, the route map, the full run detail, and any photos Alexander has added. Race
history includes every recorded run Alexander has designated a race (Garmin sync does not set
intervals.icu's race marker, so designation is his, FR-050) plus older races he enters by hand.

**Why this priority**: Races and PBs are the milestones friends and sponsors most want to see, and
the PB table is the natural companion to race-time goals. It builds on the run data from Story 3.

**Independent Test**: With Garmin history plus two manually entered pre-Garmin races, confirm the
race history lists all races, the PB table shows the best time per distance (including manual
entries), upcoming races show countdowns, and a race detail page shows its map and photos.

**Acceptance Scenarios**:

1. **Given** Garmin-recorded runs the owner has designated as races and two older races entered by
   hand, **When** a visitor opens the races page, **Then** all races appear newest first with date,
   name, distance and finish time, and hand-entered races are included alongside Garmin-recorded
   ones.
2. **Given** race results at 5k, 10k and half marathon, **When** a visitor views the PB table,
   **Then** each standard distance shows the fastest race time with its date and race name, plus
   the fastest effort at that distance from any run where that is faster.
3. **Given** the owner has recorded an official chip time of 1:41:07 for a race Garmin timed at
   1:41:15, **When** a visitor views that race, **Then** the official time (1:41:07) is shown as the
   result and used for PBs.
4. **Given** a race recorded by Garmin with GPS, **When** a visitor opens its detail page, **Then**
   they see an interactive route map along with the full run detail described in Story 3.
5. **Given** the owner has added three photos with descriptions to a race, **When** a visitor opens
   that race, **Then** the photos appear in a gallery, each with its description available as
   alternative text, and none of the published photo files carry embedded location data.
6. **Given** Brighton Marathon and one other upcoming race are entered, **When** a visitor views
   upcoming races, **Then** each shows its date, distance, days remaining and target time (if set),
   in date order.
7. **Given** a new personal best is set, **When** the site updates, **Then** the PB table and race
   history reflect it, and the new PB is highlighted as recent.

---

### User Story 5 - Health and performance metrics (Priority: P3)

A visitor explores how Alexander's fitness and body are changing: VO2 max; fitness, fatigue and
form (intervals.icu's training-load model, labelled as such); his Garmin training status and race
predictions (5k, 10k, half marathon, marathon), which he enters by hand and which are shown "as
of" the date he recorded them; resting heart rate and HRV trends; and body composition — weight shown as a smoothed 7-day average and body
fat % as recorded — each with its target. When Alexander has a professional DEXA scan or lab VO2
max test, the result is shown as a clearly labelled reference point alongside the Garmin estimates,
so visitors can see how close the device was to the lab.

**Why this priority**: These trends add depth and credibility, and lab-vs-device comparisons are
genuinely interesting to fellow runners — but the current values needed by goals can be shown on the
goals and landing pages before the full trends page exists.

**Independent Test**: With stored health history and one lab reference entry, open the health page
and confirm each approved metric shows a trend chart with its current value and target, the lab
point is visibly distinct and labelled, and no sleep, stress or Body Battery data appears anywhere.

**Acceptance Scenarios**:

1. **Given** a year of VO2 max and fitness/fatigue history, plus several dated owner entries of
   training status and race predictions, **When** a visitor opens the health page, **Then** each is
   shown as a trend chart with the current value; training status and race predictions show the
   latest entry "as of" its date, and the race predictions show all four distances; fitness and
   fatigue are labelled as intervals.icu's model, not Garmin's.
2. **Given** daily scale readings of 101.2, 100.6, 101.0, 100.4, 100.8, 100.2 and 100.5 kg over the
   last 7 days, **When** a visitor views the weight chart, **Then** it shows the smoothed 7-day
   average (100.7 kg) and its trend, never the individual daily readings.
3. **Given** body fat readings from the scale, **When** a visitor views the body fat chart, **Then**
   individual readings are shown as recorded, with the 17.5% target marked.
4. **Given** the owner enters a lab VO2 max of 51.0 on a date when Garmin's estimate was 54, **When**
   a visitor views the VO2 max chart, **Then** the lab result appears as a distinct, labelled
   marker ("Lab test") and a comparison states the device estimate, the lab value and the
   difference.
5. **Given** two DEXA scans a year apart, **When** a visitor views the body fat chart, **Then** both
   appear as separate labelled reference points alongside the scale readings.
6. **Given** sleep, stress and Body Battery data exist in Garmin Connect, **When** any page of the
   site is viewed, **Then** none of that data appears.
7. **Given** HRV is only available from a certain date (device capability), **When** a visitor
   views the HRV chart, **Then** it starts from that date with a short note, rather than showing
   gaps as zeros.

---

### Edge Cases

- **intervals.icu unavailable or API key rejected**: pages
  keep rendering from the last stored data; every data view shows its "last updated" time; a
  staleness notice appears once data is more than 12 hours old; the owner is alerted (see FR-010)
  and told what action is needed (e.g. replacing the API key).
- **No runs this week / long break (injury, illness)**: the this-week snapshot shows zero cleanly
  with last week for comparison; trends show the gap honestly rather than interpolating.
- **GPS glitch producing an impossible effort** (e.g. a 5k in 9 minutes): efforts faster than
  plausible human limits are not counted toward goals or PBs; the owner can also exclude any run or
  reading from records and goals.
- **Treadmill / indoor runs**: their distance is estimated, so by default they count toward totals,
  the training build and the run list (labelled "Treadmill", never with a map) but not toward PBs
  or race-time goal achievement; the owner can mark a specific one as eligible.
- **Stale manual Garmin figures**: training status and race predictions are only as fresh as the
  owner's last entry; they always show their "as of" date, and with no entry yet they show "not
  recorded yet" rather than a value.
- **Bad scale reading** (e.g. someone else steps on the scale): the owner can exclude that reading;
  excluded readings are removed from averages and goals.
- **Gaps in scale readings**: the 7-day average uses the readings available in the trailing 7 days;
  if there are none, the chart shows a gap rather than carrying a value forward.
- **A run is edited or deleted (in Garmin Connect or intervals.icu) after being stored**: changes to
  recent runs that reach intervals.icu are picked up automatically; the owner can hide any run or
  ask for a specific period to be re-imported.
- **A race recorded with warm-up/cool-down in the same activity, or starting near home**: the owner
  can hide the map for a specific race and/or supply the official time and distance.
- **Brighton race day and after**: on race day the hero shows "Race day"; after the race, the hero
  shows the result once recorded (or "result coming soon"), and the owner can switch the featured
  focus race to the next target via the site's files.
- **Target revised after it was already achieved**: an achieved goal stays achieved; a tighter
  target is added as a new goal.
- **A goal references a metric with no data yet** (e.g. VO2 max before first estimate): the goal
  shows its target with "no data yet" rather than a misleading 0% progress.
- **Metric not recorded by the device for a run** (no power, no HR): those panels are omitted.
- **Invalid hand-entered data** (bad date, unknown distance, missing photo description): the build
  stops before going live with a clear message identifying the file and field; the live site is
  unaffected.
- **Duplicate race**: a race present both in Garmin and as a hand entry is shown once, with the
  owner's details (official time, name) taking precedence.
- **Very large history** (thousands of runs): the run list and totals remain fast to load and browse.

## Requirements *(mandatory)*

### Functional Requirements

#### Section-wide: data, freshness and degradation

- **FR-001**: The section MUST present data from the site's own stored copy only; no page view may
  depend on intervals.icu, Garmin (or any third party) being reachable.
- **FR-002**: The stored data MUST be refreshed from intervals.icu (which receives the owner's
  Garmin data through Garmin's official sync) automatically at least every 3 hours, fetching only
  what is new or changed since the last successful refresh. intervals.icu is the only provider the
  refresh reads.
- **FR-003**: The owner MUST be able to trigger an immediate "refresh now" without logging in to the
  site (e.g. through the site's code-hosting controls), with results visible within 30 minutes.
- **FR-004**: The section MUST be backfilled with the owner's entire Garmin running and approved
  health history — loaded into intervals.icu from the owner's Garmin data export — and MUST retain
  all history thereafter even if older data later becomes unavailable from intervals.icu or Garmin.
- **FR-005**: Every data-driven view MUST display when its data was last successfully updated.
- **FR-006**: When the last successful refresh is more than 12 hours old, data views MUST show a
  gentle notice that figures may be out of date, while still showing the last known data.
- **FR-007**: A failed, partial or rate-limited refresh MUST NOT remove, corrupt or blank any
  previously stored data, and MUST NOT prevent the site from building or being served.
- **FR-008**: Changes to runs from the last 14 days, as they appear in intervals.icu (whether made
  there or synced from Garmin Connect), MUST be reflected on the next refresh; the owner MUST be
  able to request re-import of an older period.
- **FR-009**: Only running activities (road, track, trail, treadmill/indoor) are in scope; other
  activity types (cycling, walking, strength, etc.) MUST NOT be displayed or counted.
- **FR-010**: The owner MUST be alerted (without having to check the site) when refreshes have been
  failing for more than 24 hours, with a description of the likely cause and the action needed.

#### Privacy

- **FR-011**: Training runs MUST show their date but never their start time, time of day, map, route,
  start/end coordinates, or location-derived names (e.g. Garmin's default town-based titles). Their
  GPS tracks and free-text activity names and descriptions MUST be dropped before publication.
- **FR-012**: Training runs MUST be titled from neutral information (e.g. date and run type, such as
  "Easy run · 8.2 km") unless the owner supplies a custom title.
- **FR-013**: Time-series charts on any run MUST use elapsed time or distance on the horizontal axis,
  never clock time.
- **FR-014**: GPS route maps MUST appear only on race pages, and the owner MUST be able to hide the
  map for any individual race.
- **FR-015**: Sleep, stress, Body Battery, and any other Garmin data category not explicitly listed
  in this specification MUST NOT be stored for publication or displayed. Sleep, steps and SpO2
  wellness records, which intervals.icu supplies alongside approved metrics, MUST NOT be ingested
  at all. Activity streams and FIT files archived privately may contain in-activity respiration or
  SpO2 readings; these MUST never be published (the privacy scan covers published data).
- **FR-016**: Published photos MUST have embedded location and device metadata removed.
- **FR-017**: Data excluded for privacy MUST be excluded before it reaches anything that is
  published, so that it cannot be recovered from the site or its public files.

#### Landing page (Story 1)

- **FR-020**: The landing page MUST lead with a focus race hero, initially Brighton Marathon
  (4 April 2027, for Martlets hospice), showing: race name and date, days remaining, the current
  target time, the latest owner-entered Garmin prediction for that distance with its "as of" date,
  and the charity being supported.
- **FR-021**: The hero MUST show the training build towards the focus race: weekly distance since
  the owner-defined start of the build, and the longest run in the build so far.
- **FR-022**: The landing page MUST show the owner's featured goals (up to the owner's featured-goal limit, 6 by default) in priority order, each
  with target, current value, progress indicator and, where set, time remaining to its deadline.
- **FR-023**: The landing page MUST show a this-week snapshot (Monday–Sunday): run count, distance and
  time, comparison with the previous week, and a summary card for the most recent run linking to
  its detail page.
- **FR-024**: The landing page MUST provide a clearly visible link to the owner's personal story page
  when that page exists, and MUST show no link or placeholder until it does.
- **FR-025**: The landing page layout MUST leave a place in or beside the hero for a future
  fundraising element; until that feature exists, nothing is shown there.
- **FR-026**: The focus race MUST be changeable by the owner via the site's files (e.g. after
  Brighton) without changes elsewhere.
- **FR-027**: The landing page MUST link to each of the section's other areas: Goals, Training,
  Races & PBs, and Health & Performance.

#### Goals (Story 2)

- **FR-030**: The owner MUST be able to add, edit, reorder, revise, and retire goals by editing the
  site's files; no login or admin screen is involved.
- **FR-031**: The system MUST support these goal types:
  - **Race-time**: a distance and a target time (e.g. 10 km under 45:00).
  - **Body composition**: a target weight or body fat %.
  - **Performance metric**: a target for VO2 max, resting heart rate or HRV, including direction
    (at least / at most). This is a closed list: intervals.icu's fitness/fatigue and the manual
    Garmin figures (training status, race predictions) are not goal targets.
  - **Milestone**: a free-text goal the owner marks as achieved by hand (e.g. "Finish a trail
    ultra").
- **FR-032**: Each goal MUST support a title, an optional description, an optional deadline, an
  optional link to an upcoming race, a priority order, a featured flag (for the landing page), and
  an optional starting value used to show progress.
- **FR-033**: A race-time goal MUST be achieved by the first recorded effort, in any run or race, in
  which a continuous segment of the goal distance was covered in under the target time; the
  achievement date is the date of that run.
- **FR-034**: A weight or body fat goal MUST be achieved when the 7-day average of readings first
  reaches the target; a performance-metric goal when the metric first reaches the target.
- **FR-035**: Manually entered race results MUST count toward race-time goals.
- **FR-036**: The owner MUST be able to mark any goal achieved by hand (with date and optional note)
  and to override an automatic achievement.
- **FR-037**: Achieved goals MUST stay achieved with their original date and achieving effort or
  reading, even if later values regress, and MUST be shown in a celebratory "achieved" list,
  newest first.
- **FR-038**: For race-time goals at 5k, 10k, half marathon and marathon, the goal MUST show the
  latest owner-entered Garmin race prediction for that distance, with its "as of" date (FR-069),
  alongside the fastest recorded effort.
- **FR-039**: Progress MUST be shown visually: for time goals, the gap between the fastest effort and
  the target; for body composition and metric goals, the proportion of the distance travelled from
  the starting value to the target.
- **FR-040**: When a goal's target is revised, the site MUST show only the current target; earlier
  targets are kept in the record's history but not displayed.
- **FR-041**: A goal whose deadline has passed unachieved MUST be shown as "deadline passed" until the
  owner revises or retires it; retired goals MUST NOT be displayed.
- **FR-042**: Newly achieved goals SHOULD be highlighted on the landing page for 14 days.

#### Training stats and run detail (Story 3)

- **FR-045**: The section MUST show totals and trends of distance, moving time, run count, average
  pace and elevation gain, by week, month and year, plus all-time totals, as charts with supporting
  figures.
- **FR-046**: The section MUST provide a browsable list of every stored run, newest first, grouped by
  month, showing date, title, distance, time and pace, with races badged; it MUST be possible to
  show only races.
- **FR-047**: Each run MUST have a detail page showing, where recorded: distance; moving and elapsed
  time; average and best pace; elevation gain and loss; average and maximum heart rate; per-km
  splits; heart-rate zone breakdown; cadence; stride length; power; running dynamics (ground contact
  time, ground contact balance, vertical oscillation, vertical ratio); training effect (where the
  provider supplies it); and charts of pace, heart rate, elevation, cadence and power across the
  run.
- **FR-048**: Metrics not recorded for a run MUST be omitted from its page rather than shown as empty
  or zero.
- **FR-049**: The owner MUST be able, via the site's files, to give any run a custom title and short
  note, hide a run entirely, and exclude a run from records and goals.

#### Races and PBs (Story 4)

- **FR-050**: A run MUST be treated as a race when it is marked as a race in intervals.icu or the
  owner designates it as one (Garmin sync does not currently set intervals.icu's race marker, so in
  practice races come from owner designation); the owner MUST also be able to un-designate a run.
- **FR-051**: The owner MUST be able to add, via the site's files, race details to any race (official
  name, official finish time, official distance, position, link to official results, short note),
  and to add races that were never recorded in Garmin (date, name, distance, finish time, optional
  details). Official times MUST take precedence over device times.
- **FR-052**: The section MUST show a race history, newest first, combining Garmin-recorded and
  hand-entered races, each linking to its detail page, with each race appearing only once.
- **FR-053**: The section MUST show a personal-best table for standard distances (5k, 10k, half
  marathon, marathon, and any other distance the owner has raced), showing for each the fastest race
  result (time, date, race) and, where faster, the fastest effort at that distance from any run.
- **FR-054**: Race detail pages MUST show the result, an interactive route map (unless hidden by the
  owner or not recorded), the full run detail where available, and any race photos.
- **FR-055**: The owner MUST be able to add photos to a race via the site's files; each photo MUST
  have a text description used as its alternative text. Photos are supported on race pages only.
- **FR-056**: The section MUST show upcoming races entered by the owner (name, date, distance, optional
  target time and link), in date order, each with days remaining; the focus race (Brighton) is
  shown first.
- **FR-057**: Efforts faster than plausible human performance for the distance, and efforts from
  indoor/treadmill runs (unless the owner marks them eligible), MUST NOT count toward PBs or
  race-time goals.
- **FR-058**: Treadmill runs MUST count toward totals, the training build, the this-week snapshot
  and the run list; MUST carry a visible "Treadmill" label wherever the run is shown; and MUST
  never show a map or appear in a race track.

#### Health and performance (Story 5)

- **FR-060**: The section MUST show trend charts and current values for: VO2 max; fitness, fatigue
  and form (intervals.icu's training-load model: fitness = CTL, fatigue = ATL, form = fitness minus
  fatigue), labelled as intervals.icu's model rather than Garmin's; Garmin training status and
  Garmin race predictions (5k, 10k, half marathon, marathon) from the owner's dated entries
  (FR-069); resting heart rate; HRV (with its baseline range where available).
- **FR-061**: Weight MUST be shown only as a 7-day moving average (trend chart and current value),
  never as individual daily readings.
- **FR-062**: Body fat % MUST be shown as recorded values, with a trend line.
- **FR-063**: Where a goal exists for a displayed metric, its chart MUST mark the target.
- **FR-064**: The owner MUST be able to add lab reference measurements via the site's files — date,
  type (e.g. DEXA scan, lab VO2 max test), provider, and measured values for metrics the section
  already displays (body fat %, weight, VO2 max) — and any number of them over time.
- **FR-065**: Lab reference measurements MUST be shown on the matching charts as visually distinct,
  labelled markers, accompanied by a comparison of the lab value against the Garmin value nearest in
  time (within 7 days), including the difference.
- **FR-066**: Lab results for measures the section does not already display (e.g. bone density, lean
  mass by region) MUST NOT be published unless the owner explicitly approves that category.
- **FR-067**: The owner MUST be able to exclude an individual scale or metric reading as erroneous.
- **FR-068**: Charts MUST allow choosing a time range (at least: 3 months, 1 year, all time).
- **FR-069**: Garmin training status and Garmin race predictions, which the provider does not
  supply, MUST be owner-entered via the site's files as dated entries, updated whenever the owner
  likes; every display of them MUST show the entry's "as of" date, and earlier entries form their
  trend.

#### Owner-entered data and quality bars

- **FR-070**: All owner-entered data (goals, races, upcoming races, photos, lab measurements,
  manual Garmin figures, overrides) MUST be checked before the site goes live; a problem MUST stop the update with a
  message identifying the file, entry and field, leaving the live site unchanged.
- **FR-071**: Every chart MUST have a text alternative conveying its key message, and its underlying
  data MUST be available in an accessible form (e.g. a table), operable by keyboard.
- **FR-072**: Every page MUST have a unique, meaningful title and description and a share-preview
  image; the landing page's preview SHOULD reflect current content (e.g. days to Brighton).
- **FR-073**: Every page MUST be designed for phones first and remain fully usable from 320 px wide
  up to desktop.
- **FR-074**: All key figures and text alternatives MUST remain available if interactive
  enhancements (e.g. chart interactivity, maps) fail to load.
- **FR-075**: Units MUST be metric: kilometres, minutes per kilometre, kilograms, metres of
  elevation; times as h:mm:ss; dates in UK format (e.g. 4 Apr 2027); and periods (weeks, days)
  calculated in UK local time with weeks starting Monday.
- **FR-076**: The section MUST be self-contained: it owns its own pages and data, and shares only the
  site-wide layout, design system and storage; adding or removing it MUST NOT require changes to
  other sections.
- **FR-077**: Every view showing Garmin-sourced data (runs, health readings, and the owner's manual
  Garmin figures) MUST show Garmin attribution following Garmin's brand guidelines — a condition of
  the intervals.icu API terms (effective 2025-10-23). A "view" is a page, chart, tile or card that
  shows Garmin-sourced data; whether attribution sits once per page or next to each chart, tile or
  card follows Garmin's brand guidelines, which are re-read before it is built.

### Key Entities

- **Run**: a single running activity — date (no public start time), type (road/track/trail/indoor),
  treadmill marker, distance, times, pace, elevation, heart rate, cadence, stride, power, running
  dynamics, training effect (where supplied), title, owner note, flags (hidden, excluded from
  records, treadmill included in records, is-race). Source: Garmin, via intervals.icu.
- **Run Recording**: the second-by-second measures across a run (pace, heart rate, elevation,
  cadence, power, and — for races only — position), plus per-km splits and heart-rate zone times.
- **Best Effort**: the fastest continuous segment of a standard or goal distance within a run;
  links to its run; used for goals and the PB table.
- **Race**: a run designated as a race, or a hand-entered historical result — name, date, distance,
  official time, position, results link, note, map visibility, photos.
- **Upcoming Race**: an owner-entered future event — name, date, distance, target time, link;
  one may be the focus race (initially Brighton Marathon, for Martlets hospice, with build start date).
- **Race Photo**: an owner-added image attached to a race, with a required description.
- **Personal Best**: per standard distance, the fastest race result and the fastest effort.
- **Goal**: type, title, target (and direction), optional deadline, optional linked race, priority,
  featured flag, starting value, status (active, achieved, deadline passed, retired), achievement
  (date, achieving effort/reading/manual note).
- **Health Reading**: a dated value of an approved metric from intervals.icu — VO2 max, fitness
  (CTL), fatigue (ATL), resting heart rate, HRV, weight, body fat % — with an excluded flag.
- **Manual Garmin Figure**: an owner-entered, dated ("as of") Garmin training status or set of race
  predictions (5k, 10k, half marathon, marathon); the latest entry is current, earlier ones are its
  history.
- **Lab Reference Measurement**: date, type (DEXA, lab VO2 max, …), provider, measured values for
  displayed metrics; compared to the nearest Garmin reading.
- **Refresh Record**: when data was last successfully refreshed from each source (intervals.icu), and any failure
  details, used for "last updated", staleness notices and owner alerts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a test with at least 5 people unfamiliar with the site, each using a phone, at least
  4 can state within 15 seconds of opening the landing page: days to Brighton, the current target
  time, and whether Alexander is closer to or further from his weight goal than at the start.
- **SC-002**: A run synced from Garmin to intervals.icu appears on the site within 3 hours in at
  least 95% of cases over a month, and within 30 minutes of the owner triggering "refresh now".
- **SC-003**: With intervals.icu access deliberately broken for 7 days, 100% of pages still load with their
  last known data, every data view shows its last-updated time, and no site update fails because
  of it.
- **SC-004**: An automated check across every published page finds zero training-run start times,
  zero training-run maps or coordinates, zero free-text training-run names or descriptions from
  the provider, zero sleep/stress/Body Battery/steps/SpO2 values, and zero photos carrying
  location metadata.
- **SC-005**: When a qualifying effort is recorded, the matching goal is shown as achieved with the
  correct date at the next refresh, in 100% of test cases (including efforts inside longer runs and
  hand-entered races).
- **SC-006**: Every page scores at least 90 for performance on a standard mobile page-quality audit
  (simulated mid-range phone, mobile network), and the landing page's main content is visible
  within 2.5 seconds under those conditions.
- **SC-007**: Every page passes a WCAG 2.2 AA audit (automated plus manual keyboard and
  screen-reader check of each chart type) with zero violations.
- **SC-008**: Every page, shared in common messaging and social apps, shows a preview with its own
  title, description and image.
- **SC-009**: The full backfill covers 100% of running activities and approved health history
  present in intervals.icu at the time of the backfill (after the owner's Garmin export has been
  imported into it), and spot-checks of 20 random runs match intervals.icu's distance, time and
  heart-rate figures.
- **SC-010**: The owner can add a new goal, race result, photo or lab measurement by editing files and
  see it live within one site update, with any mistake caught before going live 100% of the time.
- **SC-011**: The run list and training totals remain quick to browse (each page's main content
  visible within 2.5 seconds per SC-006) with 5,000 stored runs.
- **SC-012**: The owner is alerted within 24 hours of refreshes starting to fail, without having to
  look for it.

## Assumptions

- **Audience & tone**: visitors are friends, family, sponsors and fellow runners; the section is warm
  and personal, visual-first, with short supporting text.
- **Section home vs site home**: this spec defines the Running section's landing page; until other
  sections exist the site's front door may lead straight to it — that is a site-level decision, not
  part of this spec.
- **Story link**: hidden (no placeholder) until the personal story page — a separate future spec —
  exists, so visitors never hit a dead end; it then appears prominently.
- **Fundraising**: entirely out of scope (its own next spec, via JustGiving); this spec only reserves
  space beside the Brighton hero. "For Martlets hospice" is shown as plain text.
- **Goal revisions**: only the current target is displayed; prior targets are kept in the files'
  history for a possible future journey view. A tightened target after achievement is a new goal.
- **Goal achievement**: race-time goals are achieved by any qualifying effort (per owner), including
  continuous segments inside longer runs and hand-entered races. Weight and body fat goals use the
  7-day average to avoid a single noisy reading triggering achievement.
- **Personal bests**: the PB table leads with race results (the conventional meaning of a PB) and
  also shows the fastest any-run effort where it is faster, consistent with the goals rule.
- **Indoor/treadmill runs** (owner decision 2026-10-17): count toward totals, the training build and
  the run list, labelled "Treadmill", never with a map; not PBs or race-time goals by default
  because their distance is estimated, unless the owner marks a run eligible. "Count toward goals"
  is read as distance/training goals; race-time goal achievement follows PB eligibility.
- **Data provider** (owner decision 2026-10-17): intervals.icu, an official Garmin sync partner,
  read with a personal API key. Garmin Connect directly is reconsidered only if intervals.icu
  cannot supply something required.
- **History**: the owner's Garmin data export is imported into intervals.icu (*Settings → Import
  all Garmin data*), so full history arrives through the same provider; pre-Garmin races remain
  manual entries.
- **Manual Garmin figures**: Garmin training status and race predictions are not available from
  intervals.icu, so the owner enters them (dated) whenever he likes; they are shown "as of" their
  date.
- **Training load**: intervals.icu's fitness/fatigue/form model replaces Garmin's training load,
  and is labelled as intervals.icu's.
- **Attribution**: Garmin attribution on Garmin-sourced views is a condition of the intervals.icu
  API terms; exact wording/marks follow Garmin's brand guidelines at implementation time.
- **Implausible efforts**: a sanity threshold excludes GPS-glitch efforts; exact thresholds are a
  planning detail.
- **Training-run titles**: Garmin's default titles often contain a town name, so training runs use
  neutral generated titles unless the owner sets one. Race titles may name the race and location.
- **Run detail fields**: "full Garmin detail" is taken to include training effect where the
  provider supplies it (intervals.icu's API does not currently expose it, so the panel is omitted
  per FR-048); anything else offered per run that is not listed in FR-047 is added only with the
  owner's agreement.
- **Body fat starting values / goal baselines**: if no starting value is given, the first reading on
  or after the goal's creation date is used.
- **Lab measurements**: only values for metrics already displayed (body fat %, weight, VO2 max) are
  published; recalibrating Garmin afterwards is something the owner does in Garmin, outside the site.
- **Units & locale**: metric units, UK date format, UK local time, weeks starting Monday.
- **Stale threshold**: 12 hours (four missed scheduled refreshes) before a staleness notice shows.
- **Brighton Marathon**: 4 April 2027, initial target sub-3:30 (may tighten towards sub-3:20); the
  build start date is set by the owner.
- **Initial goals** (owner to confirm values in the site's files): Brighton sub-3:30; 10k under 45:00;
  5k under 20:00; body fat 17.5%; weight 93 kg; a VO2 max target (value to be set by the owner).
- **No accounts**: all owner editing happens through the site's files and code-hosting controls.

### Out of scope

- Fundraising totals, donation links and the JustGiving integration (next spec).
- The personal journey/story page and educational/motivational videos (future spec).
- Photos for training runs.
- Race reports or other AI-drafted written content (governed by the authentic-voice principle and
  a future spec).
- Training plans or planned workouts, and comparison of actual training against a plan.
- Sleep, stress, Body Battery and any other unapproved Garmin data.
- Non-running activities.

### Dependencies

- Ongoing access to the owner's intervals.icu account (personal API key), with Garmin's official
  sync into it running; any provider can fail or change, so the resilience requirements (FR-001,
  FR-007, FR-010) still apply.
- The owner's Garmin data export, imported into intervals.icu, for history before intervals.icu's
  own sync window.
- The site-wide layout and design system (shared plumbing), built alongside or before this section.
- The owner supplying initial goal values, the Brighton build start date, historical race entries,
  race photos with descriptions, Garmin training status and race prediction entries, and (later)
  lab measurement results.
