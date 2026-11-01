# Feature Specification: Journey Story

**Feature Branch**: `003-journey-story`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "A story page in the Running section at `/running/story/`: the owner's
fitness journey, told in chapters for someone just starting out. Chapters run in time order, each
named after a turning point, each with the owner's prose and a short 'what I learned' takeaway.
Supporting figures are optional and never lead. The page opens on the story and closes with a
section for someone at the start. The text comes from an interview, and only owner-approved text is
published, chapter by chapter, as the story grows. Visitors find it through the landing link spec
001 reserved and a Story item in the Running menu, both hidden until a first approved chapter is
published. Photos are optional; videos come later." (Full owner answers gathered in question rounds
on 2026-11-01.)

## Overview

The Running section (spec 001) reserved a place for a personal story page: a link on the landing
page that stays hidden until the page exists. This feature builds that page, at `/running/story/`.

The page tells the owner's fitness journey as a story for someone just starting out, who may feel
far from being a runner. It should show that it's possible, and what actually worked: motivational
and practical. Friends, family and sponsors are a secondary audience.

The page is **chapters, not a progress view**. The Goals, Training and Health pages already show
progress in numbers, and this page deliberately doesn't repeat them. Each chapter is named after a
turning point, not a number. It has the owner's prose, then a short, visibly distinct "what I
learned" takeaway. A chapter may carry one or two real figures in support, and needs none. A final
section speaks directly to someone at the start.

**Every word is the owner's to approve.** The agent interviews the owner a chapter at a time, shapes
a draft that keeps their phrasing, and the owner edits and approves it. Only approved text enters
the repository, and the site refuses to publish anything else.

**The story keeps growing.** The owner publishes what's true now and adds chapters when something
worth telling happens, the first being the Brighton Marathon on 4 April 2027. Each new chapter is
approved on its own, and earlier chapters stay as written.

This repository is public, so this spec describes the page's structure and rules only. Wording in
its examples ("Chapter A", "a made-up lesson") is invented, and says nothing about the real story.
Nothing here depends on the story's content: the spec fixes no chapter list or chapter count.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reading the story (Priority: P1)

Someone just starting out opens the story on a phone. The page opens on the story itself, not a
statistic. They read the chapters in time order, each with its name, its date or period, the owner's
prose and a short "what I learned" takeaway. At the end, a final section speaks directly to them,
followed by a short note that this is what worked for the owner and isn't medical advice.

**Why this priority**: This is the whole point of the feature. On its own, reached only by its
address, it already gives a reader the story.

**Independent Test**: With a made-up story in a test-only preview, open the page on a phone and a
desktop: the chapters are in time order, each with its parts in order; the first screen shows the
start of the story and no figure; the takeaways stand out in light, dark and forced colours; and
everything reads the same with scripts off.

**Acceptance Scenarios**:

1. **Given** published Chapters A, B and C, dated in that order, **When** a visitor opens the page,
   **Then** they appear in that order, each showing its name, its date or period, the owner's prose,
   then its takeaway.
2. **Given** any published story, **When** a visitor opens the page, **Then** no figure, statistic,
   chart or progress bar appears before the first chapter's prose.
3. **Given** Chapter A has the takeaway "a made-up lesson", **When** a visitor reaches it, **Then**
   it follows the prose under the label "What I learned", set apart by that label and its shape as
   well as by colour, and a screen reader announces it as its own labelled part of the chapter.
4. **Given** Chapter B carries one supporting figure and Chapter C carries none, **When** a visitor
   reads them, **Then** Chapter B's figure sits within the chapter, says what it measures and when,
   and is visibly secondary to the chapter's name and prose, while Chapter C reads as complete, with
   no gap where a figure might be.
5. **Given** a chapter's figure came from the site's stored data, **When** later data arrives and
   the Goals or Health pages show newer values, **Then** the chapter still shows the value as
   approved, fixed to that chapter's date.
6. **Given** an approved closing section, **When** a visitor reaches the end of the page, **Then**
   it comes after the latest chapter, followed by the short note.
7. **Given** a story of one chapter and no closing section, **When** a visitor opens the page,
   **Then** it reads as complete: no chapter list, no numbering, no "coming soon" and no placeholder.

