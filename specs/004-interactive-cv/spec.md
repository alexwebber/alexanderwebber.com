# Feature Specification: Interactive CV

**Feature Branch**: `004-interactive-cv`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "The site's interactive CV at `/cv`, drillable and animated, built from
the career record's timeline data and approved text only. The whole CV on one page with the
swimlane timeline at its heart; tapping a change opens a short card saying why it mattered; the
timeline draws itself on first view and its drills animate; on a phone held upright, time runs down
the page; the visual CV's look carries over; email and LinkedIn but no phone number; the plain and
visual PDFs offered as downloads, without the phone number, and updated as they're polished; the
page is built now and its real text comes in only after the owner's sharing rules are re-checked;
weekly view and download counts from server-side data, with no script on the page." (Owner answers
gathered in three question rounds on 2026-11-24.)

## Overview

The owner's CV now exists in three forms, all from one private career record: a plain text CV for
job sites, a single-page visual CV (a landscape swimlane timeline), and, with this feature, an
interactive CV on this site. The paper CVs point here ("Explore the interactive version"), so the
page has to work as a complete CV for someone arriving from a printed QR code or a link.

The page is the **whole CV, with the timeline at its heart**: a header and pitch, then the
interactive timeline, then the CV's other text blocks (where the owner has added value, how they see
the future, skills, public work, education), contact links and the downloads.

**The timeline** is the visual CV's picture made explorable. Changes the owner introduced or led sit
in lanes by type of change, as bars (a period) or dots (a single point), with the roles they held
("hats") along the top and where they're heading next at the end. The latest year is magnified month
by month. Related changes form threads. A reader taps a change to open a short card that says what
problem it solved and what it changed, follows a thread, or zooms into an era. On first view the
timeline draws itself through the years; after that, its drills animate.

**Every word is the owner's to approve.** The text is drafted and approved in the private career
record, never here. Only approved text enters this repository, and the site refuses to publish
anything else. Before any real text comes in, it is checked against the owner's sharing rules (what
may be said in public about past and present employers), and those rules are re-checked with the
owner first. Until then the page is built and tested with made-up text.

**Unlisted at first** (decided 2026-11-07): the page is live at its address, which the owner shares,
but isn't indexed or linked from the site's menus until one switch makes it fully public.

This repository is public, so this spec describes the page's structure and rules only. Wording in
its examples ("Change A", "a made-up role") is invented and says nothing about the real CV. Nothing
here depends on the CV's content: the spec fixes no list of changes, lanes, roles or years.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reading the CV (Priority: P1)

A recruiter or engineering peer opens `/cv` on a phone, from a link or a QR code on a paper CV. The
first screen shows the owner's name, headline and the start of their story. Scrolling down, they
read the pitch, see the whole career as one timeline, then the value, future, skills, public work
and education blocks, and finally how to get in touch.

**Why this priority**: This is the page's job. On its own, with the timeline shown as a still
picture, it already works as a complete CV at the address the paper CVs point to.

**Independent Test**: With a made-up CV in a test-only preview, open the page on a phone and a
desktop: every block appears in order; the timeline shows every change in its lane with the hats
and "next"; the page reads correctly with scripts turned off; and no phone number appears anywhere
in the built page.

**Acceptance Scenarios**:

1. **Given** a phone held upright, **When** the page loads, **Then** the name, headline and the
   start of the pitch are on the first screen, and the timeline runs down the page with the years
   in order.
2. **Given** a desktop, **When** the page loads, **Then** the timeline is landscape: years left to
   right, one lane per type of change, hats along the top, the latest year magnified, "next" at
   the right.
3. **Given** scripts are off or fail to load, **When** the page renders, **Then** the timeline is
   still shown as a still picture and every change's label, dates and card text are readable in a
   plain list.
4. **Given** the page, **When** a reader looks for contact details, **Then** they find the email
   address and LinkedIn (once it exists), and no phone number.

---

### User Story 2 - Exploring the timeline (Priority: P2)

A reader is curious about one change. They tap it and a short card opens: the change, its dates,
its lane and thread, and one to three sentences on the problem it solved and what it changed. A
change marked as adding value links to its full value story further down the page. From the card
they can follow the thread (related changes stay lit, the rest dim) or step to the next change in
it. They can also zoom into an era, or tap a hat or a "next" item to read about it.

**Why this priority**: Drilling in is what makes the page more than the paper CV, and it's where
every claim gets its "why".

