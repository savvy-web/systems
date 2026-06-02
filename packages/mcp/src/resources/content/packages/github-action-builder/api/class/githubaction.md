---
id: packages/github-action-builder/api/class/githubaction
title: "GitHubAction — github-action-builder class"
summary: "Main API class for building GitHub Actions."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# GitHubAction

Main API class for building GitHub Actions.

```ts
class GitHubAction
```

## Members

### build

```ts
build(): Promise<GitHubActionBuildResult>;
```

Build the GitHub Action.

### create

```ts
static create(options?: GitHubActionOptions): GitHubAction;
```

Create a new [GitHubAction](silk://packages/github-action-builder/api/class/githubaction) builder instance.

### dispose

```ts
dispose(): Promise<void>;
```

Dispose the runtime and release resources.

### loadConfig

```ts
loadConfig(): Promise<Config>;
```

Load and resolve configuration.

### validate

```ts
validate(options?: ValidateOptions): Promise<ValidationResult>;
```

Validate the action configuration and action.yml.

## Examples

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

async function buildAction(): Promise<void> {
  const action = GitHubAction.create();
  const result = await action.build();

  if (result.success) {
    console.log(`Built ${result.build?.entries.length} entry points`);
  } else {
    console.error(`Build failed: ${result.error}`);
    process.exit(1);
  }
}

buildAction();

```

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

async function main(): Promise<void> {
  const action = GitHubAction.create({
    config: {
      entries: { main: "src/action.ts" },
      build: { minify: true },
    },
    cwd: "/path/to/project",
  });

  const result = await action.build();
  console.log(result.success ? "Success" : result.error);
}

main();

```
