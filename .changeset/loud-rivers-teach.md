---
"@savvy-web/silk": minor
---

## Features

### `/silk:dogfood` skill

A new skill for running a cross-repo "dogfood loop" — requesting, delivering, adopting, and iterating on changes from a sibling repo checkout (e.g. a package consumed via a temporary `file:` override) before anything is released. Supports `--init`, `--send <kind>`, `--status`, `--watch`, `--adopt`, and `--exit`, backed by a mailbox protocol (markdown mail files under `.claude/dogfood/`) and a per-loop JSONL state journal that tracks whose turn it is.

### Dogfood guard hook

A new `PreToolUse` hook denies `git push` and pull-request creation (via `Bash`, the GitKraken MCP, and the GitHub MCP) while a downstream dogfood loop has active `file:` overrides linked in, preventing a branch with unreleased local artifacts from being pushed or opened as a PR.

### Dogfood mail monitor

A new background monitor surfaces incoming `.claude/dogfood/` mail and journal turn-flips as they arrive.

## Maintenance

* Session-start orientation now mentions the new `/silk:dogfood` skill and the two active background monitors, adds an it2 terminal-control hint, and reminds agents to clean up idle sessions/panes they spawned.
