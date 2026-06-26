---
id: packages/github-action-builder/api/variable/buildrunneroptionsschema
title: "BuildRunnerOptionsSchema — github-action-builder variable"
summary: "Options for the build process."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BuildRunnerOptionsSchema

Options for the build process.

```ts
BuildRunnerOptionsSchema: Schema.Struct<{
  cwd: Schema.optional<Schema.transform<Schema.Union<[typeof Schema.String, Schema.instanceOf<Buffer<ArrayBufferLike>>, Schema.instanceOf<URL>]>, typeof Schema.String>>; /** Clean output directory before building. Defaults to true. */
  clean: Schema.optional<typeof Schema.Boolean>;
}>
```
