# Feature Specification: Fundraising

**Feature Branch**: `002-fundraising`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Fundraising for the Running section of alexanderwebber.com: Alexander
is running the Brighton Marathon on 4 Apr 2027 for Martlets (a hospice in Brighton & Hove),
fundraising on JustGiving. The site shows the amount raised against the page's target as a progress
bar, with the number of supporters, on a landing-page card beside the Brighton hero and on its own
page in the Running menu, with a Donate button linking to JustGiving. The page carries an
AI-drafted, owner-approved 'why I'm running for Martlets' story, charts the total over time, and
lists past campaigns, so a future charity run needs no rework. Figures refresh with the existing
scheduled refresh, show when they were last updated, and fall back to the last known figures. No
donor names, messages, individual amounts or Gift Aid." (Full owner answers gathered in three
question rounds on 2026-10-25 and 2026-10-26.)

## Overview

Alexander is running the **Brighton Marathon on 4 April 2027** for **Martlets**, the hospice in
Brighton & Hove, and is raising money for them on **JustGiving**. The Running section (spec 001)
already leads with Brighton and reserves a place beside the Brighton hero for fundraising, which
shows nothing until this feature fills it.

This feature lets visitors (friends, family, sponsors, fellow runners) see at a glance how much has
been raised and how close it is to the target, read why Alexander chose Martlets, and get to the
JustGiving page to donate in one tap. Donating itself always happens on JustGiving; the site never
handles money.

The figures follow the Running section's rules: the site keeps its own copy, refreshed with the
existing scheduled refresh, so no page depends on JustGiving being available; every view says when
its figures were last updated; and if JustGiving can't be read, the last known figures stay up. The
site keeps the total at each change, so it can chart the fundraising over time.

A fundraiser is a **campaign** linked to a race. Brighton is the first. After race day the
campaign stays on the site as a record, and later charity runs are added as new campaigns without
rework.

The fundraising target is set on the JustGiving page only, and the site reads it from there, so it
is changed in one place. It is not one of Alexander's goals: it doesn't appear on the Goals page or
count towards the featured goals, though its card looks like the goal cards.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fundraising card on the landing page (Priority: P1)

A friend or sponsor opens the Running section and, right beside the Brighton hero, sees how the
fundraising for Martlets is going: the amount raised against the target as a progress bar, the
number of supporters, when the figures were last updated, and a Donate button that takes them
straight to Alexander's JustGiving page.

**Why this priority**: The landing page is where most visitors arrive, and a visible total with a
one-tap Donate button is what turns interest into donations. On its own, with nothing else from
this feature, it delivers the core value: people can see the cause and give.

**Independent Test**: Configure a campaign for Brighton pointing at a JustGiving page with a target
and some donations, refresh, and open the landing page on a phone: the card shows the total, the
target, the bar, the supporter count, the last-updated time and a working Donate button, beside or
directly below the hero's headline facts. Remove the campaign and confirm nothing appears in its
place.

**Acceptance Scenarios**:

1. **Given** a Brighton campaign whose JustGiving page shows £1,250 raised of a £2,000 target from
   37 supporters, **When** a visitor opens the landing page, **Then** the fundraising card shows
   "£1,250 raised of £2,000", a progress bar at 62%, "37 supporters", "For Martlets", when the
   figures were last updated, and a Donate button.
2. **Given** that card, **When** the visitor taps Donate, **Then** they arrive at Alexander's
   JustGiving page for the campaign, where they can donate.
