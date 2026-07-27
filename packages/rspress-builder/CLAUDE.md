# @savvy-web/rspress-builder

`@savvy-web/rspress-builder` builds RSPress plugin packages — a thin sibling to `@savvy-web/bundler` for the one capability the bundler does not model. Built via the bundler front door.

## Key surface

- `build(options?, overrides?)` — canonical front door; applies the `definePlugin` preset and calls `runBuild`, deriving `cwd` from `dirname(process.argv[1])` and `argv` from `process.argv.slice(2)`. Mirrors the bundler's own `build()` DX.
- `definePlugin(options?)` presets a dual-bundle `BuildConfig` (a Node plugin entry `.` plus an isolated, browser-target, bundleless CSS-module React runtime entry `./runtime` in a `runtime/` subdir); `runBuild` (re-exported from the bundler) consumes it unchanged. Owns no build logic of its own.
- Regular deps: `@savvy-web/bundler`, `@tsdown/css`. `@savvy-web/tsdown-plugins` is dev-only — this package's own `.d.ts` names no tsdown-plugins type directly, and the reference that does exist resolves for consumers through the BUNDLER's own regular dependency on it, so a devDependency here is sufficient; do not promote it back. Peer deps: `@rspress/core`/`react`/`react-dom`.
- CSS auto-loads via `@tsdown/css`'s `inject: true`.
- Ships consumer presets: `./tsconfig/plugin.json`, `./tsconfig/ecma.json`, and the ambient `./env` export (`src/env.d.ts`) for CSS-module/`import.meta.env` typings.
- Merged API model covers both plugin options and runtime components.
- Reference consumer `spencerbeggs/rspress-plugin-api-extractor` lives outside this repo.

## Design

Load for the dual-bundle model, the `EntryOverride` partition fields it rides, and the peer contract:
→ `@../../.claude/design/rspress-builder/architecture.md`
Load when changing `definePlugin`, the runtime-subdir model, or the consumer presets.
