---
"@savvy-web/silk": minor
---

## Features

### `.repos/` support: Biome exclusion, orientation hook, write guards, and skill

The Biome preset now excludes `**/.repos` from processing, so vendored repo content stays searchable by other tools without ever being gitignored or reformatted.

The bundled Claude Code plugin gains full support for the vendored-repos pattern:

- A session-start hook that runs a best-effort `savvy repos sync` and injects a per-repo orientation block (purpose, layout, key paths, notes) into context on every session start, resume, and compact — budgeted at 2000 characters, with per-repo entries falling back to a one-line summary once the budget is exceeded.
- Three `PreToolUse` write guards for `.repos/**`: a hard-deny for file-editing tools (with `.repos/config.json` itself exempted), and best-effort tripwires over Bash and MCP git-style tools — enforcing that vendored repos stay read-only-by-convention.
- A new `/silk:repos` skill covering when to vendor a repo, sparse-checkout discipline, the re-pin-on-dependency-bump rule, and the orientation/notes editorial policy. Auto-loads whenever `.repos/config.json` is present.
