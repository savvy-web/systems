---
type: Convention
status: draft
title: Write Effect v4 code in the house style
description: "Model a service as a class-based Context.Service exporting a companion *Shape interface, model a serialisable value with Schema.Class or Schema.TaggedClass, model a typed failure with Data.TaggedError, and verify every API against .repos/effect or the installed release — never against v3 memory."
tags: [architecture]
stale_after: 2027-03-11T00:00:00Z
sources:
  - id: cli-manifest
    resource: ../../packages/cli/package.json
generated:
  by: okfit/claude-code
  at: 2026-11-09T19:54:23Z
integrity:
  generated:
    body: 599dd06e164b946b
---

# Write Effect v4 code in the house style

Write every Effect service in this repo as a class-based `Context.Service`, and export a companion `*Shape` interface alongside it so a consumer can reference the service's shape without importing the class itself. Model a serialisable value object with `Schema.Class` or `Schema.TaggedClass`; model a typed failure with `Data.TaggedError`. This is the whole repo's Effect house style — it is on Effect v4 (`catalog:effected`), not v3, and no package deviates from these three shapes.

Verify any Effect API against the vendored `.repos/effect` source or the installed release before writing code against it — never against v3 memory or a v3-shaped recollection of a v4-renamed API. Effect v4 moved modules, renamed exports and changed signatures relative to v3 broadly enough that a v3-trained recollection is unreliable by construction, not merely imprecise.

Declare `effect` as a regular `dependency`, never a `peerDependency`, in a package whose consumers do not themselves supply the Effect runtime — a front end such as `@savvy-web/cli`, which seals its Effect closure as regular `dependencies` with no `peerDependencies` block, is the model case. A peer there lets a consumer on a different Effect version poison peer resolution at the consumer's importer level and crash the tool with `ERR_MODULE_NOT_FOUND`. Declare it as a required peer only in a package whose consumers genuinely provide the Effect runtime, such as `@savvy-web/silk-effects` and the `@effected/*` kit.[^cli-manifest]

Keep Effect behind a package's interface boundary when that package's public contract is meant to hand back plain values. A boundary that hands a foreign host plain values and Promises — the lint-staged handlers, or a plugin object a bundler calls — runs its Effect at that call site, not internally; do not leak an unresolved Effect across a boundary designed to hide it.

See [silk-effects](../modules/silk-effects.md) for the service-pattern conventions this style backs (the `layer` static's explicit `Layer.Layer<Service, Error, Requirements>` annotation, constructing with `this` rather than the class's own name) and [lint-staged-boundary](../decisions/lint-staged-boundary.md) for a boundary that deliberately keeps Effect behind it.

[^cli-manifest]: `../../packages/cli/package.json` — `effect` declared as a regular `dependency` (`catalog:effected`), not a peer
