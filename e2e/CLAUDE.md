# @e2e harness

`e2e/*` are PRIVATE, never-published harness packages (`@e2e/bundler`, `@e2e/pnpm-plugin-silk`, `@e2e/silk`, `@e2e/workspace`) that exercise the BUILT `dist/dev` artifact of the package(s) under test, depended on via `workspace:*`. They are members of the `pnpm-workspace.yaml` `packages:` glob (`e2e/*`), discovered by `AgentPlugin.discover()`, and run in the normal `pnpm test` gate — no separate project or CI job.

`@e2e/workspace` is the one exception to the built-artifact rule: it reads `packages/*/package.json` and `e2e/*/package.json` straight off disk and asserts the workspace's `workspace:*` dependency graph respects the declared layering in its own `layers.json` (app layers, the tooling band, and the harness). It has no app-layer `devDependencies` and does not spawn a build.
→ `@../okf/interfaces/layers-json.md`
Load when editing `layers.json` or the layering it asserts.

`@e2e/silk` proves the carrier pattern from OUTSIDE the workspace: `packed-install.e2e.test.ts` packs the six app packages (silk, cli, mcp, changelog, silk-effects, silk-core) with `pnpm pack --config.ignore-scripts=true` run in each SOURCE package dir (pnpm honours `publishConfig.directory`, so the tarball IS `dist/dev/pkg` while `workspace:*`/`catalog:` get rewritten to concrete ranges — packing from inside `dist/dev/pkg` fails with `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`), then installs ONLY the silk tarball into a `mkdtemp` scratch project per package manager (pnpm and npm; a manager missing from PATH is `it.skip`ped), steering silk's exact-pinned companions to their local tarballs via `overrides` (npm: manifest `overrides`; pnpm 11: a `pnpm-workspace.yaml` carrying only `overrides`, since the `pnpm` manifest field is no longer read). It asserts `node_modules/.bin/{savvy,savvy-mcp}` exist, are executable and run (`--version`; an MCP `initialize` handshake with empty stderr and exit 0) with no `.npmrc`, hoist pattern or config dependency. The pnpm install passes `--config.strict-dep-builds=false` so an ignored optional postinstall (esbuild) does not fail the install. It needs the network for `effect` and the `@effected` kit. The in-repo half (the same bins straight out of `packages/silk/dist/dev/pkg/bin`) lives in `packages/silk/__test__/e2e/bins.e2e.test.ts`.

## Core rule

e2e tests must NOT resolve `catalog:`/`workspace:` against the host repo. They spawn the built tool (`node savvy.build.ts`) or import the built artifact with `cwd` = a fixture repo, so `workspaces-effect`'s `CatalogResolver` (which reads `process.cwd()`) roots at the fixture, not the host. Catalog/workspace resolution coverage lives here precisely because it would otherwise see the host's real catalogs.
→ `@../okf/conventions/e2e-isolation.md`
Load before writing or reviewing an e2e test that resolves catalogs or workspace packages.

## Conventions

- **Fixtures** live under `e2e/<pkg>/__test__/e2e/fixtures/<name>/`. Each fixture that triggers resolution carries its OWN `pnpm-workspace.yaml` (inline catalogs / sibling stubs) so the resolver root-walk stops there. Fixtures are test data, NOT workspace members (biome-ignored). Their `savvy.build.ts` imports the built package (`import { build } from "@savvy-web/bundler"`), never relative `src` paths.
- **Adding a subprocess test:** spawn via `runFixtureBuild`/helpers in `e2e/bundler/__test__/e2e/helpers.ts` (or `runBin` in `e2e/silk/__test__/e2e/helpers.ts` for an Effect-run bin over `@effected/commands` `Run.collect`); always pass the shared `SPAWN_ENV`. It strips `NODE_V8_COVERAGE` so fixture subprocesses don't race vitest's V8 coverage collection — without it `pnpm test` intermittently exits 1 on a coverage ENOENT even though tests pass.
- **In-process unit tests** that can't subprocess but still trigger host resolution (e.g. driving `emitManifest`'s `generateBundle` for a prod group) use the hermetic pattern: `chdir` into a temp dir with its own empty `pnpm-workspace.yaml`, restore the previous cwd in `finally`.
- **`@e2e/bundler` pins `typescript: ^6.0.3` directly, NOT `catalog:silk`.** Its `leaf-escape` raw-tsdown escape-hatch fixture would otherwise peer-resolve TS7, flipping rolldown-plugin-dts onto its broken "tsgo" dts generator (TS6059 from a tmpdir-rooted tsconfig). Do not move it back to the catalog before TS 7.1.

## Design

Load for the harness architecture, isolation model, and fixture taxonomy:
→ `@../okf/modules/e2e.md`
Load when adding a fixture, a new e2e package, or changing the spawn/isolation contract.
