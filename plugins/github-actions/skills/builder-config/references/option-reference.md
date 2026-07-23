# Builder option reference

> Distilled from `@savvy-web/github-action-builder@2.0.4` source
> (`src/schemas/config.ts`, `src/github-action.ts`, `src/cli/`), 2026-07-23.
> On version skew the installed source wins — re-verify before relying on
> this.

Config file: `action.config.ts` (also `.js`, `.mjs`) at the repo root,
resolved in that order; override with `-c/--config`. `.ts` is loaded via jiti.
The default export must be a plain object produced by `defineConfig`.

## entries

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `main` | `string` | `"src/main.ts"` | Required entry → `dist/main.js`. Missing file ⇒ `MainEntryMissing` |
| `pre` | `string?` | auto-detect `src/pre.ts` | → `dist/pre.js`. Explicit path with no file is **silently dropped** |
| `post` | `string?` | auto-detect `src/post.ts` | → `dist/post.js`. Same silent-drop rule |
| `workers` | `Record<string, string>?` | — | Non-lifecycle bundles, name → source, each → `dist/<name>.js`. Missing source ⇒ `WorkerEntryMissing` (build FAILS); name `main`/`pre`/`post` or containing `/`, `\`, `..` ⇒ `WorkerEntryInvalidName` |

## build

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `minify` | `boolean` | `true` | rsbuild `output.minify` |
| `sourceMap` | `boolean` | `false` | `{ js: "source-map" }` when true |
| `externals` | `string[]` | `[]` | Not bundled; MUST exist in runtime `node_modules` (rare for actions) |
| `ignore` | `string[]` | `[]` | Not bundled; exact-match aliased to a stub that **throws if loaded**. Wins over `externals` when a name is in both. Stub path is fixed (`node_modules/.cache/github-action-builder/ignore-stub.mjs`) for byte-reproducible builds (savvy-web/systems#94) |
| `nativeDynamicImports` | `string[]` | `[]` | Packages whose fully-dynamic `import(expr)` stays a native import instead of a throwing rspack context module. Matches `node_modules/<name>/` in flat AND pnpm layouts; cannot target first-party `src/` |

**Not real** (documented in the package's own docs but absent from
`BuildOptionsSchema`): `build.target`, `build.quiet`.

## validation

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `requireActionYml` | `boolean` | `true` | `false` skips all action.yml checks |
| `maxBundleSize` | `string?` | — | **Declared but never enforced** — `validation-live.ts` never reads it |
| `strict` | `boolean?` | CI-detected | Warnings become errors. Auto-`true` when `CI=true`/`CI=1`/`GITHUB_ACTIONS=true` |

## persistLocal

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Sync `action.yml` + `dist/` to the local action dir after each successful build (SHA-256 change detection, stale-file removal, `runs.*` path validation) |
| `path` | `string` | `".github/actions/local"` | Destination, relative to cwd |
| `actTemplate` | `boolean` | `true` | Write `.actrc` + `.github/workflows/act-test.yml` at the repo root ONLY if absent — never overwrites |

## Programmatic API (`GitHubAction`, not for action.config.ts)

`new GitHubAction(options)` / `GitHubAction.create(options)` take
`GitHubActionOptions` — a DIFFERENT shape from the config file:

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `config` | `ConfigInput \| string` | — | Inline config object OR a config-file path |
| `cwd` | `string` | `process.cwd()` | Project root |
| `skipValidation` | `boolean` | `false` | Skip action.yml validation |
| `clean` | `boolean` | `true` | Clean `dist/` before build. **No action.config.ts equivalent** — programmatic/CLI-internal only |
| `layer` | `Layer` | `AppLayer` | Swap the Effect layer (tests) |

## CLI

| Command | Flags |
| --- | --- |
| `github-action-builder build` | `-c/--config <path>`, `-q/--quiet`, `--no-validate`, `--no-persist` |
| `github-action-builder validate` | `-c/--config`, `-q/--quiet` |
| `github-action-builder init <name>` | `-f/--force` — **do not use**; stale scaffold (see `scaffolding`) |

Exit 0 on success; non-zero on typed failure (`ValidationFailed`,
`BuildFailed`). On the v4 line the CLI is built on `effect/unstable/cli`.

## Non-JS exports

- `@savvy-web/github-action-builder/tsconfig/action.json` — the base tsconfig
  every consumer extends (ES2022, bundler resolution, strict,
  `exactOptionalPropertyTypes`; `include` covers `src/`, `lib/`, `__test__/`,
  `types/`, and root `*.ts` so `action.config.ts` type-checks).
- `@savvy-web/github-action-builder/loaders/webpack-ignore-dynamic-imports.cjs`
  — the rspack loader behind `nativeDynamicImports`; resolved internally via
  `import.meta.resolve`.