**Independent Test**: In the preview, open a card for a bar, a dot and a hat with mouse, touch and
keyboard alone; follow a thread to its end; zoom into an era and back out; close every card with
Escape or its close control, and focus returns to the mark that opened it.

**Acceptance Scenarios**:

1. **Given** the timeline, **When** a reader taps or presses Enter on a change, **Then** its card
   opens with its label, dates, lane, thread and approved card text.
2. **Given** an open card for a change in a thread, **When** the reader chooses to follow the
   thread, **Then** that thread's changes are highlighted, the others dim, and the reader can step
   through them in time order.
3. **Given** a change marked as adding value, **When** its card is open, **Then** it links to that
   value story's block on the page.
4. **Given** the desktop timeline, **When** the reader zooms into an era, **Then** that span of
   years fills the width and the reader can zoom back out to the whole career.
5. **Given** a keyboard or screen-reader user, **When** they reach the timeline, **Then** they can
   move between changes in a predictable order and hear each change's label, dates and lane.

---

### User Story 3 - The timeline draws itself (Priority: P3)

The first time the timeline comes into view, the years sweep across (down the page on a phone) and
the lanes, hats and changes grow in, settling in about three seconds. A reader can skip it, and
anyone who has asked their device for reduced motion sees the finished picture straight away. After
that, opening cards, following threads and zooming animate.

**Why this priority**: It gives the "story unfolding" moment that makes the page memorable, but the
page is complete without it.

**Independent Test**: In the preview, scroll the timeline into view and watch it draw in about three
seconds; reload and skip it; turn on reduced motion and see no movement at all, with every drill
still working.

**Acceptance Scenarios**:

1. **Given** the timeline scrolls into view for the first time, **When** motion is allowed,
   **Then** it draws itself through the years and settles within about three seconds.
2. **Given** the draw-in is running, **When** the reader taps, scrolls past or presses a key,
   **Then** it jumps to the finished picture.
3. **Given** reduced motion is set, **When** the page loads, **Then** the finished picture shows at
   once and drills change state without movement.

---

### User Story 4 - Downloading the CV (Priority: P4)

A recruiter wants a file to save or forward. The page offers two: the plain text CV (which job sites
and applicant-tracking systems can read) and the single-page visual CV, both as PDFs, neither with a
phone number. Each says when it was last updated. Both will be polished more than once, and each new
approved version replaces the old one at the same link.

**Why this priority**: Useful and expected on a CV page, but the page itself comes first.

**Independent Test**: In the preview, download each PDF; check that neither contains a phone number,
that the plain one's text can be extracted as written, and that replacing a file with a newer
approved version keeps the same link and updates the date shown.

**Acceptance Scenarios**:

1. **Given** the downloads, **When** a reader chooses either PDF, **Then** it downloads with a clear
   file name and the page shows its last-updated date.
2. **Given** a new approved version of either PDF, **When** the owner publishes it, **Then** it
   replaces the old one at the same link.
3. **Given** a PDF that contains a phone number or isn't approved, **When** the site is built,
   **Then** the build refuses it.

---

### User Story 5 - Publishing approved text (Priority: P5)

The owner approves the CV's text in the private career record: the blocks, the timeline's changes,
hats, threads and "next" items, and one short card per change and hat. The agent brings the approved
text into the site by script, exactly as approved, after checking it against the owner's sharing
rules. The site refuses to build a page with unapproved text, and later changes go through the same
route.

**Why this priority**: It's the gate that keeps the page truthful and safe, and it's needed before
the real page goes live. The rest can be built and tested with made-up text first.

**Independent Test**: Plant an unapproved change, a phone number and an unmatched thread in a
scratch copy of the CV data: each makes the build fail with a message naming it. Bring in a made-up
approved set and compare the built page's text with it word for word.

**Acceptance Scenarios**:

1. **Given** CV data in which any item isn't marked approved, **When** the site is built for
   production, **Then** the build fails and names the item.
2. **Given** an approved set from the career record, **When** the agent brings it in, **Then** the
   site's copy matches the approved text exactly, and the comparison is recorded in the PR.
3. **Given** the owner's sharing rules, **When** text is brought in, **Then** it has been checked
   against them and the owner has re-confirmed the rules since they last changed.
4. **Given** a change without an approved card, **When** the site is built for production, **Then**
   the build fails rather than showing a change that can't be opened.

---

### User Story 6 - Knowing the page is used (Priority: P6)

Once a week the owner learns how often `/cv` was opened and each PDF downloaded, read from the
hosting provider's server-side traffic data, with no script on the page.

