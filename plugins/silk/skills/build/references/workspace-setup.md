# Workspace & Turborepo setup

The canonical package uses four scripts and inherits a shared Turborepo task graph; add `prepare` only when the package is consumed by another package in the same monorepo.

## Package scripts

```jsonc
{
  "scripts": {
    "build:dev": "node savvy.build.ts --target dev",
    "build:prod": "node savvy.build.ts --target prod",
    "types:check": "tsgo --noEmit",
    "prepare": "node savvy.build.ts --target dev"
  }
}
```

- `build:dev` — fast, unminified `dist/dev` output.
- `build:prod` — `dist/prod` output plus the API Extractor meta pass.
- `types:check` — type-checks the package via `tsgo --noEmit`.
- `prepare` — runs on `pnpm install` so the package's `dist/dev` exists at link time for consumers.

## `prepare` guidance

Add `prepare` when this module is **consumed by another module in the monorepo**, so its `dist/dev` exists at link time. Two valid forms, with a trade-off:

- `node savvy.build.ts --target dev` — build only this package (fast; use when its deps are already built).
- `turbo run build:dev` — build this package **and its dependency graph** (use at the repo root or when consumers need the whole graph fresh). A root `prepare: turbo run build:dev` is the monorepo-wide form.

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
