---
"@savvy-web/silk": minor
---

## Features

### Simultaneous Loops Against One Counterpart

The dogfood journal is now `.claude/dogfood/<counterpart-id>[.<loop-id>].jsonl`, so a counterpart can host two concurrent loops without their state streams colliding. Mail frontmatter gains an optional `loop:` key that routes an inbound file to the matching journal; omitting it preserves the existing single-loop behavior.

Mail that names no loop -- either carrying no `loop:` key, or naming one no journal answers to -- belongs to the counterpart rather than to any single loop, so it is judged against the earliest watermark among that counterpart's OPEN loops and recorded against every one of them. A loop closed by `--exit` keeps its journal but stops lowering that bar. Once every loop for a counterpart has closed the rule inverts to the highest of their watermarks, so nothing they already processed is re-announced while a fresh request arriving on a finished collaboration still is -- that alert is how a session learns the counterpart wants to reopen. An archive from a previous collaboration is never re-announced when a second loop opens, and a loop never re-alerts on mail the monitor has already surfaced -- including a loop opened after that mail arrived.
