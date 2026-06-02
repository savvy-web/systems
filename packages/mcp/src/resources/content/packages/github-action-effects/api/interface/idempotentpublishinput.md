---
id: packages/github-action-effects/api/interface/idempotentpublishinput
title: "IdempotentPublishInput — github-action-effects interface"
summary: "Input for PackagePublish."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# IdempotentPublishInput

Input for [PackagePublish](silk://packages/github-action-effects/api/class/packagepublish).

```ts
interface IdempotentPublishInput
```

## Members

### digest

```ts
readonly digest: string;
```

Content digest of the package tarball, from a prior [PackagePublish](silk://packages/github-action-effects/api/class/packagepublish) call. Compared against the registry's published integrity hash.

### options

```ts
readonly options?: {
        readonly registry?: string;
        readonly tag?: string;
        readonly access?: "public" | "restricted";
        readonly provenance?: boolean;
        readonly packageManager?: "npm" | "pnpm" | "yarn" | "bun";
    };
```

Publish options forwarded to [PackagePublish](silk://packages/github-action-effects/api/class/packagepublish).

### packageDir

```ts
readonly packageDir: string;
```

Directory of the package to publish.

### packageName

```ts
readonly packageName: string;
```

Package name, used for the registry version lookup.

### version

```ts
readonly version: string;
```

Version being published.
