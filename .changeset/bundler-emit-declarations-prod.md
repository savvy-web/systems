---
"@savvy-web/bundler": minor
---

## Features

`--target prod` builds now emit a per-module declaration tree (`dist/prod/<id>/declarations/`) so that the `@savvy-web/tsdown-plugins` meta pass can recover accurate `file`/`line`/`column` on API Extractor diagnostics. The bundler passes `emitDeclarations: true` to the build loop automatically when running a prod target; no `savvy.build.ts` changes are required.
