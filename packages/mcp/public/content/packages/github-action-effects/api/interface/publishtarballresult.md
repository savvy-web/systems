---
id: packages/github-action-effects/api/interface/publishtarballresult
title: "PublishTarballResult — github-action-effects interface"
summary: "Outcome of a `PackagePublish.publishTarball` call."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PublishTarballResult

Outcome of a `PackagePublish.publishTarball` call.

```ts
interface PublishTarballResult
```

## Members

### provenanceUrl

```ts
readonly provenanceUrl?: string;
```

npm's native trusted-publishing provenance URL — the Sigstore transparency-log entry npm prints when the tarball publishes with `--provenance`. Present only for npm-registry publishes that enabled provenance; absent for GitHub Packages, custom registries, or provenance-disabled publishes.
