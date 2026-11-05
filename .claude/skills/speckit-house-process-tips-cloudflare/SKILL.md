---
name: speckit-house-process-tips-cloudflare
description: 'Agent tips for Cloudflare: moving nameservers, Worker custom domains and token permissions, workers.dev certificates, 404 pages with static assets, Worker entry exports, Real User Monitoring, and least-privilege CI deploy tokens. Read before DNS, Workers, R2 or Cloudflare token work.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-cloudflare.md
---

# Agent tips: Cloudflare

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Moving a domain's nameservers:** first read its records (A, MX, TXT, `www`) and the
  registry's DS record, so you know what to carry over and whether DNSSEC is on. Confirm the
  change at the TLD server (`nslookup -type=NS <domain> a.gtld-servers.net`), not a public
  resolver, which keeps the old answer for up to 48 h. The flow is *Add a domain → Connect a
  domain* (not Transfer). Do the read-only checks before the owner touches the registrar, then
  walk them through it screen by screen.
- **A Worker custom domain needs only Workers Scripts Write** on the API token, whatever search
  results say about DNS Edit. Check an endpoint's own permissions before widening a token.
- **A new workers.dev subdomain's certificate takes a few minutes**; requests fail TLS (curl
  exit 35) until it's ready.
- **Add a 404 page at go-live.** Workers static assets answer a missing address with an
  empty-body 404 by default, so mistyped links showed a blank page. Add the page and
  `assets.not_found_handling: "404-page"`. With a Worker, browser navigations to unmatched paths
  then skip it (an API path opened in the address bar shows the 404 page), while `fetch()` and
  curl still reach it, so add `assets.run_worker_first: ["/api/path/*"]` for the Worker's
  paths. Check with `wrangler dev` and a `Sec-Fetch-Mode: navigate` header.
- **Keep a Worker entry module's exports to handlers.** Local `wrangler dev` refused an entry
  that also exported string constants ("Incorrect type for map entry"), although production
  deployed it. Put shared constants in another module.
- **A new zone may turn on Real User Monitoring by default**, injecting a third-party beacon
  (`static.cloudflareinsights.com`) for visitors outside the EU and UK only. Nothing in the
  dashboard showed it as on, and fetches from the UK never saw it; a production Lighthouse run
  from a US runner caught it. After attaching a domain, check the live HTML from outside Europe
  (a throwaway branch workflow), and turn RUM off in *Speed → Observatory* if the site promises
  no third-party requests.
- **The "Edit Cloudflare Workers" token template is far too broad for CI deploys.** It includes
  admin read and write on every R2 bucket (it shows up in R2's token list), plus KV, Pages and
  more. A custom token with Workers Scripts Edit, Workers R2 Storage Read (only for an R2
  binding), and Workers Routes Edit and Zone Read on the zone deployed a Worker with custom
  domains and a cron. Test it first with read-only API calls.