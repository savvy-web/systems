---
id: packages/github-action-effects/api/interface/oidcclaims
title: "OidcClaims — github-action-effects interface"
summary: "Subset of GitHub Actions OIDC claims used to construct an SLSA provenance predicate."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# OidcClaims

Subset of GitHub Actions OIDC claims used to construct an SLSA provenance predicate.

```ts
interface OidcClaims
```

## Members

### (indexer)

```ts
readonly [k: string]: unknown;
```

### event_name

```ts
readonly event_name: string;
```

### iss

```ts
readonly iss: string;
```

### job_workflow_ref

```ts
readonly job_workflow_ref: string;
```

### ref

```ts
readonly ref: string;
```

### repository_id

```ts
readonly repository_id: string;
```

### repository_owner_id

```ts
readonly repository_owner_id: string;
```

### repository

```ts
readonly repository: string;
```

### run_attempt

```ts
readonly run_attempt: string;
```

### run_id

```ts
readonly run_id: string;
```

### runner_environment

```ts
readonly runner_environment: string;
```

### sha

```ts
readonly sha: string;
```

### workflow_ref

```ts
readonly workflow_ref: string;
```
