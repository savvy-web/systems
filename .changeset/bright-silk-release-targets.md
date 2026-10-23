---
"@savvy-web/silk-effects": minor
---

## Features

### Per-target release filter

`RawTargetObject` and `TargetBinding` gain `releases` (`"all" | "stable" | "prerelease"`) and `provenance` (boolean). A `provenance` declared on a binding or target object now overrides the registry-derived default in `SilkPublishability.detect`.

New `SilkPublishability` statics:

* `resolveReleaseTargets(pkg, version)` — every resolved publish target judged against a specific version, each with its target key, `releases` channel, whether it `receives` the version, and the dist-tag. A filtered target is returned with `receives: false`, not dropped; no `receives: true` entry means the version publishes nowhere, which is not an error.
* `distTagFor(version)` — `latest` for a final version, otherwise the first prerelease identifier (`next` when it is numeric or empty)
* `isPrerelease(version)`
* `receives(releases, version)`

New exported types: `ReleaseChannel` and `ReleaseTarget`.

The filter deliberately runs outside `PublishabilityDetector`, so a package whose only target skips a given version still counts as publishable for the kit's `VersioningStrategy`.
