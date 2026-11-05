---
description: "Agent tips for Windows and cloud test environments: symlinks and junctions, running bins with node not npx, Playwright from PowerShell, sharp's file cache, and MSYS_NO_PATHCONV paths. Read before writing cross-platform scripts or test helpers, or running suites on Windows or in a cloud session."
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
- **Run Playwright from PowerShell, not the agent's Git Bash tool.** Its `webServer`
  (`npm run preview`) failed to start from Git Bash (exit code 3221226505); the same command
  from PowerShell worked.
- **Call `sharp.cache(false)` in tests that write images to temp folders.** sharp's file cache
  keeps the files open on Windows, so the temp folder can't be deleted (EPERM).
- **With `MSYS_NO_PATHCONV=1`, pass Windows-style `C:/...` paths.** Turning conversion off (to
  pass URL paths like `/running/...` to node) also stops `/c/Users/...` being converted, so node
  resolved it to `C:\c\Users\...` and a script wrote into a stray `C:\c\` tree.
