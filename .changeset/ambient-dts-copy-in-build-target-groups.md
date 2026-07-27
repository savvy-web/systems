---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Bug Fixes

Ambient `.d.ts` export copying now happens inside `buildTargetGroups`, alongside the existing `copyPublicDir` call, instead of only in the bundler's `runBuild`. A self-hosting package that declares an ambient export and builds through the escape-hatch `savvy.build.ts` (which calls `buildTargetGroups` directly and never reaches `runBuild`) previously got its manifest rewritten to point at the ambient file without the file ever being copied, producing a broken published export. Every build path now copies it.

As a result, `RunOptions.copyAmbientDts` is removed from `@savvy-web/bundler`. Nothing outside this suite consumed the injectable, so the removal ships as minor rather than major, consistent with the rest of this branch. `runBuild` still runs the early `extractAmbientDts`/`assertNoEntryCollisions` fast-fail validation before any build branch; only the copy step moved.
