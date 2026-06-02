---
id: packages/github-action-effects/api/interface/packagepublishteststate
title: "PackagePublishTestState — github-action-effects interface"
summary: "Test state for PackagePublish."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackagePublishTestState

Test state for [PackagePublish](silk://packages/github-action-effects/api/class/packagepublish).

```ts
interface PackagePublishTestState
```

## Members

### dryRunCalls

```ts
readonly dryRunCalls: Array<{
        packageDir: string;
        options?: Record<string, unknown>;
    }>;
```

### dryRunOk

```ts
readonly dryRunOk: boolean;
```

### integrityMatch

```ts
readonly integrityMatch: boolean;
```

### packCalls

```ts
readonly packCalls: Array<{
        packageDir: string;
    }>;
```

### packResult

```ts
readonly packResult: PackResult;
```

### publishCalls

```ts
readonly publishCalls: Array<{
        packageDir: string;
        options?: Record<string, unknown>;
    }>;
```

### publishedVersions

```ts
readonly publishedVersions: ReadonlyArray<string>;
```

### publishIdempotentCalls

```ts
readonly publishIdempotentCalls: Array<IdempotentPublishInput>;
```

### publishTarballCalls

```ts
readonly publishTarballCalls: Array<{
        tarballPath: string;
        options: Record<string, unknown>;
    }>;
```

### publishToRegistriesCalls

```ts
readonly publishToRegistriesCalls: Array<{
        packageDir: string;
        registries: Array<RegistryTarget>;
    }>;
```

### setupAuthCalls

```ts
readonly setupAuthCalls: Array<{
        registry: string;
        token: Redacted.Redacted<string>;
    }>;
```

### verifyIntegrityCalls

```ts
readonly verifyIntegrityCalls: Array<{
        packageName: string;
        version: string;
        expectedDigest: string;
    }>;
```
