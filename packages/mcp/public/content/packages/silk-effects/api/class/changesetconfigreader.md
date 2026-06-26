---
id: packages/silk-effects/api/class/changesetconfigreader
title: "ChangesetConfigReader — silk-effects class"
summary: "Service that reads and decodes the `.changeset/config.json` for a given workspace root."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ChangesetConfigReader

Service that reads and decodes the `.changeset/config.json` for a given workspace root.

```ts
class ChangesetConfigReader extends ChangesetConfigReader_base
```

## Examples

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const reader = yield* ChangesetConfigReader;
    return yield* reader.read(process.cwd());
  }).pipe(
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  )
);

```