3. **Given** no campaign has been configured yet (the JustGiving page doesn't exist yet), **When** a
   visitor opens the landing page, **Then** nothing is shown in the fundraising place: no empty
   card, no "coming soon", and the hero looks as it does today.
4. **Given** the owner raises the target on the JustGiving page from £2,000 to £3,000, **When** the
   site next refreshes, **Then** the card shows the new target, with no change to the site's files.
5. **Given** someone donates on JustGiving, **When** the next scheduled refresh has run (within
   about 2 hours), **Then** the card shows the new total and supporter count and a later
   last-updated time.
6. **Given** JustGiving could not be read for the last 2 days, **When** a visitor opens the landing
   page, **Then** the card still shows the last known total, target and supporters, with when they
   were last updated and a notice that the figures may be out of date, and Donate still works.
7. **Given** the total has passed the target (£2,160 of £2,000), **When** a visitor views the card,
   **Then** the bar is full and the card celebrates it (e.g. "Target beaten: 108%") rather than
   showing a bar past its end.
8. **Given** the Goals page and the featured goals on the landing page, **When** a campaign is
   shown, **Then** the fundraising target appears on neither and doesn't change how many goals
   are featured.

---

### User Story 2 - The fundraising page (Priority: P2)

A visitor follows "Fundraising" in the Running menu (or the card) to the fundraising page. It leads
with the current campaign: the race and charity, the total against the target as a progress bar,
the number of supporters, when the figures were last updated and a Donate button. Below, a chart
shows how the total has grown over time, and a list shows any past campaigns with their final
totals.

**Why this priority**: The page gives the fundraising a permanent home that can be linked and
shared, and shows momentum over time. The landing card already gives the essentials, so the page
comes second.

**Independent Test**: With a configured campaign and several weeks of stored totals, open
`/running/fundraising/` on a phone and a desktop: the current campaign's figures, Donate button and
last-updated time are shown, the chart of the total over time matches the stored history (with an
accessible table of the same data), and a synthetic past campaign is listed with its final total.

**Acceptance Scenarios**:

1. **Given** a Brighton campaign with stored totals since 10 November 2026, **When** a visitor opens
   the fundraising page, **Then** they see "Brighton Marathon · 4 April 2027", "For Martlets", the
   total against the target with a progress bar, the supporter count, the last-updated time, a
   Donate button, and a chart of the total from 10 November 2026 to today with the target marked.
2. **Given** the chart, **When** a visitor uses a keyboard or screen reader, **Then** a text
   summary states the key message (e.g. "£1,250 raised since 10 Nov 2026, 62% of the £2,000
   target") and the underlying figures are available as a table.
3. **Given** a campaign whose figures have only been read on one day so far, **When** a visitor
   opens the page, **Then** the current figures are shown without a chart (a chart appears once
   there are totals from at least two days).
4. **Given** a campaign has figures, **When** a visitor opens any Running page, **Then** "Fundraising"
   appears in the Running menu; **Given** no campaign has figures yet, **Then** neither the menu
   item nor the page exists, so no visitor reaches an empty page.
5. **Given** a past campaign (an earlier charity run whose race has passed), **When** a visitor
   views the fundraising page, **Then** the past campaign is listed below the current one with its
   race, date, charity, final total (and target) and a link to its JustGiving page.
6. **Given** the fundraising page is shared in a messaging app, **When** the preview appears,
   **Then** it has its own title, description and image.

---

### User Story 3 - Why I'm running for Martlets (Priority: P2)

A visitor reads, on the fundraising page, Alexander's own short story of why they are running for
Martlets. The text is drafted by AI from Alexander's answers to a few questions, then edited and
approved by them before it is published. The same approved text is used on the JustGiving page, so
visitors read the same story in both places. Alexander's edits to the draft start the site's living
voice style guide, so future drafted text sounds more like them.

**Why this priority**: The story is what makes people care enough to give, and the JustGiving page
needs it too, so it is drafted early (it can happen as soon as the JustGiving page is set up,
before any site work). On the site it adds to the page rather than being needed for it: figures and
Donate work without it.

**Independent Test**: Run the drafting process with a set of answers, have the owner edit and
approve the draft, and confirm: the approved text (and nothing else) appears on the fundraising
page; every factual statement in it can be traced to the owner's answers or the site's stored data;
the owner's edits are summarised in the voice style guide; and an unapproved draft placed in the
site's files stops the update before it goes live.

**Acceptance Scenarios**:

1. **Given** the owner has answered the story questions, **When** the AI drafts the story, **Then**
   every fact in the draft (who, why, dates, race, target, personal details) comes from the owner's
   answers or the site's stored data, and anything the draft would need but doesn't have is left
   as a question for the owner rather than invented.
2. **Given** a draft the owner has edited and explicitly approved, **When** the site next updates,
   **Then** the approved text appears on the fundraising page, under a heading such as "Why I'm
   running for Martlets", exactly as approved.
3. **Given** the owner's edits to the draft (e.g. shorter sentences, a less formal opening, a
   phrase they would never use), **When** the story is approved, **Then** the lessons from those
   edits are recorded in the voice style guide (`VOICE.md`), which is created by this step.
4. **Given** a story that has not been approved, **When** the site is built, **Then** it is not
   published; if it is marked for publishing without approval, the update stops with a message and
   the live site is unchanged.
5. **Given** no approved story yet, **When** a visitor opens the fundraising page, **Then** the
   page shows the figures and Donate button with no story section and no placeholder.
6. **Given** the owner later revises the story, **When** the revised text is approved, **Then** the
   site shows the new version, and the owner is reminded to update the JustGiving page to match.

---

### User Story 4 - After race day, and later campaigns (Priority: P3)

After Brighton, the fundraising stays on the site as a record. The landing card changes to "Raised
£X for Martlets" with Alexander's race result beside it, and the total keeps updating while
donations keep arriving on JustGiving. When Alexander later runs for a charity again, the owner adds
a new campaign linked to that race; it becomes the current campaign, and Brighton's moves to the
list of past campaigns with its final total.

**Why this priority**: It matters from April 2027 onwards and protects the site from rework later,
but nothing about it is visible before race day.

**Independent Test**: With a synthetic campaign whose race has passed, confirm the landing card
reads "Raised £X for Martlets" with the race result; let a further donation arrive and confirm the
total updates; mark the campaign finished and confirm it stops updating and shows "Final total"
without a staleness notice; add a second synthetic campaign for a later race and confirm it becomes
current with no change other than the site's files.

**Acceptance Scenarios**:

1. **Given** Brighton has passed and Alexander's result (3:18:42) is recorded, **When** a visitor
   opens the landing page, **Then** the fundraising card leads with "Raised £2,340 for Martlets",
   with "Brighton Marathon: 3:18:42" beside it, and still offers Donate.
2. **Given** race day has passed but donations are still arriving, **When** a donation is made on
   JustGiving, **Then** the site's total updates at the next refresh, as before race day.
3. **Given** the owner marks the Brighton campaign finished, **When** the site next updates,
   **Then** the site stops reading its figures, shows its last total as "Final total" with the date
   it was last read, shows no staleness notice for it and no Donate button.
4. **Given** the owner adds a campaign for a later race and makes that race the focus race,
   **When** the site next updates, **Then** the landing card and the top of the fundraising page
   show the new campaign (once its figures have been read), and Brighton appears under past
   campaigns with its final total, chart history kept.
5. **Given** the owner switches the focus race to a race with no campaign, **When** a visitor opens
   the landing page, **Then** nothing is shown in the fundraising place, while the fundraising page
   and its menu item remain, listing Brighton as a past campaign.

---

### Edge Cases

- **JustGiving unavailable, slow, or changing how it can be read**: pages keep rendering from the
  last stored figures with their last-updated time; a staleness notice appears once the figures
  are more than 12 hours old; the owner is alerted within 24 hours with the likely cause and the
  action needed. Running data keeps refreshing and publishing regardless.
- **JustGiving's planned change of access** (its current developer access is being moved to a new
  platform, with the old one ending on 30 June 2027, after race day): if the change breaks reading,
  the site degrades to staleness as above, never an outage, and the fix is made in the one place
  that reads JustGiving.
