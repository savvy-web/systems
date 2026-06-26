---
id: packages/github-action-effects/api/variable/ioutil
title: "IoUtil — github-action-effects variable"
summary: "Filesystem I/O lookup helpers — `@actions/io` `which` / `findInPath` parity."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# IoUtil

Filesystem I/O lookup helpers — `@actions/io` `which` / `findInPath` parity.

```ts
IoUtil: {
  readonly which: (tool: string) => Effect.Effect<Option.Option<string>, never, FileSystem.FileSystem>;
  readonly whichOrFail: (tool: string) => Effect.Effect<string, IoError, FileSystem.FileSystem>;
  readonly findInPath: (tool: string) => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem>;
}
```
