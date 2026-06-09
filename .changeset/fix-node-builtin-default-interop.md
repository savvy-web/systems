---
"@savvy-web/tsdown-plugins": patch
"@savvy-web/bundler": patch
---

## Bug Fixes

### Correct CJS interop for default imports of Node built-ins (`savvy:node-builtin-default-interop`)

Dual-format (esm+cjs) builds that bundle a dependency which default-imports a Node built-in produced a broken CJS chunk that crashed at runtime with `TypeError: Cannot read properties of undefined (reading 'cwd')`.

The trigger is a rolldown 1.1.0 codegen defect (latest published rolldown/tsdown, no newer release to upgrade to): for a default import of an external Node built-in, rolldown emits a bare `require("node:x")` WITHOUT its `__toESM` interop wrapper, yet still accesses `.default` on it — and a built-in's CJS export object has no `.default`. Named imports are unaffected, and a namespace import is wrapped correctly. The concrete victim was `vfile` (`export {default as minproc} from 'node:process'`, `export {default as minpath} from 'node:path'`), bundled transitively into `@savvy-web/silk`'s CJS changesets entry, which broke `savvy changeset version`.

New `nodeBuiltinDefaultInterop` rolldown plugin (a `transform` hook) rewrites default imports / default re-exports of `node:`-prefixed and bare built-in modules into the equivalent namespace form before codegen, so rolldown emits correct interop. It runs only when `cjs` is in the build format (esm-only builds are untouched) in both the per-module JS pass and the bundled dts re-emit pass, and is immune to minification because it operates on source. New export: `nodeBuiltinDefaultInterop`.
