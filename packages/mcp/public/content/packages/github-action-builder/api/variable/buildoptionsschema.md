---
id: packages/github-action-builder/api/variable/buildoptionsschema
title: "BuildOptionsSchema — github-action-builder variable"
summary: "Schema for build options."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BuildOptionsSchema

Schema for build options.

```ts
BuildOptionsSchema: Schema.Struct<{
  minify: Schema.optionalWith<typeof Schema.Boolean, {
    default: () => true;
  }>; /** Generate source maps for debugging. Defaults to false. */
  sourceMap: Schema.optionalWith<typeof Schema.Boolean, {
    default: () => false;
  }>; /** Packages to exclude from the bundle (in addition to node: builtins). Defaults to []. */
  externals: Schema.optionalWith<Schema.Array$<typeof Schema.String>, {
    default: () => never[];
  }>; /** Packages to exclude from the bundle and replace with a stub that throws if loaded at runtime. Use for optional transitive dependencies the action never exercises (e.g. native modules). Defaults to []. */
  ignore: Schema.optionalWith<Schema.Array$<typeof Schema.String>, {
    default: () => never[];
  }>;
}>
```
