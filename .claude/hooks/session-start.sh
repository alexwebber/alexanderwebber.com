#!/bin/bash
# SessionStart hook for Claude Code cloud sessions (does nothing in local sessions): installs the
# Node and Python dependencies and makes Playwright's browser usable, so tests, the gate and
# Playwright run from the first message. Each install runs only when a file that decides it has
# changed since it last succeeded. Needs no secrets.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
# Install logs go to stderr, so they stay out of the session's context.
exec >&2

# Node dependencies, as CI installs them (npm ci keeps package-lock.json untouched).
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm ci --no-audit --no-fund
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi

# Python ingest dependencies, as tests.yml installs them.
hashes=ingest/.venv/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  (cd ingest && uv sync --locked)
  sha256sum .claude/hooks/session-start.sh ingest/pyproject.toml ingest/uv.lock > "$hashes" || rm -f "$hashes"
fi

# Generated types are gitignored and follow the schemas; quick, so every session.
npm run --silent gen-types

# Playwright: the image's preinstalled Chromium can be an older build than the pinned
# @playwright/test wants, and `playwright install` must not run here. Link each wanted build name
# to the newest preinstalled build of the same browser. Does nothing once the wanted build exists.
python3 - "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" <<'PY'
import json, os, re, sys
root = sys.argv[1]
spec = "node_modules/playwright-core/browsers.json"
if not os.path.isdir(root) or not os.path.exists(spec):
    sys.exit(0)
for b in json.load(open(spec))["browsers"]:
    if b["name"] not in ("chromium", "chromium-headless-shell"):
        continue
    prefix = b["name"].replace("-", "_") + "-"
    want = os.path.join(root, prefix + b["revision"])
    if os.path.exists(want):
        continue
    have = [d for d in os.listdir(root)
            if re.fullmatch(re.escape(prefix) + r"\d+", d) and not os.path.islink(os.path.join(root, d))]
    if not have:
        print(f"session-start: no preinstalled {b['name']} to link", file=sys.stderr)
        continue
    newest = max(have, key=lambda d: int(d.rsplit("-", 1)[1]))
    os.symlink(os.path.join(root, newest), want)
    print(f"session-start: linked {os.path.basename(want)} -> {newest}", file=sys.stderr)
PY
