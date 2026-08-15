---
"@savvy-web/cli": minor
---

## Features

### savvy repos deregister

New `savvy repos deregister <section>` subcommand clearing a stale `submodule.<section>` registration from the local git config — the orphan case `savvy repos status --drift` reports, whose stated remedy previously required a raw `git config --remove-section`. Every failure is real (exit 1): a section still backing a live manifest entry is refused, and an unregistered section fails typed as nothing-to-deregister. Nothing is staged afterwards, since the local config is unversioned.
