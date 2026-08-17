# Turborepo in CI

## Rule

CI runs tasks through `turbo`, never by hand-iterating packages. The Silk job
order is fixed: **install → build → checks**.

Install DOES build the dev outputs: each `workspace:*`-depended package carries
its own `prepare: turbo run build:dev`, which pnpm runs per package (a frozen
install included, unless `--ignore-scripts`). What install does NOT produce is the
prod outputs, so an explicit `pnpm build` must still run before any check that
needs them. Checks importing a `@savvy-web/*` package resolve the built `dist/dev`
via `linkDirectory`, which is exactly what those `prepare` scripts guarantee.

## Remote caching

Set `TURBO_TOKEN` and `TURBO_TEAM` in the job environment. With those present,
`turbo` reads and writes the remote cache automatically. In CI use
`--remote-only` so the run never trusts a stale local `.turbo` directory that a
runner image might carry:

```bash
turbo run build --remote-only
turbo run lint test typecheck --remote-only
```

A populated remote cache turns a no-change `build:prod` into a restore, which is
what keeps unaffected PRs cheap.

## Only build what changed

Use `--affected` to scope a run to packages touched since the merge base. Turbo
auto-detects the base/head refs in GitHub Actions; locally pass them explicitly:

```bash
turbo run test --affected
turbo run test --affected --filter=...[origin/main...HEAD]   # explicit refs
```

Pair this with a full-history checkout (`fetch-depth: 0` or a known base ref) so
the diff is accurate. A shallow clone makes `--affected` over-select.

## Docker and skipping runs

For container builds, `turbo prune <pkg> --docker` emits a pruned subset
(`out/json` lockfile layer + `out/full` source layer) so the image only installs
and builds that package's slice — keep the two layers separate to preserve Docker
layer caching. To skip an entire workflow when nothing relevant changed, gate the
job on `turbo-ignore`, which exits non-zero only when the target package (and its
dependencies) changed.

## Anti-patterns

Do not put `build:prod` in an install hook to "warm" CI. It dependsOn `types:check`
and `build:dev`, and its peer-catalog resolution reads a workspace state file pnpm
writes only AFTER install scripts complete, so it fails with
`Catalog(s) not found: <name>:peers`. Keep the prod build a post-install turbo step.

This is NOT a blanket ban on install-time builds: each workspace-dependency package
carries its own `prepare: turbo run build:dev` precisely so consumers' `link:`
resolution works at install time, and `build:dev` dependsOn `^build:dev` only.

## See also

Scoping syntax is at [filtering](./filtering.md). Cache-correct env
declarations are at [environment](./environment.md).
