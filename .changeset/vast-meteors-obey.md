---
"@savvy-web/silk": minor
---

## Features

### Simultaneous Loops Against One Counterpart

The dogfood journal is now `.claude/dogfood/<counterpart-id>[.<loop-id>].jsonl`, so a counterpart can host two concurrent loops without their state streams colliding. Mail frontmatter gains an optional `loop:` key that routes an inbound file to the matching journal; omitting it preserves the existing single-loop behavior.

Mail that names no loop -- either carrying no `loop:` key, or naming one no journal answers to -- belongs to the counterpart rather than to any single loop, so it is judged against the earliest watermark among that counterpart's OPEN loops and recorded against every one of them. A loop closed by `--exit` keeps its journal but stops counting, and a counterpart whose loops have all closed goes quiet rather than replaying its archive. An archive from a previous collaboration is never re-announced when a second loop opens, and a loop never re-alerts on mail the monitor has already surfaced -- including a loop opened after that mail arrived.