- **A misconfigured campaign** (e.g. a mistyped JustGiving page address): no card or page appears
  for it (there are no figures to show), and the owner is alerted that the page can't be found.
- **The JustGiving page has no target**: the card and page show the total and supporters without a
  bar or percentage, rather than a bar against nothing.
- **The total goes down** (a refunded or cancelled donation): the site shows what JustGiving
  reports, and the chart shows the drop honestly.
- **A failed or partial read** (e.g. figures missing from the response): it never replaces the last
  known figures with zeros or blanks; the last known figures stay, as with any failed refresh.
- **Target beaten**: the bar is full and the card celebrates it with the percentage; the target
  stays visible. If the owner raises the target on JustGiving, the bar follows the new target.
- **Donations after race day**: they keep counting until the owner marks the campaign finished.
- **A finished campaign**: no further reads, no staleness notice, shown as "Final total" with its
  date.
- **Race day itself**: the card stays in its pre-race form until the race result is recorded or the
  day has passed, then switches to the "Raised £X" form.
- **No race result recorded after the race**: the card shows "Raised £X for Martlets" alone, and adds
  the result once the owner records it (matching the hero's "result coming soon").
- **Charity named differently in two places**: the charity on the campaign and the charity the
  hero names for the focus race must agree; a mismatch is caught before the site goes live.
- **The story contains a statement the owner didn't supply**: it is a defect; the owner's approval
  step is where it is caught, and the drafting instructions forbid it.
- **Very long campaign history** (years of totals): the chart and its table stay quick to load
  (a total changes at most a few times a day).
- **Interactive enhancements fail**: all figures, the Donate link and the chart's text summary and
  table are still available.

## Requirements *(mandatory)*

### Functional Requirements

#### Section-wide: data, freshness and degradation

- **FR-001**: Fundraising figures MUST be presented from the site's own stored copy only; no page
  view may depend on JustGiving being reachable. The Donate button is a plain link to JustGiving
  and needs nothing from JustGiving to be shown.
- **FR-002**: The figures for each active campaign (total raised, target, supporter count) MUST be
  refreshed from JustGiving with the Running section's existing scheduled refresh (at least every 3
  hours, normally every 2), and with the owner's "refresh now" trigger, with no separate schedule
  for the owner to manage.
