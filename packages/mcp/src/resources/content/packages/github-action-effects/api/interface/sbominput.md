---
id: packages/github-action-effects/api/interface/sbominput
title: "SbomInput — github-action-effects interface"
summary: "Input for Sbom."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SbomInput

Input for [Sbom](silk://packages/github-action-effects/api/class/sbom).

```ts
interface SbomInput
```

## Members

### authors

```ts
readonly authors?: ReadonlyArray<SbomAuthor>;
```

Authors of the SBOM document. Threaded onto `metadata.authors` of the emitted BOM — the NTIA "author of SBOM data" element. This is distinct from rootAuthor, which describes the author of the root component rather than of the SBOM itself.

### dependencies

```ts
readonly dependencies: ReadonlyArray<ResolvedDependency>;
```

Resolved direct dependencies (post-relink) of the root package. Workspace references should already be replaced with concrete versions before being passed in.

### inFlightPackages

```ts
readonly inFlightPackages?: ReadonlyArray<InFlightPackage>;
```

Packages being released alongside the root that aren't on the registry yet. If any of these names also appear in dependencies, the in-flight version wins.

### rootAuthor

```ts
readonly rootAuthor?: string;
```

### rootDescription

```ts
readonly rootDescription?: string;
```

### rootLicense

```ts
readonly rootLicense?: string;
```

Optional root-level metadata.

### rootName

```ts
readonly rootName: string;
```

Name of the root package the BOM describes.

### rootVersion

```ts
readonly rootVersion: string;
```

Version of the root package.

### supplier

```ts
readonly supplier?: SbomSupplier;
```

Supplier of the root component. Threaded onto `metadata.supplier` of the emitted BOM — required by the NTIA SBOM minimum elements.
