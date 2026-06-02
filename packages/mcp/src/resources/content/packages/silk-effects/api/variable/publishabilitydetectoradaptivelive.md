---
id: packages/silk-effects/api/variable/publishabilitydetectoradaptivelive
title: "PublishabilityDetectorAdaptiveLive — silk-effects variable"
summary: "Ignore-aware override of PublishabilityDetector. `detect` short-circuits to `[]` for changeset-ignored packages, then dispatches on ChangesetConfig: `none` → `…"
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# PublishabilityDetectorAdaptiveLive

Ignore-aware override of PublishabilityDetector. `detect` short-circuits to `[]` for changeset-ignored packages, then dispatches on [ChangesetConfig](silk://packages/silk-effects/api/class/changesetconfig): `none` → `[]`; `silk` → [SilkPublishability](silk://packages/silk-effects/api/class/silkpublishability); `vanilla` → the library default.

```ts
PublishabilityDetectorAdaptiveLive: Layer.Layer<PublishabilityDetector, never, FileSystem.FileSystem |
  ChangesetConfig>
```
