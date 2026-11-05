---
description: "Agent tips for handling secrets: never printing a secrets file's lines, taking secrets from a file, no PowerShell pipes into gh secret set, and keeping throwaway probes to what they may print. Read before reading, checking or setting any token, key or credential."
---

# Agent tips: Secrets

Technical lessons for the coding agent in this area, each naming the project that learned it.
Read them before working here. A new lesson in this area goes to the project's *Upstream
candidates* in the moment, and the lesson harvest adds it here.

- **Never print any part of a secrets file's lines.** A shape check that assumed `KEY=value`
  printed whole `Key: value` lines as "keys", leaking four credentials into the transcript.
  Print line numbers, a fixed label for known keys, and value lengths only. Treat a line you
  can't parse as unparsed, not as a key.
- **Secrets helpers accept a file path** as well as a hidden prompt (owners often prefer a temp
  file). Shape-check it without echoing, set the secrets, and remind the owner once to delete it.
- **Never pipe a secret from Windows PowerShell 5.1.** It adds a BOM to a native program's stdin,
  so `$key | gh secret set NAME` stored U+FEFF before the value. `gh` reports success and a
  secret can't be read back, so only its first real use showed it: a `UnicodeEncodeError` sending
  the header on Actions, while the local copy worked. Use `gh secret set NAME --body $value`, or
  a BOM-less file with Bash's `<`.
- **"Print only X" throwaway scripts drift.** A keys-only probe of a live API also printed value
  types and a status code. No value leaked, but write the print statement to exactly what the
  rule allows.
