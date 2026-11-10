# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem.

## Packages

Each package has its own `CLAUDE.md` (auto-loaded when you work in its subtree) and its own Module concept at `okf/modules/<pkg>.md`. App packages form a strict layered graph (L4 silk → L3 cli/mcp/changelog → L2 silk-effects → L1 silk-core), asserted by silk's `package-layering.test.ts` against `packages/silk/layers.json` (`@effected/workspaces`' `WorkspaceLayering`):
→ `@./okf/conventions/package-layering.md`
→ `@./okf/interfaces/layers-json.md`
Load when adding a `workspace:*` edge between packages or moving code across a layer.

- **silk-core** (`@savvy-web/silk-core`) — L1 domain core: platform-free schemas, tagged errors, the `PrBody` contract. See `packages/silk-core/CLAUDE.md`.
- **silk-effects** (`@savvy-web/silk-effects`) — L2 engine: shared Effect library and dev-tooling business-logic core (`Changesets`/`Commitlint`/`Lint`/`Turbo`/`Repos`); re-exports silk-core. See `packages/silk-effects/CLAUDE.md`.
- **cli** (`@savvy-web/cli`) — the `savvy` binary (`init`/`check`/`commit`/`changeset`/`lint`/`clean`/`repos`). See `packages/cli/CLAUDE.md`.
- **mcp** (`@savvy-web/mcp`) — the spawnable `savvy-mcp` server: an Effect-native `McpServer` (`effect/ai`), one Layer over stdio, ten tools, no resources. See `packages/mcp/CLAUDE.md`.
- **silk** (`@savvy-web/silk`) — the single install-target of config-integration shims + Biome asset, AND the carrier of the `savvy`/`savvy-mcp` bins. See `packages/silk/CLAUDE.md`.
- **changelog** (`@savvy-web/changelog`) — the standalone changesets changelog generator; the installable identity for silk-effects' `Changesets.changelogFunctions` and the canonical `.changeset/config.json` changelog id. See `packages/changelog/CLAUDE.md`.
- **templates** (`@savvy-web/templates`) — pure-function project scaffolding. See `packages/templates/CLAUDE.md`.
- **pnpm-plugin-silk** (`@savvy-web/pnpm-plugin-silk`) — the unified pnpm config dependency distributing the purpose-scoped catalogs and install-time policy across the ecosystem. See `packages/pnpm-plugin-silk/CLAUDE.md`.

The build tooling that used to live here — `@savvy-web/bundler`, `@savvy-web/tsdown-plugins`, `@savvy-web/rspress-builder`, `@savvy-web/github-action-builder` — is DELETED; the kit's `@effected/plugin` replaced it (`effected package build`, `effected action build`). Their published versions stay on npm; any in-repo reference to them is stale.

`e2e/*` is a separate harness area of PRIVATE, test-only packages — today only `@e2e/silk`, the packed-install proof that has no owning package — distinct from the published `packages/*`. Every other e2e test lives IN its package under `packages/<pkg>/__test__/e2e/` and runs the package's own built `dist/prod/npm/pkg` by path (cli's and mcp's bin suites, silk's carrier bins, cli's `regen-catalog`, pnpm-plugin-silk's pnpmfile contract). See `e2e/CLAUDE.md`.

