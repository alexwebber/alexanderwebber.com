---
name: speckit-house-process-tips-privacy-pipelines
description: 'Agent tips for privacy and data pipelines: checks that report position and rule never the value, dry-running aggregate reports, versioned cache keys, shared fixtures across languages, running a new published field through the full gate, versioned raw bundles, approval hashes, scans over prose, first-match scanners, values leaking through error messages, and YAML aliases that throw. Read before writing an ingest stage, a scan or validator, or anything that prints data in CI.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-privacy-pipelines.md
---

# Agent tips: Privacy and data pipelines

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Checks report position and rule, never the value.** A privacy scan printing context around
  a match, and jsonschema messages quoting the offending value, would both put unpublished data
  into CI logs. Report `file:line:column` and the rule.
- **Dry-run an "aggregates only" report on fixtures and read its output** before it touches real
  data. `Counter.update(record)` adds a mapping's *values*, so a "key count" printed every date
  and summed health values into an Actions log. Count keys with `update(d.keys())`.
- **Put a code or processor version in every incremental cache key.** Keyed on input hashes
  alone, a processor change never reached already-processed data without a manual full rerun.
- **When two languages share data formats, pin the behaviour and test with shared fixtures.**
  PyYAML is YAML 1.1 (`3:30:00` becomes 12600, dates become dates), while JS `yaml` 2.x is 1.2;
  pin both to one version. Python's jsonschema ignores the `discriminator` keyword that ajv
  honours; compare both validators' error output on shared invalid fixtures, not just
  pass/fail. ajv's `schemaPath` restarts at every `$ref`, so group branch errors by emit order,
  not path prefix.
- **Run a new published field through the full gate before the PR.** A new field passed every
  local check, then failed the privacy scan on its first real publish (a reserved `name` key),
  because the local published data still had the old shape and the scan never saw it. Put a
  sample of the new shape into a real data file temporarily, run validate, build and the privacy
  scan, then remove it.
- **Version the raw bundle layout in each item's fetch marker.** When an adapter adds a raw part,
  the fetch stage can then top up older items with just the new part (one call per item), rather
  than re-importing all history. For 200 runs that was about 7 minutes instead of an hour of
  Actions minutes.
- **Record exactly what an approval hash covers** (byte range, line endings, trailing newline),
  or keep the script that made it. A story's private hashes couldn't be reproduced a day later,
  and only the files' modified times showed the text was unchanged.
- **A scan that prints its matched excerpt quotes free text when run over prose.** Redact the
  findings in prose files before a scan's output reaches a public log.
- **A scanner that reports only a rule's first match per file** proves one case in a test that
  plants two in one file. Plant each alone, then both.
- **An error layer that prefixes the offending value leaks free text through schema errors.**
  Drop the value for approved text; only a sentinel test across schema-invalid cases caught it.
- **The JS `yaml` library throws, rather than reports, on an alias naming no anchor,** and the
  message quotes the name. In prose, Markdown emphasis at the start of a value (`*word*`) is such
  an alias, so a stack trace carried a word of private text. Walk the document with `visit()`
  before `toJS()`, and report each unresolved alias by line.