---

### User Story 2 - Only the owner's approved words (Priority: P1)

The owner tells the story in an interview, a chapter at a time, in their own words. The agent shapes
a draft that keeps their phrasing, and the owner edits and approves it. Approved text goes into the
site's files and appears exactly as approved. Anything else, whether a draft, a chapter with no
approval or an approved chapter changed afterwards, is refused before it can go live.

**Why this priority**: The story is personal and the repository is public, and the constitution
(Principle VIII) forbids publishing AI-drafted text without the owner's approval. The page can't
ship safely without this, so it's built with Story 1.

**Independent Test**: With a made-up chapter in the preview, record its approval and confirm it
appears exactly as approved. Remove the approval, then separately change one word: each time the
update stops with a message that names the file, chapter and field and quotes none of the text, and
the live site is unchanged.

**Acceptance Scenarios**:

1. **Given** the owner has answered the questions for a chapter, **When** the agent shapes the
   draft, **Then** it keeps the owner's phrasing, every fact comes from their answers or the site's
   stored data, and anything the draft would need but doesn't have becomes a question for the owner.
2. **Given** a draft the owner has edited and explicitly approved, **When** the site next updates,
   **Then** the chapter appears exactly as approved.
3. **Given** a chapter in the site's files with no record of approval, **When** the site is updated,
   **Then** the update stops with a message identifying the file, chapter and field, and the live
   site is unchanged.
4. **Given** an approved chapter, **When** one word of it changes without a fresh approval, **Then**
   the update stops in the same way, whichever way the site is built.
5. **Given** a stopped update, **When** anyone reads its message or logs, **Then** they contain no
   wording from the story, because the logs are public.
6. **Given** raw answers and unapproved drafts, **When** the work moves through specs, plans, pull
   requests and commit messages, **Then** none of them appears there. Those documents may describe
   only the story's shape, such as how many chapters there are and how long they run.
7. **Given** the owner's edits during approval, **When** the chapter is approved, **Then** the style
   lessons from those edits are recorded in `VOICE.md`, which is created if it doesn't exist yet and
   extended if it does.
8. **Given** a figure from before the site's stored data begins, **When** a chapter would use it,
   **Then** the owner supplies the value, and it's recorded as theirs. It's never estimated or worked
   back from later data, and without a source it's left out.
9. **Given** a draft that names a private individual, or shows where the owner lives or regularly
   runs, **When** it reaches approval, **Then** that detail is removed before the chapter is approved.

---

### User Story 3 - Finding the story (Priority: P2)

A visitor on the Running landing page sees a prominent link to the story, and "Story" appears in the
Running menu. Until a first approved chapter is published, neither exists, so no visitor ever hits a
dead end.

**Why this priority**: Without a way in, only people given the address will find the page, so it
matters as soon as a chapter is published. It adds nothing before then.

**Independent Test**: Build with no chapters and confirm an automated check finds no story page,
menu item, landing link, placeholder or sitemap entry. Add one approved chapter and set the story
link, and confirm the link and menu item appear. On a 360 x 780 phone with the fundraising card
showing, confirm Donate is still fully on the first screen.

**Acceptance Scenarios**:

1. **Given** no approved chapter is published, **When** a visitor uses the site, **Then** there is
   no story link, no "Story" menu item and no placeholder, the address `/running/story/` answers as
   any unknown page does, and the page isn't in the sitemap.
2. **Given** a first approved chapter is published and the story link is set, **When** a visitor
   opens the landing page, **Then** the prominent link appears with no other change to the landing
   page, and "Story" appears in the Running menu on every Running page.
3. **Given** a 360 x 780 phone and the fundraising card showing, **When** the landing page opens with
   the story link and menu item present, **Then** Donate is still fully within the first screen.
4. **Given** the story link is set to the story page while no chapter is published, **When** the
   site is updated, **Then** the update stops with a message identifying the setting, and the live
   site is unchanged.
5. **Given** the story page has been reached, **When** a visitor looks at the Running menu, **Then**
   "Story" is marked as the current page, as other menu items are.

---

### User Story 4 - The story keeps growing (Priority: P2)