Also in this repo: the silk agent plugin (the repo's only plugin; `plugins/github-actions` was removed), whose source of truth is `plugin/` (`@savvy-web/ai-plugins`, private) built by pluginfinity into committed `plugin/builds/claude` and `plugin/builds/copilot` trees (the legacy `plugins/silk/` copy is deleted); the placeholder docs site (`docs/`), cross-repo planning, and the plugin marketplace entry points (`.claude-plugin/` for Claude Code, `.github/plugin/` for Copilot).

## Tech Stack

- **Runtime:** Node.js 24.11.0+
- **Package Manager:** pnpm 12.8.2 with `@savvy-web/pnpm-plugin-silk` config dependency
- **Build:** the kit's `@effected/plugin`: every package's `build` script is `effected package build`, configured by an optional per-package `effected.toml` (`[package.build]`, `[package.build.meta]`, `[package.build.meta.tsdoc]`, `[package.bundle]`), writing `dist/prod/npm/pkg`, `dist/prod/targets.json` and `dist/prod/issues.json`. Turborepo runs one `build` task (`dependsOn: ["types:check"]`). The build-chain toolchain (tsdown, rolldown, api-extractor, typescript, tsx, …) comes from `catalog:effected:build`. tsconfigs extend `@effected/plugin/tsconfig/ecma.json`
- **Effect:** the whole repo is on Effect v4 (`catalog:effected`). The catalog comes from the `@effected/pnpm-plugin-effected` config dependency (which replaced `@effected/pnpm-plugin-effect` at `0.20.0`, effected#1146): its install hook folds `effect`, every `@effect/*` package and the `@effected/*` kit into ONE dependency catalog, `effected`, used by dependencies and devDependencies. Since `0.26.0` it serves four catalogs: `effected`, `effected:peers`, `effected:build`, `effected:build:peers` — every peerDependencies entry is spelled through a peers catalog (`catalog:effected:peers`, or `catalog:effected:build:peers` for the toolchain), never `catalog:effected`. `catalog:effect` and `catalog:effect:peers` no longer exist and fail the install with `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC`. The Effect family is held to one minor, and the plugin pins every family member graph-wide with its own overrides — never hand-write those pins. pnpm never applies those overrides to a `catalog:` spec (pnpm/pnpm#17922), so the `effected` catalog names each family member at its EXACT override version (`effect: 4.1.3`) — which is why a peer spelled `catalog:effected` would publish an exact pin. A published peer range is the peers catalog's range (`effect: ~4.1.0`, an `@effected/*` minor caret such as `^0.4.0`), not a floored one. Bumping this config dependency has a trap: see `@./okf/decisions/kit-effect-peers-via-catalog.md` and savvy-web/systems#536. `effect` core source is vendored at `.repos/effect` (pinned to the catalog tag) — the authority for v4 APIs — from `Effect-TS/effect` itself, NOT the archived `effect-smol` repo; `.repos/config.json` is the live record of url/ref/sparse paths. The `@effected/*` kit packages the suite consumes come from the npm registry (re-derive the list from the manifests, never from memory)
- **Linting:** Biome, markdownlint
- **Testing:** Vitest via `@vitest-agent/plugin`; a test that runs an Effect takes `describe`/`it`/`expect` from `@effect/vitest` (`catalog:effected`), one with no Effect surface stays on plain `vitest`, and `vi` always comes from `"vitest"` (hoisting). A test needing a `FileSystem` builds an `@effected/memfs` volume, not a hand-rolled stub. Built-artifact e2e harness in `e2e/*`; the silk plugin's shell suite (bats + shellcheck, against both builds) under `plugin/__test__`, run by `pnpm test:hooks`
- **Commits:** Conventional commits with DCO signoff via `@savvy-web/commitlint`. Bodies stay short (the repo squash-merges, so a long body is discarded) — use `/silk:commit-create`. A PR body is markdown, NOT held to the commit contract: only `plan-leakage`/`closes-trailer` gate it, so headers and fences are fine — use `/silk:pr-body`.
→ `@./okf/conventions/lint-staged-exec-bit.md`
Load before flagging a 755→644 mode change on a .sh file.
- **Releases:** `@savvy-web/changesets`

## Key Commands

```bash
pnpm build          # Build every package (turbo run build → dist/prod)
pnpm test           # Run tests
pnpm typecheck      # Type-check all packages
pnpm lint           # Biome check
pnpm lint:fix       # Biome auto-fix
pnpm lint:md        # Markdown lint
```

`npx biome` is a false green: it resolves to an unrelated npm package (`0.3.3`) that no-ops and exits 0, so `npx biome check --write` reports success while checking nothing (real Biome prints `Version: 2.5.9`). Worse, ANY direct Biome invocation — bare, path-prefixed, `pnpm exec biome`, `npx @biomejs/biome`, `sudo biome`, every other route — skips this repo's config, walks straight into the `.repos/**` vendored worktrees (git-managed, chmodded read-only by `Repos.ReposLockdown`) and can corrupt them or die on `EACCES`. The silk plugin's `biome-direct-deny` PreToolUse hook denies every direct route, keyed on the script name across pnpm/yarn/bun/npm. Use the `mcp__plugin_silk_savvy-mcp__biome_check` MCP tool or the three sanctioned root scripts `pnpm lint` / `pnpm lint:fix` / `pnpm lint:fix:unsafe` (any package manager). silk's `./biome` export is the source file `public/biome/silk.json`, so the config resolves without a build.

## Install & Build Orchestration

Nothing builds on install: the root `prepare` is `husky` and nothing else, and no package carries a `prepare` script, `build:dev`, `publishConfig.directory` or `linkDirectory`. A `workspace:` dependency links to the package directory and resolves through its `exports` straight to `src/*.ts`. pnpm scripts load that TypeScript through `nodeOptions: --import=tsx` in `pnpm-workspace.yaml` (root devDependency `tsx`); the `savvy`/`savvy-mcp` bins (cli and mcp `src/bin.ts`, silk `src/bin/*.ts`) register tsx themselves when run as `.ts`, so git hooks, the plugin's MCP launcher and a bare shell work from source with no build. Do NOT re-add `prepare`/`build:dev` or a `dist/dev` link.

`pnpm build` is `turbo run build`; `types:check` depends on `^types:check`. Only tests that run a built artifact need a build: `vitest.setup.ts` builds `--filter '@savvy-web/silk...' --filter @savvy-web/pnpm-plugin-silk`, and those suites read `dist/prod/npm/pkg` (bins at `bin/*.js`) with `NODE_OPTIONS=--import=<absolute tsx file URL>`, since a built bin in the workspace still imports its siblings from source.

`@savvy-web/changelog` must stay a root devDependency (the changesets engine resolves the changelog id from the repo root); the root's only other workspace devDependency is `@savvy-web/silk`, the carrier of the bins — `@savvy-web/cli` and `@savvy-web/mcp` are NOT root devDependencies. Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts`.

→ `@./okf/decisions/kit-package-build.md` — why the kit build replaced the in-repo bundler and the per-package `prepare` model.
→ `@./okf/conventions/workspace-source-links.md` — the ongoing rule to follow.
Load when editing any `package.json` scripts or devDependencies, `effected.toml`, `turbo.json`, `pnpm-workspace.yaml`, or debugging a bin or script that fails to load a sibling's TypeScript source.

## Ecosystem Context

This repo is the hub of the Silk Suite ecosystem: 33 repositories in 7 layers (Foundation Libraries → Package Management → Build Systems → Developer Experience → CI/CD Pipeline → AI/Agent Tooling → Documentation & Templates).

- `@savvy-web/pnpm-plugin-silk` provides the version catalogs every repo consumes
- The GitHub Actions consume `@effected/github-actions` (and the kit) directly; savvy-specific action logic routes through `@savvy-web/silk-effects`. `@savvy-web/github-action-effects` is DELETED — any reference to it is stale
- `.github-private` houses org-level reusable workflows

## Conventions

- Source `package.json` `"private": true` is transformed by builders based on `publishConfig.access`.
- Catalogs are purpose-scoped: `catalog:build`, `catalog:docs`, `catalog:lint`, `catalog:silk`, `catalog:test`, each with a `<name>:peers` companion for peer ranges (the camelCase `<name>Peers` spelling is GONE). `effect`, `@effect/*` and `@effected/*` come from `catalog:effected` (peers: `catalog:effected:peers`), supplied by `@effected/pnpm-plugin-effected`. The build chain and toolchain (tsdown, rolldown, api-extractor, tsdoc, typescript, `@types/node`, tsx, react and its types, …) come from `catalog:effected:build` (peers: `catalog:effected:build:peers`), from the same plugin; silk's `catalog:build` keeps only `@tsdown/css` and `@types/bun`, and no Silk catalog — `docs` and `silk` included — carries a toolchain member.
→ `@./okf/conventions/purpose-scoped-catalogs.md`
Load when adding a dependency or deciding which catalog it belongs to.
- Verify any Effect API against the vendored `.repos/effect` source or the installed release, never v3 memory. Vendored WORKTREES are OS-level read-only (`Repos.ReposLockdown`) and local git config declares them off-limits (`submodule.<path>.update = none`); the submodule gitdir stays writable on purpose so ordinary git and GUI clients keep working. An `EACCES` there means route the change through `savvy repos` / the `repos_manage` MCP tool — never `chmod` the tree back by hand. A `git checkout` inside a vendored tree is NOT blocked, so drift is detected, not prevented: `savvy repos status --drift` reports it, `savvy repos restore` repairs it.
- All Effect code uses class-based `Context.Service` services (each exporting a companion `*Shape` interface), `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.
→ `@./okf/conventions/effect-v4-code-style.md`
Load before writing or reviewing any Effect v4 service, schema, or error class.
- README.md is for external users; okf/ is the knowledge bundle.
- The non-import invariant: `@savvy-web/cli`, `@savvy-web/silk`, and `@savvy-web/mcp` must NOT import each other — cli and mcp are L3 peers depending only on `@savvy-web/silk-effects` in-repo. ONE sanctioned exception: silk's `src/bin/savvy.ts` and `src/bin/savvy-mcp.ts` (the carrier shims) import `@savvy-web/cli/main` and `@savvy-web/mcp/main`; nothing else under silk's `src/` may.
→ `@./okf/decisions/carrier-pattern-package-graph.md`
Load when touching the cli/silk/mcp import boundary or the carrier-shim exception.
- All packages version INDEPENDENTLY — `.changeset/config.json` has no `fixed` or `linked` arrays. silk/cli/mcp/changelog are NOT a fixed group, but silk stays exactly pinned to the other three automatically: silk declares them — and `@savvy-web/silk-effects`, a real runtime dependency (nine `src/` files import it) — as source `dependencies` (`workspace:*`), published as EXACT-pinned regular `dependencies`, never promoted to peers (peer publishing made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions). The bins reach consumers through silk's own `bin` map, not hoisting: `@savvy-web/pnpm-plugin-silk` no longer hoists cli/mcp, only `@savvy-web/changelog`, which the changesets engine resolves BY ID from the consumer root. Changesets reads `workspace:*` as the exact current version, so a cli/mcp/changelog release auto-PATCH-bumps silk (`updateInternalDependencies: patch`) and re-pins it; plain `dependencies` (never source peerDependencies) means silk is NOT force-major-bumped. silk has no `versionFiles` and versions no plugin manifest; the plugin source `plugin/` is `@savvy-web/ai-plugins`, which versions independently through its own changesets and `versionFiles`.
→ `@./okf/decisions/independent-package-versioning.md`
→ `@./okf/decisions/silk-pins-siblings-as-dependencies.md`
→ `@./okf/decisions/ai-plugins-versions-independently.md`
Load before changing `.changeset/config.json`, a package's `dependencies`/`peerDependencies`, or `versionFiles`.
- Integration/e2e tests must NOT resolve `catalog:`/`workspace:` against the host workspace — catalog-resolution coverage lives in `e2e/` via subprocess builds against isolated fixtures (`CatalogResolver` reads `process.cwd()`). See `e2e/CLAUDE.md`.
→ `@./okf/conventions/e2e-isolation.md`
Load before writing or reviewing an `e2e/*` test that resolves catalogs or workspace packages.
- Four runtime internal edges are `workspace:^`, published as `^<version>`: changelog/cli/mcp→silk-effects, silk-effects→silk-core. With `updateInternalDependencies: patch` and no `updateInternalDependents: "always"`, changesets bumps a dependent only when the dependency's new version falls OUTSIDE the dependent's range, so a caret edge propagates only on a range-leaving release (any minor of a 0.x package such as silk-core, a major otherwise). silk's exact `workspace:*` pins on cli/mcp/changelog/silk-effects still auto-patch silk on every one of their releases.
- `@savvy-web/pnpm-plugin-silk` versions independently and is npm-registry-only (the one package not also on GitHub Packages).

## Dogfooding `@effected`

A dogfood round consumes the `@effected/*` kit (`spencerbeggs/effected`, sibling checkout at `../../spencerbeggs/effected`) from LOCAL prod artifacts via `pnpm-workspace.yaml` `overrides:` entries of the form `"@effected/<name>": "file:../../..."`. Check that block before assuming a round is open — `overrides:` also carries unrelated pins, so look for `@effected` `file:` entries specifically. **Currently UNLINKED:** there are none, every manifest resolves from the registry, and normal push/PR rules apply.

While `@effected` `file:` overrides are active the branch does NOT push or open PRs — the paths exist only on this machine (the silk plugin's `dogfood-guard` hook denies it). Verify kit signatures against `../../spencerbeggs/effected/packages/<name>/src` or the installed `.d.ts` under `node_modules/@effected/<name>/`, never from relayed summaries.

**The full protocol — linking, mailbox layout and ids, the refresh sequence, the exit:**
→ `@./okf/conventions/effected-dogfood-rounds.md`
Load when opening, running, or closing a dogfood round (its protocol rules and repo-level convention are the pattern).

## Design Documentation

The knowledge bundle lives at `okf/`, an OKF v0.2 bundle — start at `okf/index.md`. It is validated with `pnpm exec okfit validate`. Concepts are written and edited only via the `okfit:okf-docs` agent, never hand-indexed. Per-package pointers live in each `packages/<pkg>/CLAUDE.md`; these cover topics with no package subtree to auto-load from:

**`plugin/` — the silk agent plugin, one pluginfinity source for Claude Code and Copilot (layout, build/test/release, hosts, capability map):**
→ `@./okf/modules/silk-plugin.md`
→ `@./okf/conventions/edit-plugin-source-not-builds.md`
Load when working on `plugin/` (layout, the two builds and `build --check`, the Copilot gaps and both marketplaces, capability map, skill naming, MCP server wiring, hook registration, the changeset router skill, the read-only Turborepo capability over `turbo_inspect`, the it2 pane-orchestration skill, and the dogfood-mailbox capability map). The plugin owns workflow only; builds and TSDoc belong to the effected kit and its own agent plugin — do not re-add a build or tsdoc skill, a TSDoc fixer agent or an `issues.json` monitor here.

Commit/PR message contract split out of the plugin doc:
→ `@./okf/conventions/commit-and-pr-messages.md`
Load before composing a commit message or PR description, or touching the `savvy commit hook` guards.

Biome invocation contract split out of the plugin doc:
→ `@./okf/conventions/biome-invocation.md`
Load before running or scripting Biome (the three channels — LSP, `biome_check`, sanctioned Bash) or touching the `biome-direct-deny` guard.

Vendored-repos enforcement split out of the plugin doc:
→ `@./okf/decisions/vendored-repos-lockdown.md`
→ `@./okf/conventions/vendored-repos-handling.md`
Load when touching the vendored-repos skill, its orientation block, PreToolUse guards, or drift monitor, or making any change to a `.repos/**` tree.

**Suite-wide test conventions (`@effect/vitest`, filesystem doubles):**
→ `@./okf/conventions/effect-vitest-testing.md`
Load before writing or converting any test that runs an Effect or needs a `FileSystem`. Covers `it.effect` vs `it.live` vs suite-boundary `layer(...)` (memoizes, bleeding test-double state — per-test `Effect.provide` is the default), `Effect.flip` for typed failures, the `TestClock`/`TestConsole` swaps, and the `@effected/memfs` rules — `layerWith` volumes over hand-rolled stubs, `layerFaulty` for one failing operation, the per-BUILD volume-sharing trap that makes a write-then-read assertion pass vacuously, and the mode-enforcement carve-out that keeps some blocks on real tmpdirs.
