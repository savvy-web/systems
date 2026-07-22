---
"@savvy-web/silk": minor
---

## Features

Added a `/silk:it2` skill for orchestrating iTerm2 panes and windows when
running subagents — pinned split-direction semantics, a layout heuristic for
matching pane geometry, grid recipes, badging, and dismiss-and-close
discipline for torn-down subagents. It drives the raw `it2` CLI directly and
does not require the separate `it2-skills` marketplace plugin.

## Bug Fixes

The SessionStart `<terminal>` orientation block now only renders when the
session is actually running in iTerm2 with the `it2` CLI on `PATH` (checked
from environment variables alone, with no `it2` subprocess invoked from the
hook). Previously the block appeared unconditionally, pointing users at the
`it2` CLI even in terminals where it wasn't installed or usable. When the
gate passes, the block also now teaches proactive pane orchestration for
spawned subagents and points to the new `/silk:it2` skill.
