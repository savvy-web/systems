---
"@savvy-web/tsdown-plugins": patch
---

## Refactoring

The terminal report paints and strips colour with `Sgr` from `@effected/env`, and `picocolors` is no longer a dependency. Colour now follows the `noColor` the caller passes alone, so `FORCE_COLOR` set alongside `NO_COLOR` paints the report, matching the bundler's documented rule.

The dts tsconfig finds a glob's literal directory prefix with `GlobPattern.literalPrefix` from `@effected/glob`. Its output is unchanged.
