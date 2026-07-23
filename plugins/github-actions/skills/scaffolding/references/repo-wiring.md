# Repo wiring for a builder-built action

> Distilled from savvy-web/github-action-template and production actions
> built on @savvy-web/github-action-builder@2.0.4, 2026-07-23. On version
> skew the installed source wins — re-verify before relying on this.

Everything here ships pre-configured in the template. Load this only when
adopting the pattern in an existing repo, or when one of these contracts
breaks.

## package.json

```jsonc
{
 "private": true,
 "type": "module",
 "engines": { "node": ">=24.0.0" },
 "scripts": {
  "build": "turbo run build:prod --log-order=grouped",
  "build:prod": "github-action-builder build",
  "ci:build": "CI=\"true\" turbo run build:prod --log-order=grouped --output-logs=full",
  "ci:test": "CI=\"true\" vitest run --coverage",
  "test": "vitest run --pass-with-no-tests",
  "typecheck": "turbo run types:check --log-prefix=none --log-order=grouped",
  "types:check": "tsc --noEmit",
  "validate": "github-action-builder validate"
 },
 "dependencies": {
  "@effect/platform-node": "catalog:effect",
  "@savvy-web/github-action-effects": "^3.0.4",
  "effect": "catalog:effect"
 },
 "devDependencies": {
  "@savvy-web/github-action-builder": "^2.0.4",
  "@savvy-web/silk": "^3.1.2",
  "@vitest-agent/plugin": "^2.0.6"
 }
}
```

Notes:

- `effect` and `@effect/platform-node` are **regular dependencies** of an
  action repo (the bundle needs them); the builder is a devDependency.
- `ci:build` sets `CI="true"` deliberately: the builder's validation goes
  strict under CI (`src/services/validation-live.ts` — `CI=true|1` or
  `GITHUB_ACTIONS=true`), so warnings fail locally the same way they would on
  the runner.
- An action with a first-party inline `/* webpackIgnore: true */` dynamic
  import chains a post-build bundle guard into the script:
  `"build:prod": "github-action-builder build && node scripts/assert-native-dynamic-import.mjs"`
  (see `builder-config`).

## tsconfig.json

The whole file:

```json
{
 "$schema": "https://json.schemastore.org/tsconfig.json",
 "extends": "@savvy-web/github-action-builder/tsconfig/action.json"
}
```

The base config (exported as
`@savvy-web/github-action-builder/tsconfig/action.json`) sets ES2022, ESNext
modules + bundler resolution, strict, `exactOptionalPropertyTypes`,
`types: ["node"]`, and — load-bearing — an `include` that covers `src/`,
`lib/`, `__test__/`, `types/` **and root `*.ts`**, so `action.config.ts` is
type-checked. Move the config file elsewhere and it silently stops being
checked (excess-property errors on phantom options vanish).

## turbo.json

```jsonc
{
 "globalPassThroughEnv": ["GITHUB_ACTIONS", "CI"],
 "tasks": {
  "build:prod": {
   "cache": true,
   "dependsOn": ["types:check"],
   "inputs": [
    "$TURBO_DEFAULT$",
    "$TURBO_ROOT$/package.json",
    "$TURBO_ROOT$/pnpm-lock.yaml",
    "$TURBO_ROOT$/pnpm-workspace.yaml",
    "$TURBO_ROOT$/tsconfig.json",
    "*.ts",
    "lib/**/*.ts",
    "src/**/*.ts",
    "action.yml",
    "README.md",
    "LICENSE"
   ],
   "outputs": ["dist/**"]
  },
  "types:check": { "cache": true, "outputs": [] }
 }
}
```

Two contracts that matter:

- `action.yml` and root `*.ts` (which catches `action.config.ts`) **must** be
  in `build:prod` inputs. Otherwise a config-only or metadata-only change is
  a turbo cache hit and committed `dist/` goes stale.
- `globalPassThroughEnv` must pass `CI` and `GITHUB_ACTIONS` through, or the
  strict-mode detection inside a turbo-invoked build can't see them.

## Workflows

The template ships the workflow set: `release.yml` (delegates to an org-level
reusable release workflow with `secrets: inherit` — repoint it at your org's,
or replace it), `dco.yml`, `test.yml`, and a ~13-line `act-test.yml` that
runs `./.github/actions/local` on `workflow_dispatch`. Keep `act-test.yml`
whenever `persistLocal` is enabled; adapt the rest to your org.

## Committed artifacts

- `dist/` is committed (`main.js`, optional `pre.js`/`post.js`, worker
  bundles, and `package.json` containing exactly `{ "type": "module" }`).
- `.github/actions/local/` (the persistLocal mirror) is committed where
  enabled — GitHub's node24 runtime won't run a repo's own `pre.js` when the
  action is referenced as `uses: ./` from the repo root, so act-style local
  runs go through `.github/actions/local` instead.
- Byte-reproducibility is a contract: any run-to-run bundle variance shows up
  as diff noise on every commit (the builder pins its ignore-stub path and
  inlines license comments for exactly this reason — savvy-web/systems#94).
