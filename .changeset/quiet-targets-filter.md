---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Per-target release filter

The object form of `publishConfig.targets` gains two optional fields:

* `releases` — `"all"` (default), `"stable"`, or `"prerelease"`. A target receives only the versions its channel allows; a prerelease is any version with a SemVer prerelease suffix.
* `provenance` — `true` or `false` forces the provenance attestation on or off, overriding the registry-derived default.

```json
{
  "publishConfig": {
    "targets": {
      "npm": { "releases": "stable" },
      "github": { "releases": "prerelease", "provenance": false }
    }
  }
}
```

`resolveTargets` validates both fields and throws `ConfigValidationError` for an unknown `releases` value or a non-boolean `provenance`. Every `ResolvedTarget` in `dist/prod/targets.json` now always carries `releases`, plus `provenance` when declared.

### New exports

* `ReleaseChannel` type and `RELEASE_CHANNELS` constant
* `releaseWarnings(resolution)` returns advisory messages for a valid target set, such as one where every target is `releases: "prerelease"` and final versions publish nowhere

The build report's `DiagnosticEntry.source` gains a `"config"` value for advisory findings about the build config itself.