Something worth telling happens, the first planned being Brighton. The owner goes through the same
interview and approval for one new chapter. It joins the page in its place in time, before the
closing section, and earlier chapters stay as written. A longer story gains a way to jump between
chapters.

**Why this priority**: Growth is the page's long-term shape, and retrofitting it would mean rework.
It isn't needed for the first publication, which is why it follows the page itself.

**Independent Test**: With a made-up published story, add a new approved chapter by editing only the
site's files: it appears in time order before the closing section, no other chapter's text or
approval changes, and every existing chapter address still works. Grow the preview past the
threshold and confirm the chapter list appears and works with scripts off.

**Acceptance Scenarios**:

1. **Given** published chapters and a closing section, **When** a new chapter is approved and added,
   **Then** it appears in time order before the closing section, no other chapter's text changes,
   and no earlier chapter needs a fresh approval.
2. **Given** a new chapter that covers a time earlier than some published chapters, **When** it is
   added, **Then** it takes its place in time order.
3. **Given** a link someone saved to Chapter A, **When** later chapters are added before or after
   it, **Then** the link still leads to Chapter A.
4. **Given** a story of four or more chapters, **When** a visitor opens the page, **Then** they can
   reach any chapter from a list of chapter names, and return to that list from the end of any
   chapter, with scripts off, and the list doesn't push the start of the first chapter below the
   first screen on a phone.
5. **Given** the owner wants to correct a published chapter, **When** the corrected text is
   approved, **Then** only that chapter changes, under a fresh approval.
6. **Given** a chapter is removed from the site's files, **When** the site next updates, **Then** it
   no longer appears, and if it was the only chapter, the page and menu item go too, and the story
   link must be removed with it (FR-042).

---

### User Story 5 - Photos in a chapter (Priority: P3)

A chapter can show a few photos the owner has chosen, each with a caption and alternative text. The
story can launch with none.

**Why this priority**: Photos add warmth but the story works without them, and each one carries
privacy risk, so they come last.

**Independent Test**: In the preview, add made-up photos to a chapter: they appear in the chapter
with captions and alternative text, and no published photo file carries metadata. Add a photo with
embedded location data, or one with no caption: each time the update stops, naming the chapter and
photo. Confirm a story with no photos looks complete.

**Acceptance Scenarios**:

1. **Given** a chapter with two photos, **When** a visitor reads it, **Then** the photos appear
   within the chapter, each with a visible caption and alternative text for screen readers.
2. **Given** a story with no photos, **When** a visitor opens the page, **Then** it looks complete,
   with no empty frames or spaces.
3. **Given** a photo carrying location or device metadata, **When** it is added, **Then** the
   metadata is removed before the file enters the repository, and if a file carrying any reaches the
   site's files, the update stops.
4. **Given** a photo with no caption or no alternative text, **When** the site is updated, **Then**
   the update stops with a message identifying the chapter and photo.
5. **Given** a candidate photo that shows another person, or anything showing where the owner lives
   or regularly runs, **When** it reaches approval, **Then** it isn't used.
6. **Given** a chapter with more photos than the limit, **When** the site is updated, **Then** the
   update stops with a message identifying the chapter.

---

### Edge Cases

- **Approved means public, and public means permanent**: the repository is public, so text is public
  from the moment it enters a pull request, and it stays in git history even if it's later removed
  from the site. That's why only approved text goes in, and why the refusal in FR-034 is a backstop,
  not the safeguard. The owner is reminded of this when approving.
- **A photo's original file**: it must never be committed, even briefly, because git history keeps
  it. Metadata is removed before a photo enters the repository.
- **A closing section with no chapters**: nothing is visible; a closing section alone doesn't create
  the page.
- **A closing section written before a new chapter**: it stays as approved. When a new chapter is
  approved, the agent asks whether the closing still holds.
- **Two chapters with the same date**: they appear in an order the owner sets, the same on every
  build.
- **A chapter with a future date**: the update stops, as with any owner-entered date in the future.
- **A chapter missing its prose, takeaway, name or date**: the update stops with a message
  identifying the chapter and field.
