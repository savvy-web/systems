# Turborepo in CI

## Rule

CI runs tasks through `turbo`, never by hand-iterating packages. The Silk job
order is fixed: **install → build → checks**.

Install builds nothing: the root `prepare` is `husky` alone and no package
carries a `prepare`. A check importing a `@savvy-web/*` package resolves the
sibling's TypeScript source through its `exports`, with no build. An explicit
`pnpm build` (`turbo run build` → `dist/prod`) must still run before any check
that runs a built artifact.

## Remote caching

Set `TURBO_TOKEN` and `TURBO_TEAM` in the job environment. With those present,
`turbo` reads and writes the remote cache automatically. In CI use
`--remote-only` so the run never trusts a stale local `.turbo` directory that a
runner image might carry:

```bash
turbo run build --remote-only
turbo run lint test typecheck --remote-only
```

A populated remote cache turns a no-change `build` into a restore, which is
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

Do not build in an install hook to "warm" CI. Nothing builds on install: a
`workspace:` dependency links to the package directory and resolves through its
`exports` to source, so a consumer needs no built sibling to install, type-check
or test. The one `build` task (`dependsOn: ["types:check"]`, writing `dist/prod`)
runs as a post-install turbo step, and only checks that run a built artifact
wait on it. Keep the root `prepare` to git-hook setup, never a build.

## See also

Scoping syntax is at [filtering](./filtering.md). Cache-correct env
declarations are at [environment](./environment.md).
