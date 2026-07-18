---
"@savvy-web/silk": patch
---

## Bug Fixes

Hardens the bundled `changeset-manager` agent so it no longer stalls or silently drops files when dispatched without an interactive surface.

* The `AskUserQuestion` step is now conditional — it asks when the tool is available and otherwise escalates genuinely ambiguous files to the dispatching agent via `SendMessage` instead of silently excluding them.
* A brand-new workspace package is treated as a first-class content changeset with its own single-package `minor` entry, and the content pass now runs before the dependency pass so a new package is announced before any dependency edge that references it.
* The report step now enumerates every changed package that received no changeset along with the rationale, so an early stop can never be mistaken for "nothing needed".
