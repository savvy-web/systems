---
id: packages/silk-effects/api/variable/silkchangesetconfigfile
title: "SilkChangesetConfigFile — silk-effects variable"
summary: "variable SilkChangesetConfigFile from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SilkChangesetConfigFile

```ts
SilkChangesetConfigFile: Schema.extend<Schema.Struct<{
  changelog: Schema.optional<Schema.Union<[typeof Schema.String, Schema.Array$<typeof Schema.Unknown>, Schema.Literal<[false]>]>>;
  commit: Schema.optional<Schema.Union<[typeof Schema.Boolean, typeof Schema.String, Schema.Array$<typeof Schema.Unknown>]>>;
  fixed: Schema.optional<Schema.Array$<Schema.Array$<typeof Schema.String>>>;
  linked: Schema.optional<Schema.Array$<Schema.Array$<typeof Schema.String>>>;
  access: Schema.optional<Schema.Literal<["public", "restricted"]>>;
  baseBranch: Schema.optional<typeof Schema.String>;
  updateInternalDependencies: Schema.optional<Schema.Literal<["patch", "minor", "major"]>>;
  ignore: Schema.optional<Schema.Array$<typeof Schema.String>>;
  privatePackages: Schema.optional<Schema.Union<[Schema.Struct<{
    tag: Schema.optional<typeof Schema.Boolean>;
    version: Schema.optional<typeof Schema.Boolean>;
  }>, Schema.Literal<[false]>]>>;
  prettier: Schema.optional<typeof Schema.Boolean>;
  changedFilePatterns: Schema.optional<Schema.Array$<typeof Schema.String>>;
  bumpVersionsWithWorkspaceProtocolOnly: Schema.optional<typeof Schema.Boolean>;
  snapshot: Schema.optional<Schema.Struct<{
    useCalculatedVersion: Schema.optional<typeof Schema.Boolean>;
    prereleaseTemplate: Schema.optional<typeof Schema.String>;
  }>>;
}>, Schema.Struct<{
  _isSilk: Schema.optionalWith<typeof Schema.Boolean, {
    default: () => true;
  }>;
}>>
```
