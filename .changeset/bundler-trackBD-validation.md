---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### JSX/React builds, SEA executable compilation, and fast-fail config validation

The bundler can now build React/JSX packages, compile Node single-executable (SEA) binaries, and validate `savvy.build.ts` / `publishConfig.targets` configuration up front before any build work runs.

#### `@savvy-web/tsdown-plugins`

* JSX (`src/jsx/`): `resolveJsxConfig` maps a package's tsconfig `compilerOptions.jsx`/`jsxImportSource` to a rolldown JSX config (`react-jsx`/`react-jsxdev` to the automatic runtime, `react` to classic, `preserve`/none to nothing), with an explicit override taking precedence. `readTsconfigJsx` reads those values from the package tsconfig. The resolved config feeds both the dts tsconfig and the tsdown build's `inputOptions.jsx`. New exports: `resolveJsxConfig`, `readTsconfigJsx`, and the types `JsxConfig`, `TsconfigJsx`.
* SEA executables (`src/exe/`): `normalizeExeOptions` derives one fully-resolved per-binary SEA spec from an `exe` config plus the package `os`/`cpu` (single-platform inference, `win32` mapped to the `win` token, `seaConfig` and `nodeVersion` defaulted). `runExeBuild` is an interface-only wrapper over tsdown's exe mode that runs one build per binary with the SEA settings derived above. New exports: `normalizeExeOptions`, `runExeBuild`, `DEFAULT_EXE_NODE_VERSION`, and the types `ExeConfig`, `ExeTarget`, `ExeTargetInput`, `ExeSeaConfig`, `NormalizedExe`, `PkgOsCpu`, `RunExeBuildOptions`, `ExeBuild`.
* Config validation (`src/config-validation/`): a `ConfigValidator` Effect service plus its `ConfigValidatorLive` layer validate the publish targets (delegated to `resolveTargets`, the single source of truth), the exe config (via `normalizeExeOptions`, rejecting empty `fileName` or targets that resolve to none), and the meta config (tsdoc tag `syntaxKind`, `localPaths` directories, and a cross-field rule that a package with no `exports` cannot emit a model). New exports: `ConfigValidator`, `ConfigValidatorLive`, `ConfigValidationError`, and the type `ValidationInput`.
* `resolveTargets` now throws the typed `ConfigValidationError` (a `Data.TaggedError`) instead of a plain `Error` for every structural-validation failure. The error message text is preserved verbatim, so message matching is unaffected; the change is the thrown type, which callers can now discriminate by tag.

#### `@savvy-web/bundler`

* `savvy build --target exe` compiles SEA binaries via `runExeBuild` (tsdown exe mode) into `dist/dev/pkg/bin`, deriving the targets from the package `os`/`cpu` (or an explicit `exe` config) and fast-failing when no `exe` option is declared. Adds `@tsdown/exe` as a runtime dependency, which tsdown lazily loads when the exe option runs.
* `defineBuild({ jsx })` sets an explicit JSX override; otherwise JSX is inherited from the package tsconfig. The resolved config is forwarded into both the dts tsconfig and the tsdown build.
* `runBuild` now runs the `ConfigValidator` first, fast-failing on an invalid `savvy.build.ts` / `publishConfig.targets` / exe / meta config across every `--target` path (dev, npm, meta, exe) before any build work begins.
* Re-exports `JsxConfig`, `ExeConfig`, `ExeTarget`, and `NormalizedExe` from `@savvy-web/tsdown-plugins` for consumers.
