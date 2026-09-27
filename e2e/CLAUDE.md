# @e2e harness

`e2e/*` are PRIVATE, never-published harness packages (`@e2e/bundler`, `@e2e/pnpm-plugin-silk`, `@e2e/silk`) that exercise the BUILT `dist/dev` artifact of the package(s) under test, depended on via `workspace:*`. They are members of the `pnpm-workspace.yaml` `packages:` glob (`e2e/*`), discovered by `AgentPlugin.discover()`, and run in the normal `pnpm test` gate — no separate project or CI job.

`@e2e/silk` proves the carrier pattern from OUTSIDE the workspace, on the kit's `PackedInstall` (`@effected/workspaces/testing`). `packed-install.e2e.test.ts` makes ONE `PackedInstallOptions` object (`carrier: "@savvy-web/silk"`, `closure: "auto"`, `packFrom: "source"`, `managers: ["pnpm", "npm", "yarn", "bun"]`, `bins: ["savvy", "savvy-mcp"]`, `allowSharedBins: true`, `require: "any"`). `PackedInstall.closure` plans the closure at module evaluation (silk plus cli, mcp, changelog, silk-effects, silk-core). `PackedInstall.run` packs each package in its SOURCE dir (so the tarball IS `dist/dev/pkg` with `workspace:*`/`catalog:` rewritten), installs only the silk tarball into one scratch consumer per available manager, and steers the companions to their tarballs through each manager's own override field. A manager missing from PATH is skipped and logged, never a failure. Per consumer it asserts: no `.npmrc`, hoist pattern, config dependency or `pnpm-plugin-silk`; silk's exact pins and `bin` map; the `.bin` slot owner (`binProvenance`, silk or the front end sharing the name); that what a user types (`runBin`, `McpProbe` over `consumer.command`) runs; and that the carrier's OWN shims (`runCarrierBin`, and `McpProbe` over `carrierCommand`) print the `via @savvy-web/silk <version>` suffix on `--version` and `serverInfo.version`, with empty stderr and exit 0, on EVERY manager. `allowSharedBins: true` is deliberate: cli/mcp keep their own `savvy`/`savvy-mcp` bins, so the slot a user types may belong to a front end (npm, bun) and carry no suffix. The test and vitest timeouts come from `PackedInstall.timeoutBudget`, never a hand-picked constant. It needs the network for `effect` and the `@effected` kit. The in-repo half (the same bins straight out of `packages/silk/dist/dev/pkg/bin`, driven through `Run.collect` and `McpProbe`) lives in `packages/silk/__test__/e2e/bins.e2e.test.ts`.

## Core rule

e2e tests must NOT resolve `catalog:`/`workspace:` against the host repo. They spawn the built tool (`node savvy.build.ts`) or import the built artifact with `cwd` = a fixture repo, so `workspaces-effect`'s `CatalogResolver` (which reads `process.cwd()`) roots at the fixture, not the host. Catalog/workspace resolution coverage lives here precisely because it would otherwise see the host's real catalogs.
→ `@../okf/conventions/e2e-isolation.md`
Load before writing or reviewing an e2e test that resolves catalogs or workspace packages.

## Conventions

- **Fixtures** live under `e2e/<pkg>/__test__/e2e/fixtures/<name>/`. Each fixture that triggers resolution carries its OWN `pnpm-workspace.yaml` (inline catalogs / sibling stubs) so the resolver root-walk stops there. Fixtures are test data, NOT workspace members (biome-ignored). Their `savvy.build.ts` imports the built package (`import { build } from "@savvy-web/bundler"`), never relative `src` paths.
- **Adding a subprocess test:** spawn via `runFixtureBuild`/helpers in `e2e/bundler/__test__/e2e/helpers.ts`, and always pass that file's shared `SPAWN_ENV`. It strips `NODE_V8_COVERAGE` so fixture subprocesses don't race vitest's V8 coverage collection. Without it, `pnpm test` intermittently exits 1 on a coverage ENOENT even though the tests pass. `@e2e/silk` has no helpers file: a packed-install consumer's bins run through `PackedInstall`'s `consumer.runBin`/`runCarrierBin`/`command`/`carrierCommand`, which build the scrubbed environment themselves (layer overrides such as `NO_COLOR` or an unset `CLAUDE_PROJECT_DIR` through their `env` option).
- **In-process unit tests** that can't subprocess but still trigger host resolution (e.g. driving `emitManifest`'s `generateBundle` for a prod group) use the hermetic pattern: `chdir` into a temp dir with its own empty `pnpm-workspace.yaml`, restore the previous cwd in `finally`.
- **`@e2e/bundler` pins `typescript: ^6.0.3` directly, NOT `catalog:silk`.** Its `leaf-escape` raw-tsdown escape-hatch fixture would otherwise peer-resolve TS7, flipping rolldown-plugin-dts onto its broken "tsgo" dts generator (TS6059 from a tmpdir-rooted tsconfig). Do not move it back to the catalog before TS 7.1.

## Design

Load for the harness architecture, isolation model, and fixture taxonomy:
→ `@../okf/modules/e2e.md`
Load when adding a fixture, a new e2e package, or changing the spawn/isolation contract.
