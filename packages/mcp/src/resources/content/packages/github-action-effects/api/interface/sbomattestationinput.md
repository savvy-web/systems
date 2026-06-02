---
id: packages/github-action-effects/api/interface/sbomattestationinput
title: "SbomAttestationInput — github-action-effects interface"
summary: "Input for Attest."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SbomAttestationInput

Input for [Attest](silk://packages/github-action-effects/api/class/attest).

```ts
interface SbomAttestationInput extends Omit<SbomInput, "dependencies">
```

## Members

### bomDocument

```ts
readonly bomDocument?: Record<string, unknown>;
```

Pre-built CycloneDX BOM document to attest verbatim. Used when the caller (e.g. a publish orchestrator) has already generated the BOM with full NTIA / supplier metadata via [Sbom](silk://packages/github-action-effects/api/class/sbom) and just wants this service to wrap it in an in-toto envelope, sign it, and POST it. Mutually exclusive with dependencies.

### dependencies

```ts
readonly dependencies?: SbomInput["dependencies"];
```

Resolved direct dependencies of the root package. When provided, the live implementation builds a CycloneDX BOM from the list and attests it. Mutually exclusive with bomDocument.

### subjectSha256

```ts
readonly subjectSha256: string;
```

Hex-encoded SHA-256 of the package tarball (or other artifact bytes) the BOM describes. The runtime in-toto [subject](silk://packages/github-action-effects/api/function/subject) becomes `pkg:npm/{rootName}@{rootVersion}` with this digest.
