---
"@savvy-web/mcp": minor
---

## Features

`repos_manage` action `add` accepts an `orientation` argument, so the block a preceding `remove` reported can be handed straight back and a re-vendor is lossless in one call.

`action: "remove"` echoes the removed entry's orientation block verbatim as JSON, because `add` does not resurrect it and a re-vendor otherwise loses it silently.

`action: "sync"` renders a `Boundary marked` section, and `action: "restore"` renders a `Still dirty` section when it is non-empty. The latter is deliberately omitted when empty: a standing empty heading on every clean restore trains a reader to skip past the one section that matters.
