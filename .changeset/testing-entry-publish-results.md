---
"@savvy-web/github-action-effects": patch
---

## Bug Fixes

The `./testing` entry point now exports `DryRunResult` and `PublishTarballResult`. Both `PackagePublish` result types were already exported from the main entry but were missing from `./testing`, which re-exports the `PackagePublish` tag whose method signatures reference them — so API Extractor flagged them as forgotten exports of the `testing` entry (a CI-fatal build warning). The `testing` entry's public surface now matches the main entry.
