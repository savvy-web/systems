---
id: packages/github-action-builder/api/variable/configschema
title: "ConfigSchema — github-action-builder variable"
summary: "Fully resolved configuration with all defaults applied."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigSchema

Fully resolved configuration with all defaults applied.

```ts
ConfigSchema: Schema.Struct<{
  entries: Schema.Struct<{
    main: Schema.optionalWith<typeof Schema.String, {
      default: () => string;
    }>; /** Path to the pre-action hook entry point. */
    pre: Schema.optional<typeof Schema.String>; /** Path to the post-action hook entry point. */
    post: Schema.optional<typeof Schema.String>; /** Extra non-lifecycle worker bundles (name -> source path), each emitted as dist/<name>.js. */
    workers: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
  }>;
  build: Schema.Struct<{
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
  }>;
  validation: Schema.Struct<{
    requireActionYml: Schema.optionalWith<typeof Schema.Boolean, {
      default: () => true;
    }>; /** Maximum bundle size before warning/error (e.g., "5mb", "500kb"). */
    maxBundleSize: Schema.optional<typeof Schema.String>; /** Treat warnings as errors. Auto-detects from CI when undefined. */
    strict: Schema.optional<typeof Schema.Boolean>;
  }>;
  persistLocal: Schema.Struct<{
    enabled: Schema.optionalWith<typeof Schema.Boolean, {
      default: () => true;
    }>; /** Path for the local action directory, relative to cwd. Defaults to ".github/actions/local". */
    path: Schema.optionalWith<typeof Schema.String, {
      default: () => string;
    }>; /** Generate act boilerplate files (.actrc, act-test.yml) if they don't exist. Defaults to true. */
    actTemplate: Schema.optionalWith<typeof Schema.Boolean, {
      default: () => true;
    }>;
  }>;
}>
```
