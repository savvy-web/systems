---
"@savvy-web/mcp": minor
---

## Features

### `repos_inspect` and `repos_manage` tools

Adds two tools for the vendored `.repos/` reference-repo pattern, bringing the server to ten tools (three mutating):

- `repos_inspect` (read-only) — `mode: "status"` returns a drift report (presence, dirtiness, stale notes per repo); `mode: "config"` returns the full parsed manifest, including purposes, orientation, and notes.
- `repos_manage` (mutating) — `action: "sync" | "pin" | "add" | "note"` against the vendored submodules, using a flat wire schema (no `oneOf`) that decodes into a per-action request internally, naming the first missing required field on failure. The `pin` result surfaces `commitMessage` and `staleNoteIds` as an explicit review-and-commit cue.

Both tools render vendored-repo content (names, refs, purposes, note text) as escaped inline code spans in their markdown transcript, since that content originates from an external, untrusted source.
