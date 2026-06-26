---
id: packages/github-action-effects/api/variable/actionsconfigprovider
title: "ActionsConfigProvider — github-action-effects variable"
summary: "A `ConfigProvider` that reads GitHub Actions inputs from the process environment. GitHub Actions populates action inputs as environment variables with the pref…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionsConfigProvider

A `ConfigProvider` that reads GitHub Actions inputs from the process environment. GitHub Actions populates action inputs as environment variables with the prefix `INPUT_`, with spaces replaced by underscores and the name uppercased. Hyphens are preserved (not converted to underscores), matching GitHub Actions behavior. For example: - `Config.string("name")` reads `INPUT_NAME` - `Config.string("retry-count")` reads `INPUT_RETRY-COUNT` - `Config.string("my input")` reads `INPUT_MY_INPUT` Empty string values are treated as missing and produce a `ConfigError`.

```ts
ActionsConfigProvider: ConfigProvider.ConfigProvider
```

## Examples

```ts
const program = Effect.withConfigProvider(ActionsConfigProvider)(
  Effect.config(Config.string("my-input"))
)

```
