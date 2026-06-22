---
"@savvy-web/templates": patch
---

## Documentation

Added `@public` release tags to all public-surface exports across the templates library (`BiomeOptions`, `ChangesetOptions`, `GitignoreOptions`, `PackageJsonOptions`, `PnpmOptions`, `ReadmeOptions`, `TsconfigOptions`, `TurboOptions`, `VscodeOptions`, `WorkspaceOptions`, and supporting types). Clears 36 `ae-missing-release-tag` diagnostics from the API Extractor pass without changing any runtime behavior.
