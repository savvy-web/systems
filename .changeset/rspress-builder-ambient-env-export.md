---
"@savvy-web/rspress-builder": minor
"@savvy-web/bundler": patch
---

## Features

Move the ambient RSPress declarations from the public asset rspress-env.d.ts to src/env.d.ts, published as the types-only ./env export. Consumers reference them with a triple-slash types directive pointing at savvy-web/rspress-builder/env, and the builder copies the file verbatim into every target directory through its zero-config ambient-dts path. The old ./rspress-env.d.ts export is removed.

The declarations augment ImportMeta by declaring the interface at top level rather than wrapping it in declare global. A global script cannot carry a declare global block, and under skipLibCheck the resulting error is suppressed while the augmentation is silently discarded, leaving consumers with no import.meta.env at all.

The tsconfig/plugin.json preset is now self-contained rather than extending the local ecma base, since a relative extends out of the published path is a resolution hazard for consumers.

## Bug Fixes

Move tsdown-plugins from a dependency to a devDependency of rspress-builder. Its types reach consumers through the bundler, which declares it as a regular dependency, so the direct entry was redundant.

The shared ecma.json base now globs types/*.d.ts rather than types/*.ts and additionally includes src/*.d.ts, so hand-authored ambient declarations under src are part of the program.
