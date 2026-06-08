---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### Multi-target / renamed-package publishing

A single package can now dual-publish to npm, GitHub Packages, and custom registries — each with its own package name — from one build.

#### `@savvy-web/tsdown-plugins`

A new `src/targets/` derivation turns a package's `publishConfig.targets` into the set of byte-variant build groups to emit:

* `resolveTargets` resolves `publishConfig.targets` into the distinct groups to build and every registry target bound to one. `true` targets collapse into a single canonical base-name group; a string or `{ name }` override produces its own renamed group; `{ from }` reuses another group's bytes for an additional registry (no new build). Well-known `npm`/`github` keys carry default registries; custom keys require an explicit `registry`.
* `writeTargetsBinding` writes the resolved target→group binding to `dist/prod/targets.json` for the release pipeline.
* The build-group plumbing is now name-aware: `TargetGroupRef` carries the resolved name and the declarative rename is applied to `package.json.name` before the user `transform` runs. Group ids are now arbitrary strings (`npm`, `github`, or custom keys), not a fixed `dev`/`npm` pair.

New exports: `resolveTargets`, `writeTargetsBinding`, `isTargetObject`, `BuildGroupSpec`, and the types `PublishTargets`, `PublishTargetValue`, `PublishTargetObject`, `ResolvedGroup`, `ResolvedTarget`, and `TargetResolution`.

#### `@savvy-web/bundler`

* `savvy build --target prod` now derives every prod byte-variant group from `publishConfig.targets`, builds each into `dist/prod/<group>/pkg` with the correct per-registry name, and writes the `dist/prod/targets.json` binding.
* With no `publishConfig.targets` declared, the build defaults to a single `npm` group named after the package — fully backward-compatible.
* Re-exports the target and resolved types from `@savvy-web/tsdown-plugins` for consumers.
