---
"@savvy-web/silk": patch
---

## Bug Fixes

- The `changeset-manager`, `tsdoctor`, and `turborepo` plugin agents now include `SendMessage` in their `tools:` frontmatter, so when dispatched as teammates they can report results back to the orchestrator and answer a `shutdown_request` instead of idle-looping until the session ends.
