---
"@savvy-web/silk-effects": minor
---

## Features

### `Repos` namespace: vendored reference repos

Adds a new public `Repos` namespace for managing vendored reference repos under a project's `.repos/` directory — git submodules kept purely as read-only agent authorities, never forks to modify.

```ts
import { Repos } from "@savvy-web/silk-effects";

const report = yield* Repos.ReposManager.status(root);
// report.clean, report.repos[].{ name, ref, purpose, present, commit, dirty, staleNoteIds }
```

The manifest lives at `.repos/config.json`. Each entry (`Repos.RepoEntry`) declares a `url`, a pinned `ref`, a required `purpose`, optional `sparse` checkout paths, an optional `orientation` block (`layout`, `keyPaths`, `startHere`), and up to ten agent-authored `notes` — each stamped with a content-hash `id` and the ref it was written against.

Two services back the namespace:

- `Repos.ReposConfigStore` — reads, validates, and writes the manifest.
- `Repos.ReposManager` — drift reporting (`status`), idempotent self-healing sync that clears stale git lock files before reinitializing a submodule (`sync`), staging a new vendored repo with a shallow ref fetch (`add`), re-pinning an existing entry to a new ref (`pin`), and adding, removing, or promoting agent notes (`note`). `add` and `pin` stage their changes and hand back a ready-made commit message rather than committing.

A missing manifest is a distinct, non-error `ReposConfigError` kind (`"missing"`) from a corrupt one (`"invalid"`), so callers can render the common "nothing vendored yet" case as a friendly no-op.

## Maintenance

The generated markdownlint template now ignores `**/.repos`, so vendored submodule content is excluded from lint runs in projects that adopt the pattern via `savvy init`'s union-merge.