- **A stored value is later corrected**: a chapter's figure stays as approved. If the correction
  makes it untrue, the owner decides whether to change the chapter, under a fresh approval.
- **A figure with no source**: if neither the stored data nor the owner has a value, it's left out.
- **Figures that seem to disagree with current pages**: a chapter's figure is dated and belongs to
  that time, so it can differ from today's Goals or Health values without being wrong.
- **Harmless wording caught by an automated privacy check** (text that looks like a private data
  category or an identifier): the update stops like any other. The owner rewords it under a fresh
  approval, or the check gains a stated exception.
- **A very short or very long chapter**: a chapter of a single paragraph and one of about a thousand
  words both read comfortably.
- **A story that outgrows 10 chapters**: the page and chapter list keep working; it never needs
  splitting across pages for the expected size (see Assumptions).
- **Long words or addresses in the text at 320 px**: text wraps, with no sideways scrolling.
- **A photo fails to load**: its alternative text and caption remain, and the chapter still reads.
- **Providers down or data stale**: the page doesn't change, because it reads nothing from any
  provider, and it isn't marked stale.
- **A link in a chapter to a page of the site that no longer exists**: the update stops.
- **The story link set to an address that leads nowhere** (including the example `/story/`): the
  update stops, so visitors never hit a dead end.
- **Forced colours or a high-contrast setting**: the takeaway keeps its label and outline, so it's
  still set apart.
- **Sharing one chapter**: a link to a chapter opens the page at that chapter; its share preview is
  the page's own, because there's one share image.

## Requirements *(mandatory)*

### Functional Requirements

#### The page

- **FR-001**: The section MUST have a story page at `/running/story/`, existing only once at least
  one approved chapter is published.
- **FR-002**: The page MUST be a sequence of chapters in time order, oldest first. It MUST NOT be
  organised around figures: no progress bars, charts, before-and-after comparisons or tables of
  results.
- **FR-003**: Each chapter MUST have a name, a date or period, the owner's prose and a takeaway, in
  that order, and a chapter missing any of them MUST NOT be published. A chapter's name is a turning
  point in words: chapters MUST NOT be numbered, and no chapter MAY lead with a figure.
- **FR-004**: The takeaway MUST be short (a sentence or two) and carry the visible label "What I
  learned". It MUST be set apart from the prose by that label and by shape as well as by colour, in
  light, dark and forced colours, and MUST be identifiable as its own part of the chapter to
  assistive technology.
- **FR-005**: The page MUST open on the story: no figure, statistic, chart or progress bar MAY come
  before the first chapter's prose.
- **FR-006**: The story MUST begin at the owner's decision to start, and earlier years get a line or
  two at most. This is a content rule, applied at approval.
- **FR-007**: The page MUST end with a closing section speaking directly to someone at the start,
  with what the owner would tell them, once that section is approved. It MUST always come after the
  latest chapter. With no approved closing section, the page ends after the latest chapter, with no
  placeholder.
- **FR-008**: The page MUST show a short note, once, after the story, saying that this is what worked
  for the owner and isn't medical advice, in wording the owner has approved.
- **FR-009**: The page MUST work for any number of chapters from one upwards, and MUST NOT depend on
  a fixed chapter count, chapter list or chapter length.

#### Figures

- **FR-010**: A chapter MAY carry one or two supporting figures, and none is required. Figures MUST
  be visibly secondary to the chapter's name and prose, and MUST NOT headline a chapter. More than
  two set-apart figures in a chapter MUST stop the update; figures within the prose are held to the
  same limit at approval.
- **FR-011**: A figure MUST say what it measures and when, and MUST be fixed: it's part of the
  approved chapter, belongs to that chapter's date, and doesn't change with later data.
- **FR-012**: Every figure MUST come from the site's stored data or from the owner (constitution
  Principle VIII). Where the stored data doesn't reach back that far (it begins in October 2025, and
  earlier reference values exist only where the owner supplied them), the owner supplies the value.
  A figure MUST NOT be estimated, calculated back or inferred, and with no source it's left out.
- **FR-013**: A figure MUST belong to a category already approved for publication (spec 001, FR-015).
  Any other category needs the owner's explicit approval first (constitution Principle VI).
