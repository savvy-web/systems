---
"@savvy-web/silk": minor
---

## Features

### Simultaneous Loops Against One Counterpart

The dogfood journal is now `.claude/dogfood/<counterpart-id>[.<loop-id>].jsonl`, so a counterpart can host two concurrent loops without their state streams colliding. Mail frontmatter gains an optional `loop:` key that routes an inbound file to the matching journal; omitting it preserves the existing single-loop behavior.

Mail that carries no `loop:` key in a mailbox serving several loops is judged against the earliest watermark among that counterpart's journals, so an archive from a previous collaboration is never re-announced when a second loop opens.
