---
"@savvy-web/silk-effects": major
---

## Breaking Changes

### Publish-target resolution is binding-driven and Record-map only

`SilkPublishability` no longer understands the legacy array form of `publishConfig.targets` — declare targets as the keyed Record-map (`{ npm: true, github: true, … }`). Target resolution now matches the `@savvy-web/bundler` prod layout:

- `SilkPublishability.detect(pkgName, raw, binding)` takes a third argument: the parsed `dist/prod/targets.json` binding (or `null` before the prod build). With a binding it emits one `PublishTarget` per resolved registry target, with `directory` set to the bound group's `dist/prod/<group>/pkg` dir. `npm: true` + `github: true` collapse into one scoped-name byte group deployed to both registries (two targets, one directory). Without a binding it emits one count-accurate placeholder per declared key.
- `access` comes from top-level `publishConfig.access` (default `public`); per-target `access`/`provenance`/`directory` and string shorthands are removed (`provenance` defaults `false`).
- New public API: `readTargetsBinding(fs, pkgPath)` and the binding types `TargetsBinding` / `TargetBinding` / `TargetGroupBinding`. Removed `RawTargetSpec`, replaced by `RawTargetObject` / `RawTargetValue` / `RawPublishTargets`.
- Both `PublishabilityDetector` layers and `SilkWorkspaceAnalyzer` thread the binding through.

## Features

- Adds the `Turbo` read-only Turborepo inspection namespace (`TurboInspector` + `TurboDigest` exposing `diagnoseCache`/`taskGraph`/`affected`, all `--dry`).

## Build System

- Now built with `@savvy-web/bundler`.
