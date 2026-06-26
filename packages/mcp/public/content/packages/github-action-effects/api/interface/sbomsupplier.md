---
id: packages/github-action-effects/api/interface/sbomsupplier
title: "SbomSupplier — github-action-effects interface"
summary: "The organization that supplied the root component. Maps to the CycloneDX `metadata.supplier` field, which the NTIA SBOM \"minimum elements\" require for complian…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SbomSupplier

The organization that supplied the root component. Maps to the CycloneDX `metadata.supplier` field, which the NTIA SBOM "minimum elements" require for compliance.

```ts
interface SbomSupplier
```

## Members

### contact

```ts
readonly contact?: ReadonlyArray<SbomContact>;
```

Optional supplier point(s) of contact.

### name

```ts
readonly name: string;
```

Supplier organization name. Required for NTIA compliance.

### url

```ts
readonly url?: ReadonlyArray<string>;
```

Optional supplier URL(s).
