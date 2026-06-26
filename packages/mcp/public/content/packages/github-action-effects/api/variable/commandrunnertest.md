---
id: packages/github-action-effects/api/variable/commandrunnertest
title: "CommandRunnerTest — github-action-effects variable"
summary: "Test implementation for CommandRunner."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CommandRunnerTest

Test implementation for [CommandRunner](silk://packages/github-action-effects/api/class/commandrunner).

```ts
CommandRunnerTest: {
  readonly layer: (responses: ReadonlyMap<string, CommandResponse>) => Layer.Layer<CommandRunner>; /** Create a test layer where all commands succeed with empty output. */
  readonly empty: () => Layer.Layer<CommandRunner>;
}
```
