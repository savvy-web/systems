---
"@savvy-web/cli": minor
---

## Features

`savvy` now renders its output for whoever is reading it, with new global flags to choose the audience explicitly:

```bash
savvy check --agent        # plain text, never an escape sequence
savvy check --human        # ANSI colour and links at a terminal
savvy check --ci           # GitHub Actions log formatting
savvy check --audience ci  # equivalent long form
```

- The audience is detected automatically (a terminal, an agent, or CI) and can be forced with `--audience <human|agent|ci>`, `--human`, `--agent`, `--ci`, or the `SAVVY_AUDIENCE` environment variable.
- Output is ANSI for a person, plain text for an agent or a pipe, and a GitHub Actions log under Actions. It never wraps when piped.
- Set `SAVVY_LOG_LEVEL` to opt in to diagnostic logging on stderr.

## Other

- The summary line now reads like `3 ok, 1 warning, 2 failed`.
- The skip glyph is now `↷`.
- A defect's report now uses a cleaned stack trace followed by the link for filing an issue.
- The stdout/stderr split, exit codes, and `--json` output are unchanged.
