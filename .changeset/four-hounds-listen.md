---
"@savvy-web/bundler": major
---

## Breaking Changes

No source changes, but the package's `effect` dependency moves from `^3.21.4` to `4.0.0-beta.98` (a regular dependency, so v4 lands in every consumer's tree), and `@effect/platform-node` moves to the matching v4 release. `defineBuild`/`runBuild` and the CLI contract are unchanged, but the public type surface re-exports roughly twenty `@savvy-web/tsdown-plugins` types, which are now Effect v4 types — consumer type graphs see the same major-version flip that `@savvy-web/tsdown-plugins` shipped.

Consumers on Effect v3 (`catalog:silk`) need to migrate to v4 (`catalog:effect`) before upgrading.
