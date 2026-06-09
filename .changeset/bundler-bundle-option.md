---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### `defineBuild({ bundle })` force-inline option, and leaner externalization

`defineBuild` gains a `bundle` option: an array of package names to force-bundle (inline) into the JS output, even declared dependencies that tsdown would otherwise auto-externalize. It is the inverse of `externals` and maps to tsdown's `deps.alwaysBundle`. It coexists with `externals` and `bundleNodeModules`. Declarations are not inlined by this option — use `bundledPackages` to also roll a package's types into the emitted `.d.ts`. Threaded through `runBuild` into `buildTargetGroups`' JS pass.

Also drops redundant `externals` lists across the workspace: tsdown already auto-externalizes everything declared in `dependencies`/`peerDependencies`/`optionalDependencies`, so only genuinely undeclared transitive packages need explicit externalization (`@effect/cluster`/`@effect/rpc`/`@effect/sql` for github-action-effects, `source-map-support` for silk). The emitted output is unchanged — this is purely configuration cleanup.
