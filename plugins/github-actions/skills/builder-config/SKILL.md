---
name: builder-config
description: >
  Configuring @savvy-web/github-action-builder — action.config.ts with
  defineConfig, entries and worker bundles, the externals / ignore /
  nativeDynamicImports decision guide, validation and CI auto-strict,
  persistLocal, and the verify steps that catch bundler-level failures tests
  cannot see. Verified against @savvy-web/github-action-builder@2.0.4.
  User-invokable as /github-actions:builder-config.
when_to_use: >
  "action.config.ts", "configure the action build", "github-action-builder",
  "bundle an action", "externals vs ignore", "nativeDynamicImports",
  "Cannot find module at runtime in an action", "Critical dependency: the
  request of a dependency is an expression", "rspack context module",
  "worker bundle in an action", "action build fails in CI but not locally",
  "act local testing for an action", "validate action.yml"
paths:
  - "**/action.config.ts"
---

# Configuring the action builder

`@savvy-web/github-action-builder` bundles a TypeScript action into
single-file Node 24 ESM artifacts under `dist/` (rsbuild/rspack — not tsdown,
not esbuild), validates `action.yml` against GitHub's metadata schema, and
mirrors output to `.github/actions/local/` for act. Config lives in
`action.config.ts` at the repo root, loaded via jiti (no TS loader needed on
runners). The option source of truth is `src/schemas/config.ts` in the
package — **not its README or docs/, which are stale in ways listed below**.

## The config form (the #1 trap)

| Do this | Not this |
| --- | --- |
| `export default defineConfig({ ... })` | `export default GitHubAction.create({ ... })` — the package README, docs/, and the `init` scaffold all show this form, and it is WRONG. `ConfigService.load` passes the default export to `defineConfig()` expecting a plain `ConfigInput` (`src/services/config-live.ts`); a class instance decodes to **all defaults**, so your `ignore`/`workers`/`nativeDynamicImports` silently vanish and the failure only surfaces at action runtime. |

