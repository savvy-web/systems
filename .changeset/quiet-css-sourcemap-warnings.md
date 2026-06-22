---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

- Stopped surfacing `@tsdown/css`'s spurious `SOURCEMAP_BROKEN` warnings during dev builds of CSS-module packages (e.g. RSPress plugin runtimes built via `@savvy-web/rspress-builder`). `@tsdown/css` compiles each `.module.css` into a synthesized ESM locals module — a class-name map plus a side-effect import of the extracted CSS — whose transform emits no sourcemap, so rolldown warns that the (empty, meaningless) map "is likely to be incorrect". The build is correct and the warning is unfixable upstream, so `buildMetricsPlugin`'s rolldown `onLog` handler now drops that specific diagnostic (`code === "SOURCEMAP_BROKEN"` from a `@tsdown/css*` plugin) without recording or printing it. All other rolldown warnings — including genuine `SOURCEMAP_BROKEN` from non-CSS plugins — are still reported.