- **FR-014**: A figure drawn from Garmin-sourced data, whether set apart or within the prose, MUST
  carry Garmin attribution as spec 001's FR-077 requires. Attribution MUST sit with the figure, not
  at the top of the page, so that the page still opens on the story.
- **FR-015**: The page MUST NOT repeat the Goals or Health pages: it shows no current values, and it
  MAY link to those pages instead. Links in a chapter MUST lead to pages of this site, and a link
  that leads nowhere MUST stop the update.

#### People and privacy

- **FR-020**: The story MUST NOT name any private individual other than the owner, and MUST NOT include
  any other person's private details. This applies to prose, takeaways, captions, alternative text and
  photos. Public figures and published sources MAY be named, for example to credit what the owner
  learned from.
- **FR-021**: Nothing in the text or photos MAY reveal where the owner lives or regularly runs, or
  their routine times (constitution Principle VI). Named races and other public events are allowed.
- **FR-022**: The published page MUST pass the same automated privacy and image checks as every other
  page of the site.

#### Writing and approval

- **FR-030**: The story MUST be written by interview, then draft: the agent asks the owner questions
  a chapter at a time, the owner answers in their own words, the agent shapes a draft that keeps
  their phrasing, and the owner edits and approves it.
- **FR-031**: The story MUST NOT state any fact (achievement, result, figure, date, personal detail)
  that doesn't come from the owner's answers or the site's stored data. Where a draft would need a
  missing fact, the agent MUST ask the owner instead of inventing one.
- **FR-032**: Only text the owner has explicitly approved MAY be published. Each chapter, the closing
  section and the note MUST each carry their own record of approval, with its date, tied to the exact
  words approved, as the fundraising story's approval is.
- **FR-033**: A chapter's approval MUST cover everything shown for it: name, date or period, prose,
  takeaway, figures, captions and alternative text. Adding or changing a photo also needs a fresh
  approval.
- **FR-034**: The site MUST refuse to publish a chapter, closing section or note that has no approval
  or has changed since it was approved, whichever way the site is built: the update stops before
  going live with a message identifying the file, chapter and field, and the live site is unchanged.
- **FR-035**: Messages and logs from these checks MUST NOT quote any story text, because logs are
  public.
- **FR-036**: Raw answers and unapproved drafts MUST stay outside the repository. Only approved text
  MAY enter the repository, a pull request or a commit message. Specs, plans and tasks MAY describe
  only the story's shape (such as chapter counts and lengths).
- **FR-037**: The lessons from the owner's edits MUST be captured in the living voice style guide,
  `VOICE.md`, as style lessons, not private facts. Whichever story is approved first, this one or the
  Martlets story (spec 002, T114 and T115), creates it, and the other extends it.
- **FR-038**: Each new chapter MUST be approved on its own, and adding one MUST NOT change or require
  fresh approval of any other chapter. Changing an approved chapter MUST need a fresh approval of that
  chapter only.
- **FR-039**: Every other word about the story that the site publishes (the page's title and
  description, the share image's text and the landing link's label) MUST be wording the owner has
  approved. The page's structural labels, "Story" and "What I learned", aren't story text.

#### Finding the story

- **FR-040**: The landing page MUST show a prominent link to the story through the existing story link
  setting (spec 001, FR-024), with no other change to the landing page.
- **FR-041**: "Story" MUST appear in the Running menu on every Running page, with the menu's usual
  marking of the current page.
- **FR-042**: The link, the menu item and the page MUST all stay hidden, with no placeholder, until a
  first approved chapter is published, so that visitors never hit a dead end. If the story link points
  at a page that doesn't exist, the story page with no chapters included, the update MUST stop with a
  message identifying the setting, leaving the live site unchanged.
- **FR-043**: Adding the menu item and link MUST NOT push the landing page's Donate button below the
  first screen on a 360 x 780 phone (it clears it by only 3 px today), and MUST NOT cause sideways
  scrolling at 320 px.

#### Growth

- **FR-050**: The owner MUST be able to add a chapter by editing the site's files, with no change to
  the page's code, layout or other chapters.
- **FR-051**: Each chapter MUST have its own address on the page, which MUST NOT change when chapters
  are added or removed, or when the chapter's name is corrected.
