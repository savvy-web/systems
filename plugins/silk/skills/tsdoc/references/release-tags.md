# Release tags

Every exported declaration in a package with an API model **must** carry exactly one release tag, or API Extractor emits `ae-missing-release-tag`. This repo uses a **binary policy** — apply it mechanically:

| Situation | Tag |
| --- | --- |
| Reachable from the package entry and meant for consumers to use | `@public` |
| Only leaks into the rollup — a helper type referenced by a public signature but not meant to be used directly | `@internal` |

`@internal` removes the symbol from the public API surface (and the generated docs). `@beta` and `@alpha` exist but are a **deliberate human signal** to mark an unstable surface. Do not guess a maturity tier; default to `@public` for real API and `@internal` for leaks.

## Where the tag goes

Put the release tag in the TSDoc block of the **exported declaration**, conventionally last:

```ts
/**
 * Resolves the publish target for a package.
 *
 * @param pkg - the parsed package manifest
 * @returns the resolved target, or `null` when private
 * @public
 */
export function resolveTarget(pkg: PackageJson): Target | null { /* ... */ }
```

For a re-exported symbol, tag the original declaration, not the `export { ... }` line.

## Decision tree

1. Is the symbol exported from a path listed in the package's `exports`/entry? If no → it is not part of the surface; no tag needed (and it should not be triggering the warning).
2. Is it intended for consumers to call/construct/extend? Yes → `@public`.
3. Is it exported only because a `@public` signature references it (a parameter, return, or generic type) but consumers should not use it directly? → `@internal`.
4. Do you, a human, want to ship it as explicitly unstable? → `@beta` (or `@alpha` for earlier). Agents stop at steps 2–3.

## Interaction with `ae-forgotten-export`

When a `@public` signature references an **unexported** type, you get `ae-forgotten-export`, not a release-tag warning. The fix is an API-surface decision (see `diagnostics.md`): either export the type and tag it `@public`, or, if it should stay private, mark the referencing member or the type `@internal` — leaving it unexported is not enough, since the public rollup still pulls it in.
