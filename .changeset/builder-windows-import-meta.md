---
"@savvy-web/github-action-builder": patch
---

## Bug Fixes

Bundled actions no longer crash on Windows runners. rspack's default
`import.meta` parsing froze each module's `import.meta.url` to its absolute
build-machine source path as a `file://` literal during scope hoisting.
Dependencies that synthesize `require` / `__filename` from `import.meta.url` at
module top-level — such as `@azure/storage-common`'s crc64 ESM-compat shim
(reached via `@azure/storage-blob`) — then handed that frozen POSIX path to
`createRequire`. A driveless POSIX `file://` URL is structurally valid on
macOS/Linux but rejected by `createRequire` on Windows, throwing at module load
before any in-library fallback could run.

The bundler now disables rspack's `import.meta` parse
(`module.parser.javascript.importMeta: false`), leaving `import.meta.url` as a
runtime expression that resolves to the emitted ESM bundle's own URL on every
platform.