- **FR-003**: A failed, partial or rate-limited fundraising read MUST NOT remove, blank or zero any
  stored figures, MUST NOT stop running data from refreshing or publishing (and vice versa), and
  MUST NOT prevent the site from building or being served.
- **FR-004**: Every view of fundraising figures MUST show when they were last successfully read
  from JustGiving, separately from when the running data was last updated.
- **FR-005**: When an active campaign's figures were last read more than 12 hours ago, its views
  MUST show a gentle notice that the figures may be out of date, while still showing them.
- **FR-006**: The owner MUST be alerted (without having to check the site) when fundraising reads
  have been failing for more than 24 hours, or a configured campaign's page can't be found, with
  the likely cause and the action needed.
- **FR-007**: Only the part of the site that reads JustGiving may depend on how JustGiving provides
  its figures, so a change on JustGiving's side (including the planned move of its developer
  access, whose current platform ends on 30 June 2027) is repaired in one place and, until then,
  only makes the figures stale. Another fundraising platform could be added the same way, though
  none is in scope.
- **FR-008**: The site MUST keep a dated history of each campaign's figures, starting from the
  first successful read after the campaign is configured (no backfill), and MUST keep it even after
  the campaign finishes or JustGiving stops providing it. A read that finds the same figures adds
  no new history point beyond updating the last-read time.

#### Privacy

- **FR-010**: The site MUST publish only these fundraising figures: total raised, target, supporter
  count (a count only), and when they were read. Donor names, donor messages, individual donation
  amounts and Gift Aid figures MUST NOT be published.
- **FR-011**: Donor names, messages and individual donation amounts are other people's personal
  data, so they MUST NOT be stored by the site at all, publicly or privately; if JustGiving returns
  them alongside the figures, they MUST be discarded before anything is stored.
- **FR-012**: The total shown MUST be JustGiving's own total for the page, excluding Gift Aid.

#### Campaigns

- **FR-020**: The owner MUST be able to add a campaign by editing the site's files, giving: the
  race it is linked to (an upcoming or past race the Running section knows), the charity's name,
  the JustGiving page, and optionally a link to the charity's own website. No login or admin
  screen is involved.
- **FR-021**: A campaign's target MUST come from its JustGiving page only; the site's files MUST
  NOT hold a second copy of it.
- **FR-022**: The **current campaign** MUST be the one linked to the Running section's focus race;
  every other campaign is a past campaign. A campaign MUST NOT appear anywhere on the site until
  its figures have been read successfully at least once.
- **FR-023**: The owner MUST be able to mark a campaign finished via the site's files. A finished
  campaign MUST no longer be read; its last stored figures become its final total, shown as "Final
  total" with the date last read, with no staleness notice and no Donate button. Until marked
  finished, a campaign keeps being read, including after its race day.
