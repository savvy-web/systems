---
type: Convention
title: Write Effect v4 code in the house style
description: "Model a service as a class-based Context.Service exporting a companion *Shape interface, model a serialisable value with Schema.Class or Schema.TaggedClass, model a typed failure with Data.TaggedError, and verify every API against .repos/effect or the installed release — never against v3 memory."
tags: [architecture]
stale_after: 2027-03-11T00:00:00Z
sources:
  - id: tsdown-plugins-arch
    resource: ../../packages/tsdown-plugins/package.json
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 2d08dbba6e5455fc7ff78bc8ec0d8ffcd1ecae861cf76bf5dab13e2b408b92b9
---

# Write Effect v4 code in the house style

Write every Effect service in this repo as a class-based `Context.Service`, and export a companion `*Shape` interface alongside it so a consumer can reference the service's shape without importing the class itself. Model a serialisable value object with `Schema.Class` or `Schema.TaggedClass`; model a typed failure with `Data.TaggedError`. This is the whole repo's Effect house style — it is on Effect v4 (`catalog:effect`), not v3, and no package deviates from these three shapes.

Verify any Effect API against the vendored `.repos/effect` source or the installed release before writing code against it — never against v3 memory or a v3-shaped recollection of a v4-renamed API. Effect v4 moved modules, renamed exports and changed signatures relative to v3 broadly enough that a v3-trained recollection is unreliable by construction, not merely imprecise.

Declare `effect` as a regular `dependency`, never a `peerDependency`, in a package whose consumers do not themselves supply the Effect runtime — a build-toolchain package such as `@savvy-web/tsdown-plugins` is the model case: when `effect` was a peer there, a consumer on a different Effect major poisoned peer resolution at the consumer's importer level and crashed every `savvy.build.ts` with `ERR_MODULE_NOT_FOUND`. Declare it as a required peer only in a package whose consumers genuinely provide the Effect runtime, such as `@savvy-web/silk-effects` and the `@effected/*` kit.[^tsdown-plugins-arch]

Keep Effect behind a package's interface boundary when that package's public contract is meant to hand back plain values. A plugin-pack boundary such as `@savvy-web/tsdown-plugins`' rolldown `Plugin` objects presents plain values and Promises at its surface; the reporter Effect it builds is run at the consumer's call site, not internally — do not leak an unresolved Effect across a boundary designed to hide it.[^tsdown-plugins-arch]

See [silk-effects](../modules/silk-effects.md) for the service-pattern conventions this style backs (the `layer` static's explicit `Layer.Layer<Service, Error, Requirements>` annotation, constructing with `this` rather than the class's own name) and [tsdown-plugins](../modules/tsdown-plugins.md) for a package that deliberately keeps Effect behind its boundary.

[^tsdown-plugins-arch]: `../../packages/tsdown-plugins/package.json` — `effect` declared as a regular `dependency` (`catalog:effect`), not a peer
