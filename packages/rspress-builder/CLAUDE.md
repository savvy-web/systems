# @savvy-web/rspress-builder

`@savvy-web/rspress-builder` builds RSPress plugin packages — a thin sibling to `@savvy-web/bundler` for the one capability the bundler does not model. Built via the bundler front door.

## Key surface

- `definePlugin(options?)` presets a dual-bundle `BuildConfig` (a Node plugin entry `.` plus an isolated, browser-target, bundleless CSS-module React runtime entry `./runtime` in a `runtime/` subdir); re-exports the bundler's `runBuild`. Owns no build logic of its own.
- Depends on `@savvy-web/bundler` + `@savvy-web/tsdown-plugins`; peer deps `@rspress/core`/`react`/`react-dom`/`@tsdown/css`.
- CSS auto-loads via `@tsdown/css`'s `inject: true`.
- Ships consumer presets: `./tsconfig.json`, a synced local `ecma.json`, and ambient `./rspress-env.d.ts`.
- Merged API model covers both plugin options and runtime components.
- Reference consumer `spencerbeggs/rspress-plugin-api-extractor` lives outside this repo.

## Design

Load for the dual-bundle model, the `EntryOverride` partition fields it rides, and the peer contract:
→ `@../../.claude/design/rspress-builder/architecture.md`
Load when changing `definePlugin`, the runtime-subdir model, or the consumer presets.
