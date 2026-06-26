---
id: packages/github-action-effects/api/interface/uploadoptions
title: "UploadOptions — github-action-effects interface"
summary: "Options for `Artifact.uploadArtifact`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# UploadOptions

Options for `Artifact.uploadArtifact`.

```ts
interface UploadOptions
```

## Members

### compressionLevel

```ts
readonly compressionLevel?: number;
```

zlib compression level 0–9 passed to POSIX `zip` (`-0`…`-9`). Default 6, matching `@actions/artifact`. Out-of-range values are clamped. No effect on Windows, where `Compress-Archive` has no numeric level.

### retentionDays

```ts
readonly retentionDays?: number;
```

Number of days to retain the artifact (1–90, or the repository max). Default: the repository retention setting.
