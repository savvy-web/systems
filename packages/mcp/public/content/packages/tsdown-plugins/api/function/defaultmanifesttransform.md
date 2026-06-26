---
id: packages/tsdown-plugins/api/function/defaultmanifesttransform
title: "defaultManifestTransform — tsdown-plugins function"
summary: "The default `transform` applied to every package's manifest when its `savvy.build.ts` does not provide one of its own. Strips the build/dev-only fields in `NON…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# defaultManifestTransform

The default `transform` applied to every package's manifest when its `savvy.build.ts` does not provide one of its own. Strips the build/dev-only fields in `NON_PUBLISHED_FIELDS` from the emitted package.json. This is the pattern nearly every package repeated by hand (inherited from rslib-builder); `defineBuild` now applies it automatically so a package needs a `transform` only when it has genuinely custom manifest work to do (e.g. silk promoting workspace deps to peerDependencies). A custom transform REPLACES this default — re-export it and call it from a custom transform to keep the stripping. `targetGroup` is accepted (so this is assignable wherever the full transform signature is expected) but unused; the strip is identical for every group. Pure: the supplied `pkg` is NOT mutated — a shallow copy with the fields removed is returned, so external callers invoking this from a custom transform keep their input intact.

```ts
function defaultManifestTransform(input: {
  pkg: Json;
}): Json;
```
