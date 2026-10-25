# Security policy

alexanderwebber.com is a personal site: a static Astro build on Cloudflare Workers, fed by
scheduled GitHub Actions jobs that pull running data from intervals.icu. Only the latest
`main` is supported; it is what's live.

## Reporting a vulnerability

Please report privately through GitHub: on this repo's **Security** tab, choose **Report a
vulnerability**. Don't open a public issue or pull request for a security problem.

A useful report says what is affected, how to reproduce it and what an attacker could do with
it. You'll get a reply within a week. This is a one-person project with no bug bounty.

## What's in scope

- **The live site and its Worker**: `alexanderwebber.com`, `www.alexanderwebber.com` and the
  freshness endpoint `/running/api/freshness`.
- **The pipeline**: the workflows in `.github/workflows/`, the ingest package in `ingest/` and
  the build gate's scripts in `scripts/`. For example, a way for a pull request from a fork to
  reach a secret, write to `main` or deploy.
- **Privacy leaks**: anything published that the site means to keep private, such as a GPS
  trace or location from a training run, a provider's activity ID, or a secret in the repo,
  its history or the Actions logs. The site's privacy rules are in the README's
  [Privacy by design](README.md#privacy-by-design) section.

Out of scope: problems in third-party services themselves (intervals.icu, Garmin, Cloudflare,
GitHub, OpenFreeMap), denial-of-service or volume testing, and automated scanner output with no
demonstrated impact.
