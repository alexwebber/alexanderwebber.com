---
name: speckit-house-process-tips-shell
description: 'Agent tips for shell commands and processes: stopping servers safely, heredocs and backslashes, reading test output, Git Bash path rewriting, sed on Windows, User-Agents and re-reading settings. Read before starting or stopping a long-running process, writing files from a shell, or scripting gh.'
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Alex Webber
  source: house-process:commands/speckit.house-process.tips-shell.md
---

# Agent tips: Shell and processes

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Never `pkill -f` from an agent shell.** The pattern is part of the agent's own command line,
  so it can match and kill the agent's shell (exit 144), even with a specific pattern like
  `'astro preview --port 4321'` (alexanderwebber.com). Keep the PID from when the process was
  started, or find it by port (`ss -ltnp`, `Get-NetTCPConnection`), and kill that.
- **Always give `cat >` a heredoc or a source file.** With no input it waits on stdin until the
  call times out.
- **Filter a test run's output for its summary lines** (`passed|failed|flaky|skipped`), never a
  bare `tail`. `tail -12` once showed the end of a failure list plus the "passed" count, and 28
  failures were read as passes.
- **One preview or dev server at a time.** Stop your own before running end-to-end tests, or
  Playwright's `webServer` can fail to start.
- **Check the branch before committing** (`git rev-parse --abbrev-ref HEAD`), especially after a
  session handoff: another session may have switched the shared checkout.
- **Send a descriptive User-Agent from scripts and ingest clients.** Cloudflare-fronted APIs
  answered Python `urllib`'s default with a 403 HTML challenge. A 403 with an HTML body is a bot
  block, not an auth failure.
- **Write anything holding backslashes with the Write or Edit tool**, not a heredoc. The Bash
  tool turned `\\n` inside a quoted heredoc into `\n`, so Python string edits written that way
  put real newlines into a test file and broke it, and `C:\\temp` in a small inline script
  became a tab (alexanderwebber.com).
- **`sed -i` across a glob marks untouched files as modified on Windows with autocrlf.** It
  rewrites their line endings, so target only the files that match.
- **Git Bash rewrites a leading `/`:** `gh api /repos/...` becomes
  `C:/Program Files/Git/repos/...`. Write `gh api repos/...`, and pass native tools Windows-style
  paths (`cygpath -m`).
- **Re-read a setting after setting it.** `gh api -X PUT
  .../actions/permissions/fork-pr-contributor-approval -f approval_policy=...` answered 204 and
  changed nothing; the same body sent as JSON with `--input -` worked.
- **`python -I` also ignores user site-packages.** Isolated mode drops modules installed with
  `pip install --user` (PyYAML here). A script in a folder you created yourself doesn't need it.
- **PowerShell 5.1 mangles quotes in native arguments.** It strips embedded double quotes, so
  `python -c` with quotes fails, and a `gh --jq` expression containing `\(...)` loses its quotes
  (`gh` reports "unknown command"). Run those through Bash, or use a script file.
- **Write long Python scripts to a file, not `python - <<'EOF'`.** A long heredoc through the Bash
  tool failed with "unexpected EOF while looking for matching quote".
- **Keep `Remove-Item` out of chained PowerShell commands.** On a variable-built scratchpad path
  it was refused as a "system path", which rejected the whole call.
- **`sed -i` with `$(` or `|` in its pattern can silently not match** in Git Bash, while the file
  shows as modified with an empty diff (line endings). Use the Edit tool or a script file.
- **On a `core.autocrlf` checkout, normalise line endings before a scripted edit,** and expect a
  generator's LF output to show as modified until `git add`.
- **PowerShell 5.1's `Invoke-WebRequest` shows a UTF-8 `£` as `Â£`,** so a text pattern misses it
  and looks like a site bug. Check bytes, or use `curl`.
- **Retry a live-site check before calling the site down.** Node's `fetch` failed twice ("fetch
  failed") right after a long `gh` wait, while curl, and Node moments later, got 200. Retry a few
  times, about 10 s apart, and print the cause's code if all fail.