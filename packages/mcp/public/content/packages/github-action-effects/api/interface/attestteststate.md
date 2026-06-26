---
id: packages/github-action-effects/api/interface/attestteststate
title: "AttestTestState — github-action-effects interface"
summary: "Mutable state recorded by AttestTest."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AttestTestState

Mutable state recorded by [AttestTest](silk://packages/github-action-effects/api/variable/attesttest).

```ts
interface AttestTestState
```

## Members

### attestationId

```ts
readonly attestationId?: number;
```

Override the synthetic attestation id used in returned records. Defaults to `1`.

### attestCalls

```ts
readonly attestCalls: AttestInput[];
```

Inputs passed to every `Attest.attest` call.

### buildBundleCalls

```ts
readonly buildBundleCalls: AttestInput[];
```

Inputs passed to every `Attest.buildBundle` call.

### buildStatementCalls

```ts
readonly buildStatementCalls: AttestInput[];
```

Inputs passed to every `Attest.buildStatement` call.

### failWith

```ts
readonly failWith?: AttestError;
```

If set, every [Attest](silk://packages/github-action-effects/api/class/attest) operation that would normally succeed fails with this error instead. Useful for testing error-handling paths.

### listForSubjectCalls

```ts
readonly listForSubjectCalls: Array<{
    readonly subjectSha256: string;
    readonly predicateType: string | undefined;
  }>;
```

Inputs passed to every `Attest.listForSubject` call.

### provenanceCalls

```ts
readonly provenanceCalls: ProvenanceAttestationInput[];
```

Inputs passed to every `Attest.provenance` call.

### repo

```ts
readonly repo?: string;
```

Override the synthetic GitHub repo path baked into the attestation URL. Defaults to `"test-owner/test-repo"`.

### saves

```ts
readonly saves: Map<string, InTotoStatement | SigstoreBundle>;
```

Path → data captured by `Attest.save`.

### sbomCalls

```ts
readonly sbomCalls: SbomAttestationInput[];
```

Inputs passed to every `Attest.sbom` call.

### seedAttestations

```ts
readonly seedAttestations: Map<string, ReadonlyArray<AttestationListEntry>>;
```

Pre-seeded attestation entries indexed by tarball sha256-hex. The `Attest.listForSubject` test implementation returns the matching entry list (filtered by `predicateType` when requested); an unseeded [subject](silk://packages/github-action-effects/api/function/subject) returns the empty array.
