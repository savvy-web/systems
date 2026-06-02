---
id: packages/templates/api/variable/packagejsonoptions
title: "PackageJsonOptions — templates variable"
summary: "variable PackageJsonOptions from @savvy-web/templates."
tier: packages
source: generated
tags: [templates, api]
priority: 0.3
related: []
---

# PackageJsonOptions

```ts
PackageJsonOptions: Schema.Struct<{
    name: typeof Schema.String;
    version: Schema.optionalWith<typeof Schema.String, {
        default: () => string;
    }>;
    private: Schema.optional<typeof Schema.Boolean>;
    description: Schema.optional<typeof Schema.String>;
    homepage: Schema.optional<typeof Schema.String>;
    bugs: Schema.optional<Schema.Struct<{
        url: typeof Schema.String;
    }>>;
    repository: Schema.optional<Schema.Struct<{
        type: typeof Schema.String;
        url: typeof Schema.String;
        directory: Schema.optional<typeof Schema.String>;
    }>>;
    license: Schema.optional<typeof Schema.String>;
    author: Schema.optional<Schema.Struct<{
        name: typeof Schema.String;
        email: Schema.optional<typeof Schema.String>;
        url: Schema.optional<typeof Schema.String>;
    }>>;
    sideEffects: Schema.optional<typeof Schema.Boolean>;
    type: Schema.optional<Schema.Literal<["module", "commonjs"]>>;
    exports: Schema.optional<typeof Schema.Unknown>;
    scripts: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
    dependencies: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
    devDependencies: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
    peerDependencies: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.String>>;
    engines: Schema.optional<Schema.Struct<{
        node: Schema.optional<typeof Schema.String>;
        pnpm: Schema.optional<typeof Schema.String>;
    }>>;
    packageManager: Schema.optional<typeof Schema.String>;
    devEngines: Schema.optional<typeof Schema.Unknown>;
    publishConfig: Schema.optional<Schema.Struct<{
        access: Schema.optional<typeof Schema.String>;
        directory: Schema.optional<typeof Schema.String>;
        linkDirectory: Schema.optional<typeof Schema.Boolean>;
        targets: Schema.optional<typeof Schema.Unknown>;
    }>>;
    keywords: Schema.optional<Schema.Array$<typeof Schema.String>>;
}>
```
