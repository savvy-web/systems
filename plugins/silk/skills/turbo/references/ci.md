# Turborepo in CI

## Rule

CI runs tasks through `turbo`, never by hand-iterating packages. The Silk job
order is fixed: **install → build → checks**. Install (`pnpm install
--frozen-lockfile`) never builds — there are no `prepare` build scripts — so an
explicit `pnpm build` (turbo `build:dev` + `build:prod`) must run before any
check that imports a `@savvy-web/*` package, because consumers resolve the built
`dist/dev` via `linkDirectory`.

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

Do not build inside an install hook to "warm" CI — mcp's `build:dev` pulls the
libraries' `build:prod`, which resolves `catalog:silkPeers` from the workspace
state file pnpm writes only after install scripts, so an install-time build fails
with `Catalog(s) not found: silkPeers`. Keep build a post-install turbo step.

## See also

Scoping syntax is at [filtering](./filtering.md). Cache-correct env
declarations are at [environment](./environment.md).
