---
id: packages/github-action-effects/api/interface/storagerecordinput
title: "StorageRecordInput — github-action-effects interface"
summary: "Input for creating a GitHub Packages artifact-metadata storage record."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# StorageRecordInput

Input for creating a GitHub Packages artifact-metadata storage record.

```ts
interface StorageRecordInput
```

## Members

### artifactUrl

```ts
readonly artifactUrl: string;
```

The artifact's GitHub Packages URL.

### digest

```ts
readonly digest: string;
```

[Artifact](silk://packages/github-action-effects/api/class/artifact) digest.

### name

```ts
readonly name: string;
```

Package URL (purl), e.g. `"pkg:npm/@scope/pkg@1.2.3"`.

### registryUrl

```ts
readonly registryUrl: string;
```

Registry URL, e.g. `"https://npm.pkg.github.com/"`.

### repo

```ts
readonly repo: string;
```

Unscoped package / repo name.

### version

```ts
readonly version: string;
```

Package version.
