---
"@savvy-web/github-action-effects": patch
---

## Bug Fixes

### npm commands no longer fail `EACCES` on the runner's root-owned cache

`PackagePublish` (pack, publish, publishTarball, publishToRegistries, dryRun) and every `NpmRegistry` `npm view` call now run npm with `--cache` pointed at a runner-writable directory under `RUNNER_TEMP` instead of the default `~/.npm`. GitHub's macOS runner images ship a partially root-owned `~/.npm/_cacache`, and current npm refuses to use a cache containing root-owned files — it hard-fails with `npm error code EACCES` ("Your cache folder contains root-owned files") before doing any work. Redirecting the cache sidesteps the poisoned directory so packs, publishes, dry-runs, and registry lookups succeed on an otherwise healthy runner.

### `dryRun` and `pack` dispatch through the same npm executor as `publish`

Both now accept a `packageManager` option and route through the package manager's npm executor (`pnpm dlx npm`, `yarn npm`, `bun x npm`, or bare `npm`) exactly as `publish` does. A dry-run therefore validates against the identical npm — including the fresh npm `pnpm dlx` fetches — that the live publish will run, rather than the runner's bundled npm.
