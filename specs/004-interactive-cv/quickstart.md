# Quickstart: validating the interactive CV

How to prove each part works, from made-up previews to the live page. Run JS suites from PowerShell with
Node 22 (`.nvmrc`); Git Bash fails at load on the owner's machine.

## 1. Setup

```powershell
npm ci
npm run gen-types
$env:SHELL_PREVIEW = '1'; npm run build; Remove-Item Env:SHELL_PREVIEW
npx astro preview
```

The previews are at `/cv-preview/typical/`, `/cv-preview/stress/`, `/cv-preview/minimal/` and
`/cv-preview/unlisted-off/`. A deploy build (no `SHELL_PREVIEW`) has no `/cv/` until `data/cv/page.yaml`
exists.

## 2. Files and checks (slice 1; US5, SC-004, SC-005)

```powershell
npx vitest run tests/unit/cv
npx vitest run tests/contract/schemas.test.ts
```

Expected: every planted case fails with a message naming file, kind and id, and no message contains the
sentinel word:

| Planted in a scratch copy | Expected |
|---|---|
| An item without `approved`, or text edited after approval | `... has no approval` / `... approval doesn't match` |
| A phone number in a card, a block, a PDF's text or its metadata | `... phone number` |
| A change without a card | `... has no card` |
| A thread with one change | `... thread has 1 change (needs 2)` |
| A card of 281 characters | `... card is 281 characters (budget 280)` |
| A PDF whose bytes changed after approval | `... approval doesn't match` |

Import round trip with the made-up export:

```powershell
npx tsx scripts/import-cv.ts --from=tests/fixtures/cv-export/typical.json --rules-checked=2026-12-01 --dry-run
```

Then a full import into a scratch copy, a build, and
`npx tsx scripts/compare-cv.ts --from=tests/fixtures/cv-export/typical.json` prints `no differences`.

## 3. The phone form (slice 2; US1, US2, SC-003, SC-006, SC-007)

```powershell
npx playwright test tests/e2e/cv-phone.spec.ts tests/e2e/cv-noscript.spec.ts tests/a11y/cv.spec.ts
```

Checks, at 320, 375 and 768 px:

- The first screen shows the name, headline and the start of the pitch.
- The overview shows every theme, roles, threads and next; a theme's tile leads to its list, a row to its
  card: any card in two taps from the overview (SC-007).
- The breadcrumb appears from the list on, names where you are, and the back control, the browser's back
  button and Escape each go up one level; focus lands on the level's heading.
- Previous and next walk the current list; "Follow this thread" then walks the thread.
- No horizontal scroll at 320 px; no two boxes overlap.
- With JavaScript disabled: every level shows in order, anchors work, every card's text is readable.
- axe: no violations in light and dark.

By hand on a phone: the same walk, one-handed, with the phone's back gesture.

## 4. The landscape form (slice 3; US2, SC-003)

```powershell
npx playwright test tests/e2e/cv-landscape.spec.ts
```

At 1024, 1440 and 1920 px: every change, role and next item is in the picture; no two labels, or a label and
a mark, overlap; a label without room appears on hover and on focus; Tab enters at the first item, arrows
move in time and between lanes, Enter opens the card; a thread lights and dims and steps; a role zooms to its
years and Escape zooms out. Repeat on `stress`.

## 5. Motion (slice 4; US3, SC-002)

- Motion allowed: the timeline draws itself within 3 s of entering the viewport (the test reads the
  animation's end time); a tap mid-way shows the finished picture at once.
- `reducedMotion: 'reduce'`: no animation runs and no transition is longer than 0 s; every drill still works.

## 6. Downloads (slice 5; US4)

- Each PDF downloads with its file name; "Last updated" shows its approval date.
- `unpdf` extracts the plain CV's headings as written (no joined hyphenated words).
- Replacing a fixture PDF with a newer approved one keeps the link and updates the date (FR-020).
- With a PDF missing, its download is hidden and validation warns.

## 7. Unlisted, share image, budgets (slice 6; FR-004, FR-005, SC-001)

```powershell
npx vitest run tests/unit/cv-unlisted.test.ts
node scripts/lighthouse-budget.mjs --path=/cv-preview/typical/
```

- `listed: false`: `noindex` on the page, `X-Robots-Tag: noindex` on the PDFs, `/cv/` not in the sitemap, no
  page links to it. `listed: true`: none of those.
- `/og/cv.png` (or the preview's) shows the title and the theme strips.
- Lighthouse mobile: performance >= 90, accessibility 100, LCP <= 2.5 s, JS <= 10 KB gzip, no third-party
  request.

## 8. The content PR and the live page (slice 7)

Only after the owner has re-confirmed the sharing rules (FR-023) and approved the set in the career record:

1. The career record's export (outside this repository) to a local folder.
2. `import-cv.ts --from=<export> --rules-checked=<date of re-confirmation>`.
3. The full gate locally; `compare-cv.ts` prints `no differences`; its output goes in the PR.
4. The owner's edits made while approving, captured in `VOICE.md` (FR-024).
5. After merge and deploy: `/cv/` on a phone and a desktop, a guided review with the owner, the page still
   unlisted (`curl -sI https://alexanderwebber.com/cv/<plain pdf>` shows `X-Robots-Tag: noindex`).

## 9. Use counts (US6)

Outside this repository: one test query with the owner's read-only analytics token; if the free plan answers
per path and counts static assets, the weekly figures are set up there; if not, US6 is dropped and the owner
is told.
