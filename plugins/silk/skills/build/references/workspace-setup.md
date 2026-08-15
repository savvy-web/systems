# Workspace & Turborepo setup

The canonical package uses four scripts and inherits a shared Turborepo task graph; add `prepare` whenever the package is a `workspace:*` dependency of ANY other `package.json` in the repo.

## Package scripts

```jsonc
{
  "scripts": {
    "build:dev": "node savvy.build.ts --target dev",
    "build:prod": "node savvy.build.ts --target prod",
    "types:check": "tsc --noEmit",
    "prepare": "turbo run build:dev"
  }
}
```

(`tsdown-plugins` bootstraps `build:dev`/`build:prod` via `tsx savvy.build.ts …` instead of `node savvy.build.ts …` — the runner differs, the `prepare` line does not.)

- `build:dev` — fast, unminified `dist/dev` output.
- `build:prod` — `dist/prod` output plus the API Extractor meta pass.
- `types:check` — type-checks the package via `tsc --noEmit`.
- `prepare` — runs on `pnpm install` so the package's `dist/dev` exists at link time for consumers.

## `prepare` guidance

Add `prepare` the moment this package becomes a `workspace:*` dependency of **any other `package.json` in the repo** — the root, a sibling package, or an `e2e/*` fixture all count equally. It is NOT limited to root-level consumers: a package-to-package edge (e.g. `cli` → `silk-effects`) still needs the dependency (`silk-effects`) to carry `prepare`, because turbo's own task graph only orders *turbo-invoked* builds — it does nothing for `pnpm install`'s `link:` resolution, which runs before turbo is ever invoked.

**Do not delete a `prepare` script because it looks redundant with turbo's `dependsOn`.** That inference is common and wrong: a package can build fine without `prepare` in one session purely because of that run's incidental orchestration order, then break the next time something resolves it outside a `turbo run` (a plain `pnpm install`, a script that does `require("@savvy-web/<name>")` from the repo root, etc.). Verify with a repo-wide `workspace:*` grep for the package name before concluding a `prepare` script is unnecessary, not by watching one build succeed.

As of this writing, WITH `prepare` (something in the repo depends on them via `workspace:*`): `bundler`, `changelog`, `cli`, `mcp`, `pnpm-plugin-silk`, `silk`, `silk-effects`, `tsdown-plugins`. WITHOUT (nothing currently depends on them): `github-action-builder`, `github-action-effects`, `rspress-builder`, `templates` — add one the moment that changes. Don't trust this list blindly either; it drifts as packages gain consumers. Re-derive it with the grep below rather than assuming it's still current.

Two valid forms for the `prepare` command itself, with a trade-off:

- `node savvy.build.ts --target dev` — build only this package (fast; use when its deps are already built).
- `turbo run build:dev` — build this package **and its dependency graph** (use at the repo root or when consumers need the whole graph fresh). This is the form every current package in this repo uses, including the root.

## Finding a package's actual consumers

Don't reason about `prepare` from memory or from this file's roster — grep it fresh:

```bash
grep -rl '"@savvy-web/<name>": "workspace:\*"' **/package.json
```

Any hit anywhere in the repo (root `package.json`, a sibling `packages/*/package.json`, or an `e2e/*` fixture `package.json`) means the target package needs `prepare`.

## Root `turbo.json`

```jsonc
{
  "$schema": "https://turborepo.com/schema.v2.json",
  "globalPassThroughEnv": ["GITHUB_ACTIONS", "CI"],
  "tasks": {
    "build:dev": {
      "cache": true,
      "dependsOn": ["^build:dev"],
      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/pnpm-lock.yaml", "src/**/*", "public/**/*", "package.json", "tsconfig.json"],
      "outputLogs": "errors-only",
      "outputs": ["dist/dev/**"]
    },
    "build:prod": {
      "cache": true,
      "dependsOn": ["types:check", "build:dev"],
      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/.changeset/**", "src/**/*", "package.json", "tsconfig.json"],
      "outputLogs": "full",
      "outputs": ["dist/prod/**"]
    },
    "types:check": {
      "cache": true,
      "dependsOn": ["^build:dev"],
      "inputs": ["$TURBO_DEFAULT$", "src/**/*.ts", "__test__/**/*.ts"],
      "outputs": ["dist/.tsbuildinfo.lib"]
    }
  }
}
```

`^build:dev` builds upstream deps first; `build:prod` depends on `types:check` + `build:dev`; `build:prod` inputs include `$TURBO_ROOT$/.changeset/**` so optimistic meta versions invalidate correctly. Sentinels:

- `$TURBO_ROOT$` — the repo root.
- `$TURBO_DEFAULT$` — turbo's default input set.
- `$TURBO_EXTENDS$` — the inherited value from the extended config.
- `globalPassThroughEnv` — env vars forwarded to tasks.

## Per-package `turbo.json`

```jsonc
{
  "extends": ["//"],
  "tasks": {
    "build:prod": { "outputs": ["$TURBO_EXTENDS$", "../../website/lib/models/<pkg>"] }
  }
}
```

`extends: ["//"]` inherits the root graph; add only overrides. `$TURBO_EXTENDS$` preserves the inherited array while appending.

## Dependent-script wiring

```jsonc
{
  "extends": ["//"],
  "tasks": {
    "build:dev": { "dependsOn": ["$TURBO_EXTENDS$", "generate:json-schema"] },
    "build:prod": { "dependsOn": ["$TURBO_EXTENDS$", "generate:json-schema"] },
    "generate:json-schema": {
      "cache": true,
      "inputs": ["src/schemas/**", "lib/scripts/generate-json-schema.ts"],
      "outputs": ["schemas/**"]
    }
  }
}
```

With the matching script `"generate:json-schema": "tsx lib/scripts/generate-json-schema.ts"`. `$TURBO_EXTENDS$` keeps the inherited `^build:dev` edge while adding the codegen dependency; the codegen task's own `inputs`/`outputs`/`cache` make it cacheable and correctly invalidated so it re-runs only when its inputs change.