**Why this priority**: Tells the owner whether the link and QR code are being used, but changes
nothing for readers.

**Independent Test**: After a week live, the weekly report shows views of `/cv` and downloads of
each PDF for the last seven days, and the page makes no third-party request.

**Acceptance Scenarios**:

1. **Given** the page has been live for a week, **When** the weekly report runs, **Then** it gives
   views of `/cv` and downloads of each PDF for those seven days.
2. **Given** the hosting provider's free plan can't give counts per page, **When** this is found in
   planning, **Then** the story is dropped and the owner is told, rather than a script being added.

---

### Edge Cases

- A change with a rough date ("about 2012") or an ongoing one ("to now"): the timeline draws it with
  its uncertainty or open end visible, and the card says so in words.
- Several changes in the same year and lane: the marks never overlap or hide one another, at any
  supported width from 320 px.
- The magnified latest year: months are labelled, and the join to the years before it is
  continuous, so a bar running across it isn't broken.
- A phone turned sideways or a tablet: the layout follows the width available, not the device.
- A thread with one change in it: treated as no thread, so nothing offers to "follow" it.
- A card's text is longer than its budget: the build flags it rather than letting the card grow off
  screen.
- Printing the page: it prints readably (the still timeline and the text), and points to the PDFs.
- A PDF missing at build time: its download is hidden, and the build warns.
- Forced colours or high contrast: lanes, threads and the "adds value" mark stay distinguishable
  without colour.
- Someone shares `/cv` while it's unlisted: it works for them, and search engines are still told
  not to index it.
- LinkedIn doesn't exist yet: its link is hidden until the owner gives the address.

## Requirements *(mandatory)*

### Functional Requirements

**The page**

- **FR-001**: The site MUST serve the interactive CV at `/cv`, as part of a CV section that owns its
  pages, data and checks, with nothing changed inside other sections (Principle VII).
- **FR-002**: The page MUST show, in this order: a header (name, headline, location as approved), the
  pitch, the timeline, the remaining approved text blocks, contact links and the downloads. Which
  text blocks appear, and their order after the timeline, come from the approved data, not the page.
- **FR-003**: The page MUST show the email address and, once given, the LinkedIn address, and MUST
  NOT show a phone number. The email address MUST NOT appear as plain text in the page's HTML.
- **FR-004**: While unlisted, the page MUST tell search engines not to index it and MUST NOT be
  linked from the site's menus, landing pages or sitemap. One setting MUST make it fully public.
- **FR-005**: The page MUST have a meaningful title, description and social preview image, which
  shows the timeline.
- **FR-006**: The page MUST look professional and distinct from the Running section, carrying over
  the visual CV's palette, lane colours and type, within the site's shared header and footer.

**The timeline**

- **FR-007**: The timeline MUST show every approved change in its lane, as a bar for a period or a
  dot for a single point, with the hats along the top (or side, on a phone) and the "next" items at
  the end. The latest year MUST be magnified month by month, continuous with the years before it.
- **FR-008**: From a width the plan sets (tablet and up), the timeline MUST be landscape (years left
  to right). Below it, time MUST run down the page, with the lanes as narrow columns and the hats
  beside them, readable without pinching or sideways scrolling at 320 px.
- **FR-009**: Changes marked as adding value MUST be visibly marked, in a way that doesn't rely on
  colour alone.
- **FR-010**: Every change, hat and "next" item MUST open a card with its label, dates (with "about"
  or "to now" in words where they apply), lane, thread and approved card text. A value change's card
  MUST link to its value story on the page.
- **FR-011**: A reader MUST be able to follow a thread from any card in it: the thread's changes
  highlighted, others dimmed, with steps to the previous and next change in time order.
- **FR-012**: On the landscape timeline, a reader MUST be able to zoom into an era and back out to
  the whole career.
- **FR-013**: Every interaction MUST work with touch, mouse and keyboard alone, with a visible focus,
  a predictable order through the changes, and cards that close with Escape and return focus to the
  mark that opened them.
- **FR-014**: Without scripts, the page MUST still show the timeline as a still picture and every
  change's label, dates, lane and card text as a list, so nothing is reachable only by script.

**Animation**

- **FR-015**: The first time the timeline comes into view, it MUST draw itself through the years and
  settle within about three seconds. A tap, scroll past or key press MUST skip to the end.
- **FR-016**: With reduced motion set, the page MUST show the finished timeline at once and change
  drill states without movement.
