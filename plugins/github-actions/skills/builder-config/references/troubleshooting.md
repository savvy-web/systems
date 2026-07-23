# Builder troubleshooting

> Distilled from `@savvy-web/github-action-builder@2.0.4` source
> (`src/errors.ts`, `src/services/build-live.ts`) and the referenced issues,
> 2026-07-23. On version skew the installed source wins — re-verify before
> relying on this.

## Build-time failures (typed errors)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ConfigNotFound` / `ConfigLoadFailed` / `ConfigInvalid` | `-c` path wrong; config threw on import; default export not a plain object | Root `action.config.ts`; `export default defineConfig({...})` — never a class instance |
| `MainEntryMissing` | `entries.main` (default `src/main.ts`) has no file | Create the entry or point `entries.main` at it |
| `WorkerEntryMissing` | A `workers` source path has no file | Fix the path — workers fail loudly (pre/post silently drop instead; see SKILL.md) |
| `WorkerEntryInvalidName` | Worker named `main`/`pre`/`post`, or name contains `/`, `\`, `..` | Rename the worker |
| `ActionYmlMissing` / `ActionYmlSyntaxError` / `ActionYmlSchemaError` | No/invalid `action.yml`; wrong `runs.using`; missing descriptions; non-string `default` | `runs.using: node24` exactly; description on every input AND output; quote defaults (`"false"`); branding enums per `scaffolding` |
| `ValidationFailed` in CI but a clean local build | CI auto-strict (`CI=true`/`GITHUB_ACTIONS=true`) promotes warnings — missing branding, missing input/output descriptions | Fix the warnings; reproduce locally with `CI=true pnpm ci:build`. Don't reach for `validation.strict: false` |
| `BundleFailed` build error naming the ignore loader / `hasTraversalSegment` | A package in `nativeDynamicImports` whose dynamic-import file the loader refuses (known: `@effected/workspaces`) | Remove it from the list — the Critical-dependency warning it emits is inert unless that code path runs |
| `ActionYmlPathError` from persistLocal | `action.yml` `runs.*` points at a file the build didn't emit (e.g. silently-dropped `post`) | Align `entries` with `action.yml`, or create the missing entry file |
| Config option seems ignored | Phantom option (`build.target`, `build.quiet`, `validation.maxBundleSize`) or a `GitHubAction.create()` default export decoding to all-defaults | Only schema options exist; use `defineConfig` |

## Runtime failures in the bundled action

These never show in vitest/tsc/lint — vitest runs the TypeScript source, not
the bundle. Reproduce with the built `dist/` (act via
`.github/actions/local`, or `node dist/main.js` with `INPUT_*`/`GITHUB_*` env
staged).

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Cannot find module 'file:///…'` for a path that exists on disk | rspack compiled a fully-dynamic `import(expr)` into a context module | Third-party package → `nativeDynamicImports`; first-party call site → inline `/* webpackIgnore: true */` + an `assert-native-dynamic-import.mjs` guard on the built bundle |
| Ignore-stub throw: module in `build.ignore` was actually loaded | The dep IS exercised at runtime (the ignore assumption was wrong) | Remove it from `ignore`; if it must stay unbundled and installed, that's `externals` |
| `Cannot find package '<name>'` at runtime for an `externals` entry | Externalized package not present on the runner | Actions rarely install deps at runtime — bundle it (drop from `externals`) |

## Node 24 ESM interop scars (baked into the builder — context, not knobs)

Know these so you don't "fix" them into regressions when reading
`src/services/build-live.ts` or debugging bundle output:

| Behavior | Why (issue) |
| --- | --- |
| `node:` builtins externalized as `node-commonjs`, not `module` | Default type makes `require("node:*")` inside bundled CJS deps return an ESM namespace; TS `__importDefault` then throws "instanceof is not callable" (savvy-web/systems#79) |
| Externalization decided by ONE function, never function + string array | Leading an externals array with a function made rspack stop consulting trailing string entries — user externals silently bundled (savvy-web/systems#81) |
| `node: { __dirname: "node-module", __filename: "node-module" }` | Bundled CJS deps referencing those globals throw in ESM output |
| `importMeta: false` parser setting | rspack's default freezes `import.meta.url` to the build machine's absolute source path; `createRequire()` on that POSIX file-URL crashed production runs on Windows runners. Also what lets a worker resolve `dist/<name>.js` from `import.meta.url` at runtime |
| `legalComments: "inline"` | No `*.LICENSE.txt` sidecars polluting a committed `dist/` (savvy-web/systems#94) |
| Fixed ignore-stub path under `node_modules/.cache/` | mkdtemp paths made builds non-reproducible → diff noise in committed `dist/` (savvy-web/systems#94) |
| `asyncChunks: false` + all-in-one chunk split | One file per entry — dynamic imports of first-party code fold into the parent chunk |

## Reproducibility

`dist/` is committed; determinism is a contract
(`__test__/integration/idempotent-build.int.test.ts` in the builder). If a
rebuild with no source change produces a diff, that's a builder bug to
report, not noise to commit.
