---
"@savvy-web/silk": minor
---

## Features

### watch-issues monitor only reports what it can vouch for

The `watch-issues` monitor now stays silent unless an artifact clears three provenance gates: `buildOk` is read three-state (`true`/`false`/absent), never collapsed to a pass; the artifact's mtime must be at least as new as the package's newest source file; and the package's working tree must be clean, checked only once a candidate has already cleared the other two gates. The notification no longer suggests dispatching a fixer — it names the count and points at the artifact, framed as reporting an artifact rather than any agent's in-flight work.

A per-project advisory lock (keyed on a hash of the project root, held in the OS temp directory) now keeps a second resident watcher for the same project from stacking up alongside an existing one; a stale lock from a dead process is taken over automatically.

### `journal-append.sh --package` / `--clear-packages`

The dogfood journal script gained a repeatable `--package '<name>=<override>'` and a `--clear-packages` flag (downstream entries only, mutually exclusive with each other) so a link-lazy loop that starts with an empty package closure can record the real one once it installs mid-round. Each use replaces the whole `packages` array rather than merging into it — a journal snapshot always describes one complete closure.

```bash
journal-append.sh <journal> --event phase-change --phase adopting --ball ours \
  --package "@effected/git=file:../effected/packages/git/dist/prod/npm/pkg" --packages-derived true
journal-append.sh <journal> --event unlinked --phase unlinked --clear-packages
```

### "Reading a build as evidence" guidance in the `build` skill

The `build` skill now explains why a hand-run `node savvy.build.ts --target prod` and a real `build:prod` task can look identical yet mean different things, and gives the one check that tells them apart: `dist/<target>/issues.json`'s `generatedAt` must postdate the newest source edit.

## Bug Fixes

* `biome-direct-deny` hook message now names the known false positive for a consumer repo with its own `node_modules/.bin/biome` on `PATH` — the deny still fires there, but the message frames it as a redirect to the sanctioned lint path rather than a lost capability.

## Tests

* Added `tests/monitor-watch-issues.bats` covering each `watch-issues` provenance gate as a reason to stay silent.
* Replaced residual `better-sqlite3` exemplars in the dogfood journal bats fixtures with `esbuild`.
