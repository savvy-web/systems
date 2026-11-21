---
"@savvy-web/silk-effects": minor
---

## Features

`ReposManager.sync` accepts an optional `onStep` that reports per-repo progress: a `Started` step naming every manifest entry, then `RepoStarted` and `RepoSynced` for each repo, where `RepoSynced` fires once that repo is on disk and locked again and carries the actions it took. A caller can report what already landed if a later repo fails. The returned report is unchanged. The new `ReposSyncStep`, `ReposSyncAction` and `ReposSyncOptions` types are exported from the `Repos` namespace.
