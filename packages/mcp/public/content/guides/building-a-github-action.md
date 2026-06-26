---
id: guides/building-a-github-action
title: Building a GitHub Action
summary: Scaffold a Node.js 24 GitHub Action with @savvy-web/github-action-builder and the github-action-effects services.
tier: guides
source: hand
tags: [github-actions, build]
priority: 0.5
related: [guides/choosing-a-builder, standards/api-model-pipeline]
---

## Overview

Two packages work together to build and power Node.js 24 GitHub Actions in the
Silk Suite:

- **`@savvy-web/github-action-builder`** — zero-config rsbuild-based build tool
  that bundles TypeScript source into self-contained ESM files and validates
  `action.yml`
- **`@savvy-web/github-action-effects`** — Effect service library replacing all
  `@actions/*` packages with native ESM implementations

Neither package depends on the other at build time. The builder bundles whatever
action code you write; the effects library provides the services that code uses.

For choosing the right builder, see `silk://guides/choosing-a-builder`. The
github-action-builder is separate from the library bundler — it targets a
different output shape (single-file committed ESM bundles, not npm-published
libraries).

## Step 1 — Project structure

```text
my-action/
├── src/
│   ├── main.ts      # Required — main action logic
│   ├── pre.ts       # Optional — pre-action hook
│   └── post.ts      # Optional — post-action hook
├── action.yml       # GitHub metadata; must have runs.using: "node24"
└── package.json
```

The builder auto-detects `src/pre.ts` and `src/post.ts` if they exist. Only
`src/main.ts` is required.

`action.yml` must declare `runs.using: "node24"`. The builder validates this and
fails if any other value is present.

## Step 2 — Install and configure the builder

```bash
pnpm add -D @savvy-web/github-action-builder
```

Zero-config usage — no config file needed:

```bash
github-action-builder build
```

Or create an optional `action.config.ts` for customization:

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  build: {
    minify: true,        // default: true
    sourceMap: false,    // default: false
    externals: [],       // exclude from bundle (must be available at runtime)
    ignore: [],          // replace with a throwing stub
  },
  validation: {
    requireActionYml: true,
    strict: undefined,   // auto-detects CI; warn locally, error in CI
  },
  persistLocal: {
    enabled: true,       // auto-copy to .github/actions/local/ after build
    path: ".github/actions/local",
  },
});
```

### Build output

Each detected entry emits one flat ESM file:

| Input | Output |
| --- | --- |
| `src/main.ts` | `dist/main.js` |
| `src/pre.ts` | `dist/pre.js` |
| `src/post.ts` | `dist/post.js` |
| (generated) | `dist/package.json` |

All output files are self-contained ESM bundles. Dynamic `import()` calls are
folded back into the parent file (`asyncChunks: false`), so `action.yml` can
always reference a known single-file path.

The builder also copies output to `.github/actions/local/` for local testing with
[nektos/act](https://github.com/nektos/act) unless `persistLocal.enabled: false`.

## Step 3 — Write action logic with `github-action-effects`

```bash
pnpm add @savvy-web/github-action-effects
```

The library provides 37 Effect service interfaces across six domains:

| Domain | Services cover |
| --- | --- |
| Core action I/O | Outputs, state, logging, environment, cache |
| Git operations | Branches, commits, tags via Git Data API |
| GitHub API | REST client, GraphQL, releases, issues, PR lifecycle, check runs, rate limiting |
| Build tooling | Command execution, npm registry, workspace detection, changeset analysis |
| Attestation | SLSA statement construction, Sigstore signing, CycloneDX SBOM generation |
| Runtime layer | GitHub Actions workflow command protocol, `ActionsConfigProvider`, `ActionsLogger`, `Step` |

### Runtime layer

The runtime layer replaces all `@actions/*` packages with native ESM implementations:

```typescript
import { Effect, Config } from "effect";
import { ActionsRuntime, Action, Step } from "@savvy-web/github-action-effects";

const program = Effect.gen(function* () {
  // Inputs via Effect's Config API (reads INPUT_* env vars)
  const name = yield* Config.string("name");
  const count = yield* Config.integer("count");

  // Logging maps to workflow commands
  yield* Effect.log("Processing...");        // plain stdout
  yield* Effect.logDebug("detail");          // ::debug::detail
  yield* Effect.logWarning("heads up");      // ::warning::heads up

  // Step buffering: one success line on pass, spills debug buffer on fail
  yield* Step.withStep("fetch data", fetchData(name));
});

// Provide the runtime layer
Action.run(program);
// or: program.pipe(Effect.provide(ActionsRuntime.Default))
```

### Reading inputs

Action inputs are read via Effect's `Config` API backed by `ActionsConfigProvider`,
which translates config keys to `INPUT_*` environment variables:

```typescript
const repoName = yield* Config.string("repo-name"); // reads INPUT_REPO-NAME
```

### Composing services

Services are provided via Effect Layers. The programmatic pattern:

```typescript
import { Effect } from "effect";
import {
  ActionsRuntime,
  GitHubClient,
  GitHubClientLive,
} from "@savvy-web/github-action-effects";

const program = Effect.gen(function* () {
  const client = yield* GitHubClient;
  // use client ...
});

program.pipe(
  Effect.provide(GitHubClientLive),
  Effect.provide(ActionsRuntime.Default),
  Effect.runPromise,
);
```

### Testing

The library exports a `./testing` subpath that excludes `GitHubClientLive` and
`OctokitAuthAppLive` (which import `@octokit/rest`/`@octokit/auth-app`). Use this
in test files to avoid pulling in those dependencies:

```typescript
import { ... } from "@savvy-web/github-action-effects/testing";
```

## Step 4 — Validate and CI

```bash
# Validate action.yml and entry structure without building
github-action-builder validate

# Full build with validation
github-action-builder build
```

In CI (`CI=true` or `GITHUB_ACTIONS=true`), validation warnings become errors and
fail the build. Locally they are displayed as warnings and the build continues.

Add to `package.json`:

```json
{
  "scripts": {
    "build": "github-action-builder build",
    "validate": "github-action-builder validate"
  }
}
```

## Step 5 — Reference the built output in `action.yml`

```yaml
name: My Action
description: Does something useful
runs:
  using: node24
  main: dist/main.js
  post: dist/post.js    # if you have a post step
```

The `dist/` directory must be committed to the repository so GitHub runners can
execute it. The builder's `persistLocal` feature also syncs to
`.github/actions/local/` for local `act` runs.

## See also

- `silk://guides/choosing-a-builder` — when to use github-action-builder vs the
  library builders
- `silk://standards/api-model-pipeline` — if your action repo also publishes a
  library whose API is documented
