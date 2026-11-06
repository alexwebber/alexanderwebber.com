---
name: pr-screenshots
description: Take this project's PR screenshots with scripts/process/screenshots.ts — the built site's pages at phone width and on a desktop, light and dark, as WebP — look at them, then publish them to a side branch and paste the Markdown table it prints into the PR body. Use for every PR that changes what visitors see, and whenever the owner reviews something not yet live (previews, drills).
---

# PR screenshots

`gh` can't attach images to a PR, so the script commits them to a side branch that never merges
(`<branch>-screens`, made with git plumbing, so your working tree is untouched) and links them by
commit SHA. The side branch stays after the merge, so the PR's images keep working, and it
triggers no workflow.

## Steps

1. **Build** what you'll shoot: `--build` makes a `SHELL_PREVIEW=1` build, which preview pages
   need. For a scratch-copy drill, keep the copy's `dist/` (`DRILL_KEEP_DIST=<dir>`, `gate-drill`
   step 8) and shoot it with `--dist=<dir>`.
2. **Shoot**, from PowerShell (in Git Bash, prefix `MSYS_NO_PATHCONV=1`, or `/paths` become
   Windows paths):

   ```
   node scripts/process/screenshots.ts /story-preview/one-chapter/ /story-preview/long/ --build
   ```

   Each path gives `-phone` and `-phone-dark` (full page, 360 px wide, 2x) and `-desktop`
   (1280 x 800, full page). Options: `--first-screen` (only the first 360 x 780 screen, for "what a
   visitor sees first"), `--no-dark`, `--no-desktop`, `--desktop-dark`, `--width=320`, and
   `<path>=<name>` to name a shot. Per path, `,width=320` and `,first-screen` override those two,
   and `,height=640` sets the phone's screen height (the small phone Donate must fit on),
   and `,open` opens every `<details>` on the page before the shot (a list or table shown open),
   so one run can shoot the same page several ways under different names:
   `'/running/=landing,first-screen' '/running/=menu-320,width=320,first-screen' '/running/story/'`.
   Files land in `spikes/screens/out/` (gitignored).
3. **Look at every image** (Read them) before publishing: tests have passed with a broken layout
   that only a screenshot showed (a card overflowing its grid cell). Fix, rebuild, reshoot.
   Each run clears `out/` first, so shoot every path in one run (a later run for a close-up loses
   the rest).
4. **Publish**: rerun with `--publish`. It shoots again from `dist/`, so `dist/` must still be the
   build you looked at: after `pr-ready` (which leaves a deploy build), add `--build`. It pushes, then prints the PR body's Markdown (also in
   `spikes/screens/out/pr-body.md`): a table of phone shots, light and dark, and desktop links.
   Publishing again adds to the same side branch with a new SHA; use the newest table.
5. **In the PR body**, under *How to view it*: what each shot shows, what the owner should look at
   (the phase's *How to view it* names it), and that previews use made-up data.

## Rules

- **Made-up data only** for anything not yet public: a pushed image is public at once (Principle
  VI). Shots of the live site's real pages are fine; nothing from a private draft, ever.
- Long pages over WebP's 16,383 px limit are cropped to their top part, and the script says so.
  Shoot such a page with `--first-screen` too, or split it by state. Anything far down a long page
  (e.g. `long`'s later chapter photos) needs its own state or shot to be seen.
- Full-page shots load every lazy image first (a full-page shot doesn't scroll, so they'd show as
  empty boxes). First-screen shots don't; they show what a visitor sees.
- A cloud session may push only to its own branch: there, skip `--publish`, commit the images
  on the PR's branch (`git add -f spikes/screens/out/*.webp`, as `out/` is gitignored), link by
  that commit's SHA, and remove them in the next commit.

## Done when

- Every state the phase's *How to view it* names is in the PR body, phone and desktop, light and
  dark, and each image loads in the PR's rendered description.
