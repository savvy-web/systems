---
"@savvy-web/tsdown-plugins": minor
---

## Features

### SEA building blocks: computed filenames, entry exclusion, and manifest rewrite

Three new primitives let a build emit a single-executable (SEA) binary and program the package manifest to point at it, so an author never hand-writes the platform-suffixed filename:

- `computeExeFileName(fileName, target)` (`src/exe/filename.ts`) mirrors `@tsdown/exe`'s output naming — `fileName + getTargetSuffix(target) + (win ? ".exe" : "")`, with the platform token rendered as `win` (not `win32`). It is the single source of truth for the on-disk name, so the manifest value cannot drift from the emitted file.
- `extractEntries({ excludeSources })` drops any `exports`/`bin` value equal to the exe entry source, so a pure-binary package yields zero JS entries — no dead `bin/<cmd>.js` stub and no `No input files` error — while a library-plus-binary package still compiles its other exports.
- `transformManifest({ exeRewrite })` rewrites every `exports`/`bin` value equal to the exe source to the emitted SEA path (a plain string, since a SEA has no `.d.ts`) and adds the binary to `files` so it ships in the tarball.

`exeRewrite` threads through `buildEmittedManifest`, `emitManifest`, and `buildTargetGroups`.