- **FR-017**: Opening and closing cards, following threads and zooming SHOULD animate briefly
  (under half a second) when motion is allowed.

**Downloads**

- **FR-018**: The page MUST offer the plain CV and the visual CV as PDF downloads, each with a clear
  file name and its last-updated date.
- **FR-019**: The build MUST refuse a PDF that contains a phone number, or that isn't recorded as an
  owner-approved version.
- **FR-020**: A new approved version of either PDF MUST replace the old one at the same link, through
  the same route as the text (FR-021), as often as the owner polishes it.

**Approved text only**

- **FR-021**: All CV text and data MUST come from the private career record, already approved there,
  and be brought into this repository by script, unchanged, with a word-for-word comparison against
  the approved source recorded in the PR.
- **FR-022**: A production build MUST fail, naming the item, if any CV text or data isn't marked
  approved, a change has no approved card, a thread or lane is referenced but not defined, or a
  phone-number pattern appears anywhere in the section's output.
- **FR-023**: Before real text first comes in, and whenever the owner's sharing rules change, the
  agent MUST re-check those rules with the owner and check the text against them. Until then the
  section MUST hold only made-up text, used in a test-only preview.
- **FR-024**: Edits the owner makes while approving CV text MUST be captured in `VOICE.md`
  (Principle VIII).

**Use**

- **FR-025**: If the hosting provider's free plan gives per-page counts, the owner MUST get a weekly
  count of `/cv` views and of each PDF's downloads for the last seven days, read server-side. The
  page MUST NOT load an analytics script or make any third-party request.

### Key Entities

- **Change**: something the owner introduced or led. A label, a start and optional end (year, or
  month in the magnified year; rough or ongoing flags), a lane, an optional thread, an optional
  "adds value" mark linked to a value story, and its approved card text.
- **Lane**: a type of change (for example "Change type A"). A name, a colour and an order.
- **Thread**: a set of related changes across time. A name and its changes; a thread needs two or
  more changes.
- **Hat**: a role the owner held, with a start and optional end, and its approved card text.
- **Next item**: where the owner is heading, with a title and approved text.
- **Text block**: one approved block of the CV (pitch, value stories, future, skills, public work,
  education), with its heading and order.
- **Download**: a PDF version: which CV, file name, last-updated date, and the approval it rests on.
- **Approval record**: for each item or file, that it was approved, when, and in which career-record
  change, so the build can refuse anything without one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a mid-range phone, the page scores at least 90 for performance and 100 for
  accessibility in Lighthouse, and the first screen shows the name, headline and pitch within
  2.5 seconds on a typical mobile connection.
- **SC-002**: The timeline's draw-in settles within 3 seconds, and with reduced motion set the page
  shows no movement.
- **SC-003**: Every change, hat and "next" item can be opened, read and closed with the keyboard
  alone, and with touch alone at 320 px, with no overlapping marks or text at any width from 320 px
  to 1920 px.
- **SC-004**: A planted unapproved item, a planted phone number and a planted unapproved PDF each fail
  the production build, with a message naming them.
- **SC-005**: The built page's text matches the approved source word for word (checked by script on
  every import).
- **SC-006**: The page makes no third-party requests, and with scripts off every card's text is still
  readable.
- **SC-007**: In the owner's guided review on a phone and a desktop, they can find their way from
  the first screen to any change's "why" in two taps or fewer.

## Assumptions

- **The data comes from the career record's timeline** (the visual CV's source), extended there with
  threads and one short card per change and hat. Drafting and approving those cards is work in the
  private career record, done before the real text comes in; this spec only requires that they
  exist and are approved.
- **Made-up text first**: the page, timeline, drills, animation and checks are built and tested
  against a made-up CV in a test-only preview, as for the journey story. The real text is a separate,
  later change.
- **The paper CVs' pointer** to `/cv` (with a QR code) is made in the career record once this page is
  live.
- **The visual CV's look** is taken from its design in the career record. Layout details for the
  phone form and the cards are settled in the plan, with mock-ups if the owner wants them.
- **Downloads are the plain and visual CVs' current versions**, built without the phone line in the
  career record; both will be polished more than once.
- **No new recurring cost** is expected: the page is static on the existing hosting, and the counts
  use the hosting provider's existing data, if its free plan has them per page (to be checked in the
  plan).
- **Script on the page is allowed for the timeline's interactions and animation**, kept small
  (Quality Bars: client-side JavaScript minimal), with everything readable without it.
- **The blog and LinkedIn are out of scope.** LinkedIn's address appears here once it exists.
