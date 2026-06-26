---
id: packages/github-action-builder/api/variable/githubactionbuildresultschema
title: "GitHubActionBuildResultSchema — github-action-builder variable"
summary: "Result of a GitHubAction build operation."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# GitHubActionBuildResultSchema

Result of a [GitHubAction](silk://packages/github-action-builder/api/class/githubaction) build operation.

```ts
GitHubActionBuildResultSchema: Schema.Struct<{
  success: typeof Schema.Boolean; /** Build result details if the build step ran. */
  build: Schema.optional<Schema.Struct<{
    success: typeof Schema.Boolean;
    entries: Schema.Array$<Schema.Struct<{
      success: typeof Schema.Boolean;
      stats: Schema.optional<Schema.Struct<{
        entry: typeof Schema.String;
        size: typeof Schema.Number;
        duration: typeof Schema.Number;
        outputPath: typeof Schema.String;
      }>>;
      error: Schema.optional<typeof Schema.String>;
    }>>;
    duration: typeof Schema.Number;
    error: Schema.optional<typeof Schema.String>;
  }>>; /** Validation result if validation was performed. */
  validation: Schema.optional<Schema.Struct<{
    valid: typeof Schema.Boolean;
    errors: Schema.Array$<Schema.Struct<{
      code: typeof Schema.String;
      message: typeof Schema.String;
      file: Schema.optional<typeof Schema.String>;
      suggestion: Schema.optional<typeof Schema.String>;
    }>>;
    warnings: Schema.Array$<Schema.Struct<{
      code: typeof Schema.String;
      message: typeof Schema.String;
      file: Schema.optional<typeof Schema.String>;
      suggestion: Schema.optional<typeof Schema.String>;
    }>>;
  }>>; /** Persist-local result if persist was performed. */
  persistLocal: Schema.optional<Schema.Struct<{
    success: typeof Schema.Boolean;
    filesCopied: typeof Schema.Number;
    filesSkipped: typeof Schema.Number;
    actTemplateGenerated: typeof Schema.Boolean;
    outputPath: typeof Schema.String;
    error: Schema.optional<typeof Schema.String>;
  }>>; /** Error message if the build or validation failed. */
  error: Schema.optional<typeof Schema.String>; /** Raw error object for programmatic inspection. */
  cause: Schema.optional<typeof Schema.Unknown>;
}>
```
