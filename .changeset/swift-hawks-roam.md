---
"@savvy-web/github-action-builder": minor
---

## Features

### `build.nativeDynamicImports` option

Adds `build.nativeDynamicImports?: string[]` (defaults to `[]`) to keep a listed package's fully dynamic `import(...)` calls as native `import()` at runtime instead of letting rspack compile them into a context module.

rspack cannot statically analyze a dynamic `import(expr)` whose argument isn't a string literal — e.g. `@changesets/apply-release-plan`, which resolves a changelog module path at runtime and dynamically imports it. Instead of bundling the call, rspack emits an empty-context stub that throws `Cannot find module` at runtime even though the target file exists on disk, with a build-time "Critical dependency: the request of a dependency is an expression" warning as the tell.

Listing a package's name in `build.nativeDynamicImports` routes its bundled source through a new rspack loader (shipped from `public/loaders/webpack-ignore-dynamic-imports.cjs`) that injects a `/* webpackIgnore: true */` comment into any dynamic `import(` call whose argument isn't a string literal or already commented. rspack respects that comment and leaves the call as a plain runtime `import()`, so the module resolves for real instead of hitting the context-module stub.
