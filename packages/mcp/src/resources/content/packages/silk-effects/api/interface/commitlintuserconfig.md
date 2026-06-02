---
id: packages/silk-effects/api/interface/commitlintuserconfig
title: "CommitlintUserConfig — silk-effects interface"
summary: "Commitlint user configuration."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# CommitlintUserConfig

[Commitlint](silk://packages/silk-effects/api/namespace/commitlint) user configuration.

```ts
interface CommitlintUserConfig
```

## Members

### extends

```ts
extends?: string[];
```

Configurations to extend

### formatter

```ts
formatter?: string;
```

Formatter for output

### helpUrl

```ts
helpUrl?: string;
```

Help URL for errors

### parserPreset

```ts
parserPreset?: string | Record<string, unknown>;
```

Parser preset

### plugins

```ts
plugins?: (string | CommitlintPlugin)[];
```

Plugins to load

### prompt

```ts
prompt?: PromptConfig;
```

Prompt configuration for interactive commits

### rules

```ts
rules?: RulesConfig;
```

Rule configurations