- **FR-024**: The charity a campaign names and the charity the hero shows for the same focus race
  MUST agree; owner-entered campaign data MUST be checked before the site goes live, and a problem
  MUST stop the update with a message identifying the file, entry and field, leaving the live site
  unchanged (as in Running's FR-070).
- **FR-025**: The fundraising target MUST NOT be a goal: it MUST NOT appear on the Goals page or in
  the landing page's featured goals, and MUST NOT count towards the featured-goal limit.

#### Landing-page card (Story 1)

- **FR-030**: When the focus race has a current campaign with figures, the landing page MUST show a
  fundraising card in the place reserved beside the Brighton hero (Running's FR-025), showing: the
  total raised against the target, a progress bar, the supporter count, the charity ("For
  Martlets"), when the figures were last updated, and a Donate button linking to the JustGiving
  page. Otherwise that place MUST show nothing, with no empty card or placeholder.
- **FR-031**: The card MUST share the goal cards' visual style (progress bar, typography, warm
  Running look) while being visibly its own card, not a goal.
- **FR-032**: Progress MUST be the total as a share of the target. When the total reaches or passes
  the target, the bar MUST be full and the card MUST say so with the percentage (e.g. "Target
  beaten: 108%"); below the target it MUST never show as complete. With no target, the card MUST
  show the total and supporters without a bar.
- **FR-033**: After the race date (or once the race result is recorded), the card MUST lead with
  "Raised £X for <charity>" and show the race result beside it (the official time if recorded,
  else the watch time, as the hero shows it), with the target and bar kept as secondary detail and
  Donate kept until the campaign is finished.
- **FR-034**: On phones, the card MUST appear within or directly after the hero's headline facts
  (race, date, days to go, target), before the featured goals.

#### Fundraising page (Story 2)

- **FR-040**: The section MUST have a fundraising page at `/running/fundraising/`, linked as
  "Fundraising" in the Running menu and from the landing card, existing only once at least one
  campaign has figures.
- **FR-041**: The page MUST lead with the current campaign: race name and date, charity (linking to
  the charity's website where given), total against target with a progress bar, supporter count,
  last-updated time, and a Donate button; after race day it follows the card's "Raised £X" form
  (FR-033).
- **FR-042**: The page MUST show a chart of the current campaign's total over time, by day, from
  the first stored total to the last, with the target marked, once there are totals from at least
  two days.
- **FR-043**: The page MUST list past campaigns, most recent race first, each with its race and
  date, charity, final or latest total (and target, where there was one), and a link to its
  JustGiving page. With no current campaign, the page MUST lead with this list.
- **FR-044**: The page MUST show the current campaign's approved story (Story 3) when there is one,
  and no story section or placeholder when there isn't.

#### Story (Story 3)

- **FR-050**: Each campaign MAY have a story ("Why I'm running for <charity>"), drafted by AI from
  the owner's answers to a short set of questions, then edited and explicitly approved by the
  owner. Only approved text MAY be published (constitution Principle VIII).
- **FR-051**: The story MUST NOT state any fact (achievement, result, figure, date, personal
  detail) that does not come from the owner's answers or the site's stored data. Where the draft
  would need a missing fact, it MUST ask the owner instead of inventing one.
- **FR-052**: The site MUST refuse to publish a story that is not recorded as approved by the owner
  (with the approval date): the update stops before going live with a clear message, and the live
  site is unchanged.
- **FR-053**: The lessons from the owner's edits to the draft MUST be captured in a living voice
  style guide, `VOICE.md`, which this feature creates. Later drafted text for the site follows it.
- **FR-054**: The approved story is the text used on both the site and the JustGiving page. The
  site does not change the JustGiving page itself; when the approved text changes, the owner MUST
  be told to update the JustGiving page to match.
- **FR-055**: The owner's raw answers and unapproved drafts MUST NOT be published, and, because the
  repository is public, MUST NOT be committed to it unless the owner agrees.

#### Quality bars

- **FR-060**: Every fundraising view MUST meet the Running section's quality bars: designed for
  phones first and usable from 320 px wide; the landing page and fundraising page each score at
  least 90 for mobile performance; WCAG 2.2 AA; a unique title, description and share-preview image
  for the fundraising page.
- **FR-061**: The progress bar MUST convey its value in text too (e.g. "£1,250 of £2,000, 62%"),
  and the chart MUST have a text alternative stating its key message and its data as a table,
  operable by keyboard.
- **FR-062**: All figures, the Donate link and the chart's summary and table MUST remain available
  if interactive enhancements fail to load.
- **FR-063**: Amounts MUST be shown in pounds sterling to the whole pound with thousands separators
  (e.g. "£1,250"), rounded down so the site never overstates what was raised; dates in UK format
  (e.g. 4 Apr 2027) and days in UK local time.
- **FR-064**: Fundraising MUST be part of the Running section (its pages, data and settings live
  there) and MUST NOT require changes to other sections (constitution Principle VII).
- **FR-065**: The Donate button MUST be clearly labelled as going to JustGiving (e.g. "Donate on
  JustGiving"), so visitors know they are leaving the site to give.

### Key Entities

- **Campaign**: a fundraiser linked to one race. Linked race, charity name (and optional website),
  JustGiving page, finished flag, and its story. The target is not stored here; it is read from
  JustGiving. Current when linked to the focus race; otherwise past.
- **Fundraising Snapshot**: the figures read for a campaign at one time: when read, total raised
  (excluding Gift Aid), target (if any), supporter count. The latest is the campaign's current
  figures; earlier ones form its history and chart. Nothing about individual donations or donors.
- **Campaign Story**: the approved "why I'm running" text for a campaign, with the date the owner
  approved it. Drafts and the owner's raw answers are not part of what is published.
- **Voice Style Guide** (`VOICE.md`): the living record of how the owner writes, built from their
  edits to AI drafts, used for all future drafted text on the site.
- **Fundraising Refresh Record**: when each campaign's figures were last read successfully, and any
  failure details, used for "last updated", staleness notices and owner alerts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a test with at least 5 people unfamiliar with the site, each using a phone, at
  least 4 can state within 15 seconds of opening the landing page how much has been raised and the
  target, and reach the JustGiving page within 2 taps.
- **SC-002**: A new donation shows on the site within 3 hours of appearing on JustGiving in at least
  95% of cases over a month (typically within about 2 hours), and within 30 minutes of the owner
  triggering "refresh now".
- **SC-003**: With JustGiving deliberately unreadable for 7 days, 100% of pages still load with the
  last known figures and their last-updated time, the staleness notice appears after 12 hours, the
  Donate link works, running data keeps updating, no site update fails because of it, and the
  owner is alerted within 24 hours.
- **SC-004**: An automated check across every published page and public file finds zero donor
  names, donor messages, individual donation amounts and Gift Aid figures.
- **SC-005**: On 10 separate spot checks, the total, target and supporter count on the site match
  JustGiving's page as at the site's "last updated" time in 100% of cases.
- **SC-006**: Before a campaign has figures, an automated check of every page finds no fundraising
  card, menu item, link or placeholder, and the fundraising page does not exist.
- **SC-007**: 100% of published story text matches the owner-approved version; in a test, a story
  not recorded as approved is stopped before going live every time.
- **SC-008**: Every fact in the published story can be traced to the owner's answers or the site's
  stored data (checked once, at approval, statement by statement).
- **SC-009**: Adding a second campaign for a later race, and marking Brighton finished, needs only
  edits to the site's files, and both show correctly (new campaign current, Brighton under past
  campaigns with its final total) at the next site update.
- **SC-010**: The landing page with the card, and the fundraising page, each score at least 90 for
  mobile performance and pass a WCAG 2.2 AA audit with zero violations, and the fundraising page's
  share preview shows its own title, description and image.

## Assumptions

- **Audience and tone**: as in the Running section: friends, family, sponsors and fellow runners;
  warm and personal, visual first, short supporting text.
- **New public data category**: total raised, target, supporter count and the approved story are
  published by the owner's explicit approval (constitution Principle VI), given in the question
  rounds. Nothing else from JustGiving is published.
- **No donor data kept at all**: stricter than the Running section, which archives raw provider data
  privately. Donor details are other people's data and the site never needs them, so they are not
  stored anywhere (FR-011).
- **Supporters** means JustGiving's own supporter count for the page, as JustGiving shows it.
- **Total** means JustGiving's own page total, excluding Gift Aid, including any offline amounts the
  owner records on JustGiving. Shown to the whole pound, rounded down (FR-063).
- **Target**: whatever the JustGiving page says, set by the owner there only. Martlets' Brighton
  Marathon 2027 charity places list a £50 registration fee and a £500 fundraising minimum, but the
  owner may hold their own entry, so the site doesn't assume either; it uses the page's target.
- **Currency**: pounds sterling only.
- **History granularity**: a new history point is kept only when a read finds changed figures (FR-008);
  an unchanged read only moves the last-read time, matching how Running's idle refreshes change
  nothing. The chart is by day (each day's latest total).
- **Staleness**: the same 12-hour threshold as the Running section; a finished campaign is never
  "stale".
- **Current campaign**: the one linked to the focus race. Switching the focus race (Running's
  FR-026) is what moves a campaign from current to past; there is no separate switch.
- **Campaign end**: the owner marks a campaign finished (prompted by the agent at a session review
  once donations have stopped for a few weeks after race day); until then it keeps being read.
  Donate stays on the card and page until then.
- **After race day**: the card leads with "Raised £X for Martlets" and the race result, keeping the
  target and bar as secondary detail (FR-033). The result shown is the hero's (official time first,
  else the watch time).
- **No campaign pages of their own**: past campaigns are a list on the fundraising page, each linking
  to its JustGiving page, not separate site pages.
- **Story process**: the agent asks the owner a few questions, drafts from the answers only, and the
  owner edits and approves it in the session; only the approved text goes into a pull request, so
  drafts never reach the public repo's history (FR-055). The story can be drafted before any site work, as soon
  as the JustGiving page is being set up, because JustGiving needs it too. The owner pastes the
  approved text into JustGiving; the site never writes to JustGiving.
- **Eval suite (Principle II(b))**: nothing on the live site drafts text automatically; the story is a
  one-off drafting task in a session, approved by the owner. So no divergence/eval suite is built in
  this feature. If the owner agrees, the anonymised question-answer, draft and approved text pair is
  kept as the first example for the suite the CV & Blog spec will need.
- **Raw answers stay private**: the repository is public, so the owner's answers and drafts are not
  committed unless they agree; `VOICE.md` records style lessons, not private facts.
- **Charity branding**: the charity is named in text (with a link to its website where given); no
  charity logo is used unless the owner supplies one with the charity's permission.
- **Share image**: the fundraising page's share image shows the charity, race and total raised at
  the time of the site update, because a figure helps fundraising (social apps may show an older
  cached image). The landing page's existing share image is unchanged.
- **JustGiving's terms**: any attribution or display conditions JustGiving sets for showing its
  figures are followed; they are checked at plan time.
- **No manual fallback for the total**: if JustGiving can't be read for a long time (e.g. after its
  June 2027 access change), the figures go stale and the owner is alerted; a hand-entered total is
  not built now and could be added then if needed.
- **Units and locale**: pounds sterling, UK date format, UK local time.

### Out of scope

- Donor names, donor messages and individual donation amounts, shown or stored.
- Gift Aid figures.
- Taking or handling payments on the site; donating always happens on JustGiving.
- Writing to the JustGiving page (story, target or updates) from the site.
- Other fundraising platforms (one could be added later behind the same boundary, FR-007).
- Fundraising figures on race pages or share images other than the fundraising page's.
- Backfilling the total's history from before the campaign is configured.
- The personal journey/story page and videos (a future spec).
- The CV & Blog section.

### Dependencies

- The owner creating the JustGiving page for Martlets (Brighton Marathon 2027), with the agent's
  guidance, between this spec and the plan; nothing appears on the site until then.
- A way for the site to read a JustGiving page's total, target and supporter count that is
  available to an individual fundraiser, and its route through JustGiving's move to its new
  developer platform (current access ends 30 June 2027); researched at plan time.
- The Running section (spec 001): the focus race and its hero (with the reserved fundraising place),
  race results, the scheduled refresh and "refresh now", the owner alerts, the goal-card look, the
  Running menu and the site's quality bars.
- The owner answering the story questions, and editing and approving the draft.
