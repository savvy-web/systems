---
"@savvy-web/bundler": minor
---

## Features

### `define` option on `defineBuild`

Pass compile-time global replacements directly from `defineBuild`. The values are forwarded verbatim to the underlying tsdown/rolldown `define` — string literals must be pre-quoted:

```ts
import { defineBuild } from "@savvy-web/bundler";

export default defineBuild({
  define: {
    "process.env.FLAG": JSON.stringify("on"),
    "process.env.API_URL": JSON.stringify("https://api.example.com"),
  },
});
```

User-supplied keys are merged with the auto-injected `process.env.__PACKAGE_VERSION__` define; when a user key collides with the auto-version key, the user value wins.

### `meta` is now optional — `savvy build --target meta` works without configuration

The `meta` option is now tri-state. Omit it (or leave it `undefined`) and api-model generation runs with default options: `savvy build --target meta` works out of the box and `savvy build --target prod` emits the meta release asset. Pass an object only to override defaults (`localPaths`, `tsdoc`). Pass `false` to opt out entirely — both targets become no-ops:

```ts
export default defineBuild({
  // omit meta entirely  -> generate with defaults
  // meta: { localPaths: ["../models"] }  -> override defaults
  meta: false, // -> skip api-model generation on both --target meta and --target prod
});
```

Previously an empty `meta: {}` object was required just to make `--target meta` runnable — omitting it threw `requires a 'meta' option`. That boilerplate is gone.

## Bug Fixes

The auto-injected package version define previously used the bare identifier `__PACKAGE_VERSION__` as its key. rolldown only replaces `define` keys when the source contains a literal token match, so a bare identifier key never matched the `process.env.__PACKAGE_VERSION__` member expression that packages actually read. The key is now `process.env.__PACKAGE_VERSION__`. Packages whose source reads `process.env.__PACKAGE_VERSION__` (including `@savvy-web/cli` and `@savvy-web/github-action-builder`) previously shipped with the version unreplaced and reported `0.0.0` at runtime; they now report the real version.