- **FR-052**: With four or more chapters, the page MUST offer a list of the chapter names that links
  to each chapter, and a way back to that list from the end of each chapter. Both MUST work with
  scripts off. The list MUST NOT push the start of the first chapter below the first screen on a
  phone. With fewer chapters, no list is shown.
- **FR-053**: A chapter's design MUST leave a place for a video to join it later, with no rework.
  Adding a video to one chapter later MUST NOT need a change to any other chapter, or a fresh approval
  of that chapter's text (the video gets its own approval). Nothing about video is shown now, and no
  hosting decision is made here.
- **FR-054**: Removing a chapter from the site's files MUST remove it from the page at the next
  update, and removing the last chapter MUST remove the page and its menu item.

#### Photos

- **FR-060**: A chapter MAY show up to three photos chosen by the owner. No photos are required,
  anywhere, and a story with none MUST look complete.
- **FR-061**: All metadata, location above all, MUST be removed from a photo before it enters the
  repository. An automated check MUST stop any update that carries a photo with metadata.
- **FR-062**: Photos MUST NOT show any person other than the owner, or anything showing where the
  owner lives or regularly runs. The owner checks this at approval.
- **FR-063**: Every photo MUST have alternative text and a visible caption. A missing one MUST stop the
  update with a message identifying the chapter and photo.
- **FR-064**: Photos MUST be delivered at sizes suited to the reader's screen, and a page with photos
  MUST still meet FR-073.

#### Quality bars

- **FR-070**: The story MUST live wholly inside the Running section, and MUST NOT require changes to
  other sections (constitution Principle VII). New shared code is allowed only where the plan
  justifies it.
- **FR-071**: The page MUST render from the site's own files only. It MUST make no third-party request,
  MUST NOT depend on a live provider, and all its content MUST be available with scripts off. It
  isn't a data view, so it shows no last-updated time: each chapter carries its own date, and each
  figure its own.
- **FR-072**: The page MUST be designed for phones first and usable from 320 px wide. Text lines MUST
  stay comfortable for long reading, at no more than about 75 characters on wider screens.
- **FR-073**: The page MUST score at least 90 for mobile performance, and the landing page MUST keep
  scoring at least 90 with the link and menu item added.
- **FR-074**: The page MUST meet WCAG 2.2 AA, including its photos and takeaways, with a logical heading
  order, in light and dark themes, and MUST remain usable in forced colours.
- **FR-075**: The page MUST have a unique title and description, a canonical address and its own
  share image. The share image MUST NOT carry a figure.
- **FR-076**: All owner-entered story content MUST be checked before the site goes live, as in spec
  001's FR-070: a problem stops the update with a message identifying the file, entry and field,
  leaving the live site unchanged.
- **FR-077**: Dates MUST use UK format (e.g. 4 Apr 2027), and figures metric units, as in spec 001's
  FR-075.
- **FR-078**: Test-only previews on made-up text MUST cover every state of the page: no chapters, one
  chapter, a long story, figures, photos, no closing section, and each refused case. They MUST exist
  only in test builds, never on the deployed site, so that everything can be built and reviewed
  without any real words reaching the repository.

### Key Entities

- **Story**: the page as a whole: its ordered chapters, the closing section, the note, and the owner's
  words about it (title, description, share text, landing link label). It exists only once a first
  chapter is approved and published.
- **Chapter**: one turning point: a stable identity, a name, a date or period (its place in time),
  prose, a takeaway, up to two figures, up to three photos, room for a video later, and its approval.
