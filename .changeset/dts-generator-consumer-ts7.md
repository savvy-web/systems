---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

Fix declaration builds in consumer repos that install TypeScript 7. The dts and declarations passes now pin rolldown-plugin-dts' generator to `tsc` instead of letting it auto-detect, and tsdown moves from devDependencies to regular dependencies so the runtime `import("tsdown")` in `buildTargetGroups` and `runExeBuild` resolves deterministically against this package's pinned `typescript ^6.0.3` rather than a host-hoisted instance peered to the host's TypeScript. Previously, a consumer with TypeScript 7 in its root closure resolved a tsdown instance whose rolldown-plugin-dts auto-detected the `tsgo` generator, which derives `--rootDir` from the synthesized tmpdir tsconfig's directory and emits nothing (TS6059), failing builds with "tsgo did not generate dts file".
