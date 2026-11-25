# Contract: CV routes

Injected by `src/sections/cv/integration.ts` only when `data/cv/page.yaml` exists.

| Route | Source | Notes |
|---|---|---|
| `/cv/` | `pages/cv.astro` | The whole CV. `noindex` while `listed: false` |
| `/cv/<file>` | `pages/download.ts` | Each approved PDF from `data/cv/downloads/`, `Content-Type: application/pdf` |
| `/og/cv.png` | `og/cv.png.ts` | 1200 x 630: the approved title and the theme strips |

Test-only (a `SHELL_PREVIEW=1` build): `/cv-preview/[state]/` over generated, made-up CVs (`typical`,
`stress`, `minimal`, `unlisted-off`), each with its own PDFs from the fixtures. Deploy builds never set it.

## Page head

- `<title>` and description from `page.yaml`; canonical `https://alexanderwebber.com/cv/`; Open Graph and
  Twitter tags through the shared `Meta.astro`, image `/og/cv.png`.
- While `listed: false`: `<meta name="robots" content="noindex">`.

## Unlisted

| `listed` | Page meta | PDFs' `X-Robots-Tag` | Sitemap | Menus and landing |
|---|---|---|---|---|
| `false` | `noindex` | `noindex` (a `/cv/*.pdf` entry in the built `_headers`) | `/cv/` filtered out | No link |
| `true` | none | none | included | The site's top-level navigation gains "CV" in the PR that sets it |

A test builds a scratch copy each way and checks all four columns.

## Anchors (shared by the no-script page and the drill)

| Anchor | Element |
|---|---|
| `#cv` | The timeline section (the overview) |
| `#theme-<id>`, `#roles`, `#threads`, `#thread-<id>`, `#next` | A list |
| `#change-<id>`, `#role-<id>`, `#next-<id>` | A card |
| `#change-<id>-in-<list>` | A card reached through a list other than its theme (a thread); routed by the script, falls back to `#change-<id>` without it |
| `#value-<story-id>` | A value story in the value block |

Ids are the data's ids, so a shared link keeps working across imports.

## Downloads block

Each approved PDF: its title as the link text, "PDF", its size in KB, and "Last updated <d Mon yyyy>" from
its approval date. A kind with no file is left out, and validation warns.

## Contact block

The email in words, upgraded to a link by the script (R11); LinkedIn when `page.linkedin` is set; never a
phone number.
