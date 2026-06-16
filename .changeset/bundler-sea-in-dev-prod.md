---
"@savvy-web/bundler": minor
---

## Features

### SEA compilation is now a step of every dev and prod build

A package that ships a single-executable (SEA) binary via `defineBuild({ exe })` no longer needs the standalone `--target exe` target to produce a usable artifact. A normal `--target dev`/`--target prod` build now emits the binary AND programs the manifest to point at its computed, platform-suffixed filename — the `exports`/`bin` entry resolves to the SEA and the binary is added to `files`. The exe entry source is excluded from the JS pass, so a pure-binary package emits no dead JS stub. The SEA is compiled last, into each built group's `pkg/bin`, so the dev `clean` cannot wipe it. The standalone `--target exe` target is retained as a manual escape hatch.

### `--no-exe` skips the SEA compile while still programming the manifest

`parseArgs` now recognizes `--no-exe`. A `--target dev --no-exe` build programs the manifest with the computed binary name but skips the cross-compile, so `prepare` and frozen-lockfile installs never cross-compile a SEA — important on Linux install steps where extracting a Windows SEA fails. The full `build:dev`/`build:prod` runs do the actual cross-compile.
