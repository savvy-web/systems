---
"@savvy-web/github-action-effects": major
---

## Breaking Changes

- The library targets `effect@4` and peers on `catalog:effectPeers` for `effect` and `@effect/platform-node`; the `@effect/platform` peer is dropped. Consuming action repositories must move to the v4 runtime.
- All 39 services convert from `Context.Tag` to class-based `Context.Service`, each exporting a companion `*Shape` interface.
- Several v4 behaviours change observable contracts: `Config.ConfigError` no longer distinguishes invalid from missing data, `PlatformError` exposes only a `message` getter, and `NumberFromString`/`DateFromString` no longer reject non-conforming input.

## Other

- The HTTP client surface moves to `effect/unstable/http`, the retry subsystem moves onto `Effect.retry` option objects, streams adopt `Stream.paginate`, and `jsonc-effect`/`semver-effect`/`yaml-effect` swap to their `@effected` successors.