Canonical config (github-action-template, verbatim):

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
 entries: {
  pre: "src/pre.ts",
  main: "src/main.ts",
  post: "src/post.ts",
 },
 build: {
  minify: true,
 },
 persistLocal: {
  enabled: true,
  path: ".github/actions/local",
 },
});
```

Actions depending on `@savvy-web/github-action-effects` add the default
ignore list for this stack:

```typescript
build: {
 minify: true,
 // cyclonedx optional plugins the action never invokes; not installed,
 // never present at runtime — ignore (throwing stub), not externals.
 ignore: ["xmlbuilder2", "libxmljs2", "ajv-formats-draft2019"],
},
```

## Phantom options — do not write these

The docs describe options the schema does not have. In TS they are
excess-property errors; smuggled past typing they are silently ignored:

- `build.target` — does not exist. The ES target is fixed by the shared
  tsconfig (ES2022).
- `build.quiet` — does not exist (quiet is the CLI flag `-q`).
- `validation.maxBundleSize` — **declared in the schema but never read** by
  `validation-live.ts`. Setting it does nothing; do not present it as a
  working guardrail.

## Entries and workers

- `entries.main` defaults to `src/main.ts`; missing ⇒ `MainEntryMissing`.
- `entries.pre`/`entries.post` auto-detect `src/pre.ts` / `src/post.ts`.
  **An explicitly configured pre/post whose file does not exist is SILENTLY
  DROPPED** (`detectOptionalEntry`, `src/services/config-live.ts`) — if `action.yml` then
  declares `post: dist/post.js`, the action fails on the runner. persistLocal
  validation catches this, but only for the persisted copy and only when
  persistLocal is enabled — one good reason to keep it on.
- `entries.workers` is `Record<name, sourcePath>`, each emitted as
  `dist/<name>.js`. Asymmetric with pre/post: a missing worker source **fails
  the build** (`WorkerEntryMissing`). Names must not be `main`/`pre`/`post`
  and must be free of `/`, `\`, `..` (`WorkerEntryInvalidName`).
- Workers never appear in `action.yml` — your own code spawns them. Resolve
  the sibling bundle at runtime from the entry's own URL:

  ```typescript
  join(dirname(fileURLToPath(import.meta.url)), "my-worker.js")
  ```

- Output is always flat: one `.js` per entry plus `dist/package.json`
  (`{ "type": "module" }`). Dynamic `import()` of your own source folds into
  the parent chunk (`asyncChunks: false`); nothing else lands in `dist/`.
  Every build cleans `dist/` first — never hand-place files there.

## The dependency decision guide

Three options, three different questions. Getting this wrong is the top cause
of runtime-only action failures.

| Question about the package | Answer | Option |
| --- | --- | --- |
| Will it be present in `node_modules` when the action runs on the runner? | Almost never — actions bundle everything | `externals` (rare) |
| Optional transitive dep the action never loads, guarded upstream by try/catch? | Not installed, never exercised | `ignore` — aliases it to a stub that THROWS if loaded; the upstream try/catch absorbs it |
| Bundled and used, but performs a fully dynamic `import(expr)` on a runtime-computed path? | rspack turns that into a context module that throws `Cannot find module 'file:///…'` for paths that exist on disk | `nativeDynamicImports` — injects `/* webpackIgnore: true */` so the import stays native |

Precedence: a name in both `ignore` and `externals` is stubbed, not
externalized (`src/services/build-live.ts`).

Symptom → option:

- Build-time `Module not found` for a package you don't use → `ignore`.
- **Runtime** `Cannot find module 'file:///…'` where the file exists on disk,
  from a third-party package → `nativeDynamicImports`.
- Build warning `Critical dependency: the request of a dependency is an
  expression` → **not a trigger by itself.** The warning is inert unless the
  dynamic-import path actually executes at runtime. Listing a package to
  silence the warning can *break* the build:

| Do this | Not this |
| --- | --- |
| List only packages with a confirmed runtime context-module failure (`@changesets/apply-release-plan` is the known case) | Add `@effected/workspaces` to `nativeDynamicImports` — the builder's loader throws (`hasTraversalSegment`) on that file and fails the whole build. Its Critical-dependency warning is benign for actions that only read workspace structure. |

`nativeDynamicImports` matches resolved paths under `node_modules/<name>/`
only (flat and pnpm layouts — `services/native-dynamic-imports.ts`); it
**structurally cannot target your own `src/`**. For a first-party dynamic
import of a runtime-computed path, write the magic comment inline at the call
site:

```typescript
return await import(/* webpackIgnore: true */ entryUrl);
```

…and guard it in the built artifact: this bug class is invisible to vitest
(runs source, not the bundle), tsc, and lint. Add a
`scripts/assert-native-dynamic-import.mjs` chained into `build:prod`
(`github-action-builder build && node scripts/assert-native-dynamic-import.mjs`)
that greps `dist/main.js` for a genuine `await import(<ident>)` at the call
site and fails the build if rspack rewrote it into a numbered context module.
Do this for every inline `webpackIgnore` you add.

## Validation and CI auto-strict

- `action.yml` is validated on every build unless
  `validation.requireActionYml: false`. Schema hard facts: `runs.using` must
  be exactly `"node24"`; `name`, `description`, `runs.main` required; every
  input and output needs a `description`; `inputs.*.default` must be a
  string; `branding.icon`/`branding.color` are closed enums (see
  `scaffolding`).
- `validation.strict` defaults from the environment: `CI=true|1` or
  `GITHUB_ACTIONS=true` ⇒ strict, warnings become errors
  (`src/services/validation-live.ts`). The warning list includes missing branding and any
  input/output without a description — so an action that builds clean locally
  **fails in CI**. Fix the warnings rather than setting
  `validation.strict: false`; `ci:build` sets `CI="true"` precisely to
  surface this before the runner does.

## persistLocal

Syncs `action.yml` + `dist/` (SHA-256 compared) into
`persistLocal.path` (default `.github/actions/local`) after each successful
build, validates that `action.yml`'s `runs.*` paths exist in the persisted
copy, and — first build only, never overwriting — writes `.actrc` and
`.github/workflows/act-test.yml` at the **repo root** (`actTemplate: false`
to suppress in a repo with its own act setup). Why it exists: GitHub's node24
runtime won't run a repo's own `pre.js` via `uses: ./` from the root, so
local act runs target `.github/actions/local`. Keep the default (on); turn it
off only when the repo never act-tests.

## Verify before claiming done

Tests, typecheck, and lint cannot see bundler-level regressions. After any
config or dependency change:

1. `pnpm typecheck` — also proves `action.config.ts` itself type-checks
   (root `*.ts` is in the tsconfig include; phantom options surface here).
2. `CI=true pnpm ci:build` — strict validation + real bundle.
3. Inspect `dist/` — exactly the expected entry files plus `package.json`.
4. For any runtime-computed dynamic import: run/keep an
   `assert-native-dynamic-import.mjs`-style guard against the built bundle.

## Reference map

| Reference | Load when |
| --- | --- |
| [option-reference.md](./references/option-reference.md) | You need the full option table (types, defaults, purpose) or the programmatic `GitHubAction` API / CLI flags |
| [real-world-configs.md](./references/real-world-configs.md) | Writing a non-trivial config — production configs verbatim, comments included (the comments are the institutional knowledge) |
| [troubleshooting.md](./references/troubleshooting.md) | A build or bundled action is failing — symptom → cause → fix, including the Node 24 ESM-interop scars baked into the builder |

## Related skills

`scaffolding` owns the template-copy path and `action.yml` conventions;
`runtime-and-layers` owns what the entry files contain; `testing-actions`
covers why bundle bugs never show in vitest. Route from `action-engineering`.
