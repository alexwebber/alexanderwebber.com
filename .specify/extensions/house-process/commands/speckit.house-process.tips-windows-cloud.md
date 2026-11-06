---
description: "Agent tips for Windows and cloud test environments: symlinks and junctions, running bins with node not npx, Playwright's webServer from Git Bash, sharp's file cache, MSYS_NO_PATHCONV paths, removing worktrees and junctions, watchers that outlive the editor, and cloud sessions (set-up hooks, no pwsh, browser builds, pushing only to their own branch). Read before writing cross-platform scripts or test helpers, or running suites on Windows or in a cloud session."
---

# Agent tips: Windows and cloud test environments

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Symlinks need a privilege on Windows** (WinError 1314). Test helpers should fall back to a
  directory junction (`_winapi.CreateJunction`; Node `symlinkSync(..., 'junction')`). When a
  project alternates between cloud and local sessions, run the full suites locally on return.
- **Run a package's bin with `node`, not `npx`,** in cross-platform Node scripts.
  `spawn('npx', ...)` fails with ENOENT on Windows, and `shell: true` splits quoted arguments
  and makes `child.kill()` stop the shell rather than the server.
- **Playwright's `webServer` from the agent's Git Bash tool is unreliable.** It once failed to
  start from Git Bash (exit code 3221226505) where PowerShell worked, and later started fine from
  Bash (Playwright 1.64.1, 174 passed). If it exits early from Bash, run it from PowerShell.
- **Call `sharp.cache(false)` in tests that write images to temp folders.** sharp's file cache
  keeps the files open on Windows, so the temp folder can't be deleted (EPERM). For a read-only
  check in a process that later deletes the file, pass `readFileSync(path)`, not the path: the
  cache (up to 20 files) holds a path open until the process exits, and retries don't help.
- **With `MSYS_NO_PATHCONV=1`, pass Windows-style `C:/...` paths.** Turning conversion off (to
  pass URL paths like `/running/...` to node) also stops `/c/Users/...` being converted, so node
  resolved it to `C:\c\Users\...` and a script wrote into a stray `C:\c\` tree.
- **`git worktree remove --force` can fail with "Permission denied" yet unregister the
  worktree.** PowerShell's `Remove-Item -Recurse -Force` on the literal path, alone in its call,
  removes the rest.
- **To remove a scratch folder holding a junction, delete the junction first** with
  `cmd /c rmdir`: a recursive delete could reach the junction's target.
- **A watcher that must outlive the editor starts through WMI** (`Invoke-CimMethod Win32_Process
  Create`). `Start-Process` from the agent's shell sits in VS Code's process tree and may be
  killed with it. A watcher waiting for VS Code to close can wait forever: its `Code` processes
  had run for weeks, through window closes and reopens. Ask the owner to quit with File > Exit,
  and check that no `Code` process remains.
- **Set up cloud sessions with a SessionStart hook committed to the repo** (gated on
  `CLAUDE_CODE_REMOTE`, installs gated on lockfile hashes) rather than the environment's setup
  script: it's versioned and reviewed in a PR, and needs no settings screen. Only the network
  allowlist still needs the owner.
- **A cloud image may have no `pwsh`,** so Spec Kit's PowerShell prerequisite scripts can't run
  there. Take the feature folder from `.specify/feature.json` instead.
- **A cloud image's preinstalled Chromium may not match the project's Playwright.** Build 1243
  was installed where Playwright 1.64.1 wanted 1248; symlinking `/opt/pw-browsers/chromium*-1248`
  to the 1243 folders ran the whole suite without `playwright install`.
- **A cloud session may push only to its own branch,** so PR screenshots can't use a side branch:
  add them in one commit, link them by that SHA, and remove them in the next. Convert to WebP
  first (1.6 MB of PNG became 420 KB).