- **Closing Section**: the final section addressed to someone at the start, with its own approval.
- **Chapter Figure**: a value, what it measures, when, and where it came from (stored data or the
  owner, and whether it's Garmin-sourced). Fixed once approved.
- **Chapter Photo**: an image with no metadata, its alternative text and caption. Covered by its
  chapter's approval.
- **Approval**: who approved (always the owner), the date, and a tie to the exact words and figures
  approved, so that any later change is detected.
- **Voice Style Guide** (`VOICE.md`): the living record of how the owner writes, built from their edits
  to drafts, shared with the Martlets story and all later drafted text.
- **Raw Answers and Drafts**: not part of what's published and not in the repository.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 360 x 780 phone, the first screen shows the first chapter's name and the first lines
  of its prose, and an automated check finds no figure, chart or progress bar before that prose, in
  stories of one chapter and of 12 chapters.
- **SC-002**: With no approved chapter published, an automated check of every page and public file
  finds no story page, menu item, landing link, placeholder, share image or sitemap entry.
- **SC-003**: 100% of published story text matches the owner-approved version. In a test, a chapter
  with no approval, and an approved chapter with one character changed, are each stopped before going
  live every time, with a message that names the file and chapter and quotes none of the text.
- **SC-004**: Every fact and figure in the published story can be traced to the owner's answers or the
  site's stored data, and no chapter, caption or photo contains anything FR-020 and FR-021 rule out
  (both checked at approval, statement by statement and photo by photo).
- **SC-005**: Before each pull request that carries story text, a comparison of that text with what
  the owner approved finds zero differences, and a search of the repository finds no raw answers or
  unapproved drafts.
- **SC-006**: On a 360 x 780 phone with the fundraising card, story link and "Story" menu item all
  present, Donate is fully within the first screen, and no Running page scrolls sideways at 320 px.
- **SC-007**: An automated check across every published photo finds zero carrying location or device
  metadata, and in a test a photo with location data is stopped every time.
- **SC-008**: Adding a chapter needs edits only to that chapter's own content in the site's files. In a
  test, every other chapter's text, approval and address stay the same.
- **SC-009**: A made-up story of 12 chapters at about 600 words each, with photos in several chapters,
  scores at least 90 for mobile performance and passes a WCAG 2.2 AA audit with zero violations in
  light and dark themes, makes zero third-party requests, and shows all its content with scripts off.
  The landing page still scores at least 90 with the link and menu item added.
- **SC-010**: In a story of four or more chapters, a reader on a phone can reach any chapter from the
  top of the page in at most 2 taps, with scripts off.
- **SC-011**: In a test with at least 5 readers who don't think of themselves as runners, each on a
  phone, at least 4 describe the page as a story rather than a set of statistics and can say in their
  own words one thing that worked for the owner.
- **SC-012**: The page's share preview shows its own title, description and image, and the image
  carries no figure.
- **SC-013**: Adding a video to one chapter later is shown, at plan time, to touch only that chapter's
  content and one place in the chapter's layout.

## Assumptions

Items marked **(owner to confirm)** are the agent's defaults, chosen where the question rounds left
something open.

- **Audience and tone**: someone just starting out first; friends, family and sponsors second. Warm
  and personal, like the rest of Running. Text leads here instead of visuals, because the owner chose
  chapters over a progress view. That's a deliberate departure from the constitution's "visualisations
  over walls of text", which is a SHOULD.
- **New public data category**: a personal narrative isn't on Principle VI's public list. The owner's
  explicit approval of each chapter is what publishes it.
- **Order of work**: this spec, then the interview, then plan and build, so the page is designed
  around the real chapters and lengths. Only the story's shape reaches the plan. The page is built and
  reviewed on made-up text, and real text joins once it's approved.
- **Expected size**: roughly 5 to 10 chapters of a few hundred words each, on one page, and one chapter
  on its own must also work. The test size in SC-009 sits above that for headroom, and the plan may
  revise it once the real shape is known.
- **"Not medical advice" note (owner to confirm)**: a health story speaks to beginners, so the page
  carries a short line saying this is what worked for the owner and isn't medical advice, placed after
  the story so that it doesn't lead. Its final wording is the owner's. Takeaways stay in the owner's
  voice ("what I learned") rather than instructions or medical claims.
- **Products and brands (owner to confirm)**: no affiliate links or endorsements. A plain factual
  mention in the owner's own words is allowed.
- **Links (owner to confirm)**: chapters link only to pages of this site, such as Goals, Health or a
  race page. No links to other websites.
- **Public figures and sources (owner to confirm)**: FR-020 covers private individuals, so the owner
  can credit a coach, author or other public source they learned from, by name and with no link.
- **No call to action (owner to confirm)**: the page has no Donate button or fundraising card. The
  Running menu is there for anyone who wants it.
- **Chapter list (owner to confirm)**: appears at four or more chapters, with a link back to it after
  each chapter. Below four, the page is short enough to scroll.
- **Takeaway label (owner to confirm)**: "What I learned", the same on every chapter.
- **Chapter dates (owner to confirm)**: a chapter shows a date, a month or a period, whichever suits
  it, and takes its place in time from when it starts.
- **Closing section at launch (owner to confirm)**: expected at launch, but the first chapter can be
  published without it, so that it can't hold back the story.
- **Corrections (owner to confirm)**: a corrected chapter shows no "edited" note. Any change, even a
  typo, needs a fresh approval, because a check can't tell a typo from anything else.
- **Withdrawing text (owner to confirm)**: removing a chapter takes it off the site, not out of the
  public git history. The owner accepts this when approving, and rewriting history is out of scope.
- **Photo limit (owner to confirm)**: "a few at most" is taken as three per chapter.
- **No other people in photos (owner to confirm)**: taken strictly, so runners in the background of a
  race photo also rule it out here. Race pages keep their own photo rules. If that's too strict for
  race chapters, the owner may relax it for unidentifiable people in a crowd.
- **Menu position (owner to confirm)**: "Story" comes last in the Running menu, after "Fundraising".
  At 360 px that line has room, so the menu gains no third line, which is what protects Donate.
- **Landing link position (owner to confirm)**: the link stays where spec 001 put it, in its own panel
  below this week's running and the latest run, above the section links. That keeps Donate safe, but
  on a phone it's several screens down, so the menu item is the quicker way in. Moving it up would
  have to pass SC-006.
- **Link label and first publication**: the owner chooses the label. The agent sets the story link in
  the same pull request as the first approved chapter.
- **Garmin attribution (owner to confirm)**: a chapter isn't a data view as a Goals card is, but a
  Garmin-sourced figure still needs attribution, so it sits beside the figure, in plain text, including
  for figures within the prose. The plan re-reads Garmin's guidelines before this is built.
- **Landing page's section links**: the plan decides whether "Story" also joins the list of links at
  the foot of the landing page, directly below the story link's panel, where it might only repeat it.
- **Share image**: words only, using the page's approved title, with no figure and no photo. There's
  one image for the page, not one per chapter.
- **No notifications**: a new chapter has no "New" badge and no announcement, and the page has no
  feed. Newsletters and sign-ups are out of scope.
- **Prompting new chapters**: the agent raises a possible new chapter at reviews after milestones,
  starting with the first session after Brighton, and never as a chore for the owner.
- **Eval suite (Principle II(b))**: nothing on the live site drafts text automatically, and the owner
  approves every word, so no divergence or eval suite is built here, as with the Martlets story (spec
  002). Unlike that story, no question, draft and approved-text example is kept from this one by
  default, because the answers are personal.
- **Fixture wording**: previews use obviously made-up text and generated images, never real answers or
  photos of the owner.
- **Reader test (SC-011)**: run once on the real text after launch, using people the owner picks. The
  owner may skip it, as they skipped earlier usability checks after reviewing the live pages.

### Out of scope

- Videos and their hosting (the design only leaves a place for them, FR-053).
- Comments, newsletters, sign-ups or any other way of hearing about new chapters.
- A data-led comparison of times or any other progress view.
- The Blog and CV.
- Changes to the Martlets story, or to what the fundraising page shows.
- Automatic drafting on the live site: drafting happens in a session with the owner.
- Translations.

### Dependencies

- The Running section (spec 001): the reserved story link setting and its landing panel (FR-024), the
  Running menu, the owner-data checks (FR-070), the photo privacy rule (FR-016), Garmin attribution
  (FR-077) and the site's quality bars.
- **An amendment to spec 001**: FR-055 says photos are supported on race pages only, and its Out of
  scope lists photos for training runs. This spec adds photos in story chapters, under the stricter
  rules above. Training-run pages are unaffected.
- The fundraising story (spec 002): its precedent for tying approval to the exact text, and `VOICE.md`,
  which the two stories share.
- The owner's time for the interview and approval, which happens outside the repository.
