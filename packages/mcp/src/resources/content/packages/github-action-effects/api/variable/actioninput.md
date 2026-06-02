---
id: packages/github-action-effects/api/variable/actioninput
title: "ActionInput — github-action-effects variable"
summary: "GitHub-faithful action input helpers expressed as Effect `Config` combinators."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionInput

GitHub-faithful action input helpers expressed as Effect `Config` combinators.

```ts
ActionInput: {
    readonly boolean: (name: string) => Config.Config<boolean>;
    readonly multiline: (name: string) => Config.Config<ReadonlyArray<string>>;
}
```

## Examples

```ts
import { ActionInput } from "@savvy-web/github-action-effects"

const dryRun = yield* ActionInput.boolean("dry-run")
const paths = yield* ActionInput.multiline("paths")

```
