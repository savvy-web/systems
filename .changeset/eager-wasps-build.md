---
"@savvy-web/github-action-builder": minor
---

## Features

### Production mode pinned by default

`build:prod` now always pins rsbuild's mode to `"production"`, regardless of `NODE_ENV`. Previously, a bare local `build:prod` run without `NODE_ENV` set silently emitted an unminified build roughly 7x the size of the minified one, since rsbuild's mode falls back to `"none"` and minification only applies in production mode. Builds are now consistently minified whether or not the caller sets `NODE_ENV`.

If a workflow relied on the unminified fallback for local debugging, set `build.minify: false` explicitly to opt back out of minification.

## Bug Fixes

### License attribution no longer dropped under minification

License notices are now folded inline into the bundle instead of relying on `legalComments: "inline"`, which silently dropped third-party attribution once real minification ran. There is no longer a possibility of a `*.LICENSE.txt` sidecar file going missing from a committed action — attribution is preserved directly in the bundle output.
