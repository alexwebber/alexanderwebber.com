# Contract: Pages and Share Surface

Section integration injects these routes (Running owns them; site home only links in).

| URL | Page | Story | Notes |
|---|---|---|---|
| `/` | Site home | - | Leads to `/running/` until CV/Blog exist |
| `/running/` | Landing: focus-race hero, featured goals, this week, latest run, section links, reserved fundraising slot | US1 | Daily rebuild; hero follows the upcoming-race state (upcoming / race day / awaiting result / completed); story link only when `story_link` is set in `section.yaml` |
| `/running/goals/` | Active goals + achieved list | US2 | |
| `/running/training/` | Period totals (week/month/year/all) + run list (`?races=1` filter via pre-rendered races list) | US3 | Grouped by month; paged by year for 5,000 runs |
| `/running/training/<year>/` | Run list for a year | US3 | Keeps page weight bounded |
| `/running/runs/<run-id>/` | Run detail | US3 | `<run-id>` = opaque `YYYY-MM-DD-xxxx`; **no provider (intervals.icu/Garmin) ID**, start time, map or location anywhere in URL or HTML; treadmill runs labelled |
| `/running/races/` | Race history, PB table, upcoming races | US4 | |
| `/running/races/<slug>/` | Race detail: result, map (static SVG + click-to-load), run detail, photos | US4 | `<slug>` = owner slug, else the run ID (`YYYY-MM-DD-xxxx`) |
| `/running/health/` | VO2 max, fitness/fatigue/form (intervals.icu model), Garmin training status + predictions ("as of" owner entries), RHR, HRV, weight avg, body fat, lab markers | US5 | Range toggle 3 months/1 year/all |
| `/running/api/freshness` | Worker JSON | FR-005/006 | See pipeline.md |
| `/og/<path>.png` | Generated share images | FR-072 | Build time. Unique: site home, landing (days to race), goals/training/races/health hubs, each race page (~110). **Shared** generic cards `/og/running-run.png` and `/og/running-year.png` for all training-run pages and year lists (no per-run images: keeps deployed files ~6,000 at 5,000 runs vs the 20,000 free limit) |

Every page that shows Garmin-sourced data (landing, goals, training, run, race and health pages)
shows Garmin attribution per Garmin's brand guidelines (FR-077). Every page: unique `<title>` and meta
description, canonical URL, OG/Twitter tags with an image
(its own, or the shared card above), `lang="en-GB"`, skip link, landmarks, 320 px-first layout. Sitemap generated
(`@astrojs/sitemap`). No page (other than the optional map script on race pages) loads third-party
resources.
