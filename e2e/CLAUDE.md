# @e2e harness

`e2e/*` are PRIVATE, never-published harness packages (`@e2e/bundler`, `@e2e/pnpm-plugin-silk`) that exercise the BUILT `dist/dev` artifact of the package(s) under test, depended on via `workspace:*`. They are members of the `pnpm-workspace.yaml` `packages:` glob (`e2e/*`), discovered by `AgentPlugin.discover()`, and run in the normal `pnpm test` gate — no separate project or CI job.

## Core rule

e2e tests must NOT resolve `catalog:`/`workspace:` against the host repo. They spawn the built tool (`node savvy.build.ts`) or import the built artifact with `cwd` = a fixture repo, so `workspaces-effect`'s `CatalogResolver` (which reads `process.cwd()`) roots at the fixture, not the host. Catalog/workspace resolution coverage lives here precisely because it would otherwise see the host's real catalogs.

## Conventions

- **Fixtures** live under `e2e/<pkg>/__test__/e2e/fixtures/<name>/`. Each fixture that triggers resolution carries its OWN `pnpm-workspace.yaml` (inline catalogs / sibling stubs) so the resolver root-walk stops there. Fixtures are test data, NOT workspace members (biome-ignored). Their `savvy.build.ts` imports the built package (`import { build } from "@savvy-web/bundler"`), never relative `src` paths.
- **Adding a subprocess test:** spawn via `runFixtureBuild`/helpers in `e2e/bundler/__test__/e2e/helpers.ts`; always pass the shared `SPAWN_ENV`. It strips `NODE_V8_COVERAGE` so fixture subprocesses don't race vitest's V8 coverage collection — without it `pnpm test` intermittently exits 1 on a coverage ENOENT even though tests pass.
- **In-process unit tests** that can't subprocess but still trigger host resolution (e.g. driving `emitManifest`'s `generateBundle` for a prod group) use the hermetic pattern: `chdir` into a temp dir with its own empty `pnpm-workspace.yaml`, restore the previous cwd in `finally`.
- **`@e2e/bundler` pins `typescript: ^6.0.3` directly, NOT `catalog:silk`.** Its `leaf-escape` raw-tsdown escape-hatch fixture would otherwise peer-resolve TS7, flipping rolldown-plugin-dts onto its broken "tsgo" dts generator (TS6059 from a tmpdir-rooted tsconfig). Do not move it back to the catalog before TS 7.1.

## Design

Load for the harness architecture, isolation model, and fixture taxonomy:
→ `@../.claude/design/e2e/architecture.md`
Load when adding a fixture, a new e2e package, or changing the spawn/isolation contract.
