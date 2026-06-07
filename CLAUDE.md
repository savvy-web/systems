# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem by Savvy Web Systems.

## Repository Purpose

- **silk-effects** — shared Effect library; also hosts the dev-tooling business logic under four namespace exports (`Changesets`, `Commitlint`, `Lint`, `Turbo` — the latter a read-only Turborepo inspection namespace, `@since 0.7.0`: `TurboInspector` service + `TurboDigest` pure transforms exposing `diagnoseCache`/`taskGraph`/`affected`, all `--dry`, never executing tasks); dual-format esm+cjs (implemented)
- **cli** — `@savvy-web/cli`, the `savvy` binary with `init`/`check`/`commit`/`changeset`/`lint`/`clean` commands; `savvy init`/`savvy check` are the sole setup/validation entry points (the per-tool init/check subcommands were removed from the changeset/commit/lint groups); replaces the three old per-tool bins; built via `@savvy-web/bundler` (M6) (implemented)
- **silk** — `@savvy-web/silk`, the single install-target of thin config-integration shims plus the biome asset (moved under top-level `public/`); built via `@savvy-web/bundler` (M6), dual-format esm+cjs — it force-bundles `@savvy-web/silk-effects` + its transitive node_modules deps (`bundleNodeModules`), externalizes `semver` (a declared dep — rolldown cannot bundle its circular CJS into ESM without an init-order crash), and externalizes `effect`/`@effect/platform` in the dts only (`dtsExternals`, declared deps — inlining effect's `declare module` augmentations broke consumer typecheck with TS2320) (implemented)
- **mcp** — `@savvy-web/mcp`, the spawnable `savvy-mcp` server exposing the `workspace_info`, `silk_docs_search`, and `turbo_inspect` tools (the last a read-only Turborepo inspector over silk-effects' `Turbo` namespace, returning a discriminated-union result keyed by mode cache|graph|affected) plus a manifest-backed resource layer (`silk://catalog` plus a `silk://{+path}` template over a compiled markdown corpus, including `silk://standards/turbo/*` corpus docs) over silk-effects; Phase B adds per-package API-reference docs (`silk://packages/<pkg>/api/*`) generated from API Extractor models via the external `api-extractor-llms` npm package, body-content search, a related-graph see-also boost, and query logging; a standalone server, not a discovery host; built via `@savvy-web/bundler` (M6) (implemented)
- **plugins/silk** — merged Claude Code plugin (`silk@savvy-web-systems`): 15 skills (including the `turbo` front-door skill + bundled references over `turbo_inspect`), the `changeset-manager` and `turborepo` agents, merged hooks (a `<turbo_capability>` SessionStart orientation block plus a `--dry`-only safe-bash allowlist entry), plus `savvy-mcp` wiring (implemented)
- **plugins/docs** — `docs@savvy-web-systems` plugin holding the `mcp` corpus-documentation agent (authors/improves docs in the savvy MCP corpus), two capability skills (`corpus-authoring`, `corpus-verify`), and two mode commands (`/docs:write-guide`, `/docs:improve`); spawns the shared `savvy-mcp` server; its version maps to `@savvy-web/mcp` (implemented)
- **plugins/github-actions** — Claude Code plugin spawning the shared `savvy-mcp` server, with a TIER-1/2 SessionStart orientation hook and full hook libs that direct agents to the shared savvy MCP; no actions-specific tools/resources yet (future) (implemented)
- **templates** — pure TypeScript project scaffolding (implemented)
- **github-action-builder** — zero-config rsbuild build tool for Node.js 24 GitHub Actions; built via `@savvy-web/bundler` (one of the four migrated leaves), with its asset relocated to top-level `public/` (the bundler has no copyPatterns, only the `public/` convention) (implemented)
- **github-action-effects** — Effect-based library replacing @actions/* with 37 schema-validated services (implemented)
- **tsdown-plugins** — `@savvy-web/tsdown-plugins`, the interface-only tsdown/rolldown plugin pack holding every build behavior (entry detection, manifest transforms + `emitManifest`, `resolveManifest` over `workspaces-effect`'s `CatalogResolver`, the dts tsconfig port, the name-aware `buildTargetGroups`, the Effect output reporter, the `src/meta/` API Extractor meta-generation pipeline — `generateMeta` over `@microsoft/api-extractor` plus multi-entry api-model merge — the `src/targets/` derivation — `resolveTargets`/`writeTargetsBinding` turning `publishConfig.targets` into byte-variant build groups plus the `dist/prod/targets.json` binding — the `src/jsx/` config — `resolveJsxConfig`/`readTsconfigJsx` mapping tsconfig JSX into the dts tsconfig and tsdown `inputOptions.jsx` — and the `src/exe/` SEA support — `normalizeExeOptions` (os/cpu→target inference) plus `runExeBuild`, an interface-only wrapper over tsdown's exe mode); the per-TargetGroup build loop runs two passes — a per-module JS pass plus a bundled `emitDtsOnly` dts pass — so bundled dts is the default: every public entry gets a self-contained `.d.ts` (fixes TS2883 type-portability) while JS stays per-module (M3); the build loop's `format` is configurable (`BuildFormat = "esm" | "cjs"`, default esm-only) and threaded to the tsdown `build()` call, with cjs interop via `cjsDefault`, automatic `.d.cts` declarations, `fixedExtension: false`, and a `dual` flag that makes the manifest transform emit flat `import`/`require` export conditions (M1 dual-format); ships a synced local `ecma.json` tsconfig copy (guarded by a unit test) matching the bundler's published `ecma.json`; `resolveTargets` throws the typed `ConfigValidationError`; authored against rolldown's `Plugin` type only, no tsdown peer; SP1 foundation plus Tracks A (meta), C (multi-target), B (exe), and D (jsx) plus M1 dual-format, M3 bundled dts, and the config-validation layer of the `@savvy-web/bundler` program; now self-hosts (built by its own `savvy.build.ts`); Track E (full publishability) outstanding (implemented)
- **bundler** — `@savvy-web/bundler`, the tsdown-based replacement for `@savvy-web/rslib-builder`: the `defineBuild`/`runBuild` orchestrator and self-executing `savvy.build.ts` contract driving tsdown programmatically over the `tsdown-plugins` helpers; catalog/`workspace:` resolution delegated to `workspaces-effect`'s `CatalogResolver`; `runBuild` runs the `ConfigValidator` Effect service FIRST to fast-fail on bad config across dev/npm/meta/exe; `savvy build --target meta` runs `generateMeta` into configured `localPaths`; `--target npm` derives every prod byte-variant group from `publishConfig.targets` (Track C, via `resolveTargets`), builds each, writes the `dist/prod/targets.json` target→group binding, and emits a `meta/` release-asset bundle (meta decoupled from the prod build); a legacy-array `publishConfig.targets` (the current rslib-builder shape) falls back to the single-`npm` default, so the multi-target path stays dormant until packages migrate to the Record-map form; `savvy build --target exe` SEA-compiles via `runExeBuild` (`@tsdown/exe ^0.22.1` is a runtime dependency, lazily required by tsdown when the exe option runs) (Track B); `defineBuild({ jsx })` overrides tsconfig-inferred JSX threaded into the dts tsconfig and tsdown `inputOptions` (Track D); `defineBuild({ format })` surfaces the `BuildFormat` (re-exported, default esm-only) and forwards it through `buildTargetGroups` for opt-in dual esm+cjs builds with require-able cjs output (M1 dual-format, capability-only until a package opts in); the build emits bundled, self-contained `.d.ts` per public entry by default while keeping JS per-module (M3 two-pass); ships `@savvy-web/bundler/ecma.json`, the shared TS base config (rslib's `tsconfig/ecma/lib.json` replacement) — the four leaves extend it, the bundler extends its own `./public/ecma.json`; `@savvy-web/bundler` and `@savvy-web/tsdown-plugins` self-host (built by their own escape-hatch `savvy.build.ts`) and the other seven packages — the four leaves (`templates`, `github-action-effects`, `silk-effects`, `github-action-builder`) plus `cli`/`mcp`/`silk` — build via the front-door `defineBuild`/`runBuild`; `@savvy-web/rslib-builder` and `@rslib/core` are decommissioned from `systems` (M6); SP1 foundation plus Tracks A, C, B, and D plus M1 dual-format, M2 self-hosting, M3 bundled dts, and config validation; Track E (full publishability) outstanding (implemented)
- Public documentation site (docs/ — placeholder for future RSPress site)
- Cross-repo planning and coordination
- Claude Code plugin marketplace entry point (.claude-plugin/)

## Tech Stack

- **Runtime:** Node.js 24.11.0+
- **Package Manager:** pnpm 11.5.1 with @savvy-web/pnpm-plugin-silk 0.14.5 config dependency
- **Build:** Turborepo orchestration; `@savvy-web/bundler` builds all nine packages (two builder packages self-host via the escape-hatch `savvy.build.ts`, the other seven via the front-door `defineBuild`/`runBuild`); `@savvy-web/rslib-builder` and `@rslib/core` are decommissioned from `systems` (M6)
- **Linting:** Biome, markdownlint
- **Testing:** Vitest via @savvy-web/vitest
- **Commits:** Conventional commits with DCO signoff via @savvy-web/commitlint
- **Releases:** @savvy-web/changesets

## Key Commands

```bash
pnpm build          # Build all packages (dev + prod)
pnpm test           # Run tests
pnpm typecheck      # Type-check all packages
pnpm lint           # Biome check
pnpm lint:fix       # Biome auto-fix
pnpm lint:md        # Markdown lint
```

## Install & Build Orchestration

Install and build are DECOUPLED. There are no per-package `prepare` build scripts; `pnpm install` never builds. Build is an explicit post-install step: `pnpm build` (turbo `build:dev` + `build:prod`).

Required `pnpm-workspace.yaml` settings: `autoInstallPeers: true`, `verifyDepsBeforeRun: false`. The plugin is pinned in `pnpm-workspace.yaml` WITH its `+sha512-...` integrity hash (turbo/reproducibility need it); `pnpm add --config` omits the hash, so add it by hand. Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts`: injection hard-links each package's `dist/dev` at link time, which is absent on a cold cache, so a frozen install aborts with `ENOENT`. Plain `link:` symlinks (publishConfig `directory: dist/dev/pkg` for the nine bundler-built packages, + `linkDirectory: true`) tolerate the not-yet-built dir. `@savvy-web/cli` and `@savvy-web/mcp` are direct root devDependencies so they link to `dist/dev`. Plugin 0.14.5 drops `@savvy-web/cli`/`@savvy-web/mcp` from the in-monorepo hoist pattern and excludes `@typescript/native-preview*` from its `minimumReleaseAge` supply-chain check.

This is one symptom of a build-on-install ordering tension: workspace consumers resolve the BUILT `dist/dev`, which must exist before links, bins, and checks work — but the build needs install to finish first. Known consequences:

- NEVER build inside an install hook (`prepare`/`postprepare`). mcp's `build:dev` pulls the libraries' `build:prod` (api-docs chain), and `build:prod` resolves `catalog:silkPeers` from `node_modules/.pnpm-workspace-state-v1.json`, which pnpm writes only AFTER install scripts. An install-time build fails with `Catalog(s) not found: silkPeers`. Build must run after `pnpm install` completes.
- `savvy` is not on PATH on a cold runner: the `.bin/savvy` shim is created at link time, before `dist/dev` exists, and the decoupled install never recreates it. The release flow's `ci:version` works around this by building cli+silk first and invoking the built bin by path: `node packages/cli/dist/dev/pkg/bin/savvy.js`.
- CI checks that import `@savvy-web/*` packages resolve to `dist/dev` (via `linkDirectory`); a fresh runner is unbuilt, so a post-install `pnpm build:dev` must run before those checks. Handled in the CI workflow, not via an install hook.

Working recipe: cold `pnpm install --frozen-lockfile` succeeds (no build), then `pnpm build` (explicit; `silkPeers` now resolves because the state file exists). CI order must be install → build → checks. The `@savvy-web/bundler` redesign (never build in `prepare`) is the intended fix for this whole class of problems and is now fully realized on the builder axis: all nine packages build via `@savvy-web/bundler` and `@savvy-web/rslib-builder`/`@rslib/core` are gone from `systems` (M6). That collapses the toolchain to one builder and one transitively-pinned `tsdown` — no drifting maintained `@rslib/core` peer to firefight — and the `savvy` bin now resolves at `dist/dev/pkg/bin/savvy.js`. What M6 does NOT change: build is still an explicit post-install step (the decoupling above stands), and the bundler still links each package's built `dist/dev/pkg`, not `src` — so the cold-runner ordering consequences (no `savvy` on PATH before build, CI must run install → build → checks) all remain.

## Design Documentation

Design docs live in `.claude/design/` (tracked):

**silk-effects architecture, service patterns, and consumer guide:**
→ `@./.claude/design/silk-effects/architecture.md`

Load when working on silk-effects, implementing new services, or onboarding consumer repos. Covers role-based folder layout, single root export, all 10 services, value object patterns, the v0.2.0 ManagedSection + ToolDiscovery redesigns, ManagedSection's `syncMany`/`remove` multi-section primitives plus the `SavvySections` shared husky-hook shells (both `@since 0.5.0`), the SilkWorkspaceAnalyzer composite service, and the `Turbo` read-only inspection namespace (`TurboInspector`/`TurboDigest`, `diagnoseCache`/`taskGraph`/`affected`, all `--dry`, `@since 0.7.0`).

**templates architecture, template inventory, and design decisions:**
→ `@./.claude/design/templates/architecture.md`

Load when working on templates, adding new templates, or understanding the pure-function content generation approach. Covers all 10 templates, Effect Schema validation, TemplateEntry abstraction, and workspace compositor.

**github-action-effects services, layers, errors, and integration points:**
→ `@./.claude/design/github-action-effects/index.md`

Load when working on github-action-effects or building GitHub Actions on its Effect services. Indexes the 37 services, layer composition, error/schema definitions, integration points, and testing strategy across six docs.

**github-action-builder architecture and build pipeline:**
→ `@./.claude/design/github-action-builder/architecture.md`

Load when working on github-action-builder or configuring action builds. Covers the zero-config rsbuild pipeline targeting Node.js 24 GitHub Actions.

**@savvy-web/bundler architecture — the tsdown-based rslib-builder replacement, `defineBuild`/`runBuild`, and the `savvy.build.ts` contract:**
→ `@./.claude/design/bundler/architecture.md`

Load when working on `@savvy-web/bundler` or the Silk bundler program. Covers the SP1 foundation, the thin orchestrator over `@savvy-web/tsdown-plugins`, the self-executing `savvy.build.ts` contract, the TargetGroup model and dist layout, the orchestrator→tsdown boundary, catalog resolution delegated to `workspaces-effect`'s `CatalogResolver`, the config-validation gate (`ConfigValidator` run first in `runBuild` to fast-fail across dev/npm/meta/exe), the meta-generation wiring (`--target meta` into `localPaths`, the npm `meta/` release asset, `deriveExportPaths`, the uncached `build:meta` turbo task), the Track C multi-target publishing wiring (`--target npm` derives prod groups from `publishConfig.targets` via `deriveProdGroups`/`resolveTargets`, writes the `dist/prod/targets.json` binding, and the load-bearing legacy-array guard that keeps the path dormant), the Track B exe-compilation wiring (`--target exe` over `runExeBuild`, `@tsdown/exe` as a runtime dep), the Track D JSX wiring (tsconfig-inherited JSX threaded into dts + tsdown `inputOptions`, `defineBuild({ jsx })` override), the M1 dual-format wiring (`defineBuild({ format })` surfacing `BuildFormat`, forwarded through `buildTargetGroups`, default-esm-only, the live `format` vs dead `formats` field, the `fixedExtension: false` finding), the M3 bundled-dts two-pass build (per-module JS + bundled `emitDtsOnly` dts, default-on, TS2883 fix), the shipped `ecma.json` tsconfig preset, the self-hosting bootstrap ladder (tsdown-plugins + bundler self-host, the other seven packages build via the bundler; rslib decommissioned at M6), and the outstanding Track E.

**@savvy-web/tsdown-plugins architecture — the interface-only tsdown/rolldown plugin pack:**
→ `@./.claude/design/tsdown-plugins/architecture.md`

Load when working on `@savvy-web/tsdown-plugins` or the bundler's build behaviors. Covers the interface-only (no tsdown runtime / no peer) boundary, the Effect service and helper map, entry detection, manifest emission + catalog delegation, the declarative pre-transform rename, the dts resolved-tsconfig port, the name-aware two-pass per-TargetGroup build loop (`BuildGroupSpec`, string-valued `TargetGroupId`; per-module JS pass + bundled `emitDtsOnly` dts pass), the output reporter, the `src/meta/` API Extractor meta-generation pipeline (`generateMeta`, multi-entry api-model merge, deterministic tsdoc.json, message suppressor, `MetaGenerationError`), the `src/targets/` derivation (`resolveTargets`/`isTargetObject`/`writeTargetsBinding`, byte-variant groups from `publishConfig.targets`, `from` registry reuse, `resolveTargets` throwing `ConfigValidationError`), the `src/jsx/` config (`JsxConfig`, `resolveJsxConfig` TS→rolldown mapping, `readTsconfigJsx`, threaded into dts + tsdown `inputOptions.jsx`), the `src/exe/` SEA support (`normalizeExeOptions` os/cpu→target inference, `runExeBuild` interface-only over tsdown exe mode), the M1 dual-format support (configurable `BuildFormat` threaded to `build()`, `cjsDefault` interop, `.d.cts` declarations, the `fixedExtension: false` finding, the `dual` manifest-condition thread, `BuildFormat` in the public surface), the M3 bundled-dts two-pass split (default-on, TS2883 fix), the synced local `ecma.json` copy guarded by a unit test, the config-validation layer (`ConfigValidationError`, the `ConfigValidator`/`ConfigValidatorLive` rule set), the self-host status, the Track B/C/D/E status, and the published escape-hatch contract.

**@savvy-web/cli architecture — the `savvy` binary and runtime layer stack:**
→ `@./.claude/design/cli/architecture.md`

Load when working on the `savvy` CLI. Covers the static command tree, the merged runtime layer stack assembled in `src/cli/index.ts`, the runtime-smoke-test layer-completeness gate (vs tsgo), and the cli↔silk non-import invariant.

**@savvy-web/silk architecture — the config-integration shim surface and Biome asset:**
→ `@./.claude/design/silk/architecture.md`

Load when working on `@savvy-web/silk`. Covers the drop-in shim contract, the export map, the dual-format-for-CJS requirement, peerDep wiring, the consumer model, the type-portability invariant (silk-local facades over the `CommitlintConfig`/`Preset` factories so consumer configs emit portable `.d.ts` and avoid TS2883), and the bundler-built dual-format output (M6: `bundleNodeModules`, `semver` externalized, `effect`/`@effect/platform` as `dtsExternals`).

**plugins/silk — the merged Claude Code plugin:**
→ `@./.claude/design/silk/plugin.md`

Load when working on `plugins/silk`. Covers the skill/agent/hook merge, the tool-prefixed-vs-unprefixed skill naming scheme, the hooks repointed at the unified `savvy` bin, and the `turbo` front-door skill + `turborepo` agent + `<turbo_capability>` SessionStart orientation block + `--dry`-only safe-bash allowlist entry wired over `turbo_inspect`.

**plugins/docs — the corpus-documentation Claude Code plugin:**
→ `@./.claude/design/docs/architecture.md`

Load when working on `plugins/docs`. Covers the `mcp` corpus-documentation agent, the `corpus-authoring`/`corpus-verify` capability skills, the `/docs:write-guide` and `/docs:improve` mode commands, the SessionStart orientation hook, and the `savvy-mcp` wiring whose version maps to `@savvy-web/mcp`. (Path may need adjustment if the design-doc agent uses a different filename.)

**@savvy-web/mcp architecture — the `savvy-mcp` server, its runtime layer, tool half, and resource half:**
→ `@./.claude/design/mcp/architecture.md`

Load when working on the MCP host. Covers the standalone (non-discovery) server, the information-in-mcp/direction-in-plugins split, the `ManagedRuntime` over silk-effects, the `workspace_info` tool with its Effect-Schema→zod bridge, the `silk_docs_search` tool over an in-memory Fuse `DocIndex`, the `turbo_inspect` tool (read-only Turborepo inspection over the `Turbo` namespace, mode cache|graph|affected discriminated-union result) plus its `standards/turbo/*` corpus docs, the build-time catalog compiler that emits the tracked `manifest.json` (shape `{ entries }`, a deterministic function of content) from the markdown corpus behind a deep-equality write guard, the `silk://catalog` + `silk://{+path}` resource layer rendered from that manifest, the Phase B generated API-doc tier (`silk://packages/<pkg>/api/*`) driven by the external `api-extractor-llms` npm package whose rendered markdown is tracked source content and ships in the tarball (only the `.api.json` model files under `packages/mcp/lib/models/` stay gitignored), body-content search, see-also boost, query logging, and the three-plugin (`silk`, `github-actions`, `docs`) integration.

**api-extractor-llms — API Extractor model → LLM-markdown rendering library (extracted to a standalone repo):**
→ `@./.claude/design/api-extractor-llms/architecture.md`

Load when working on the mcp API-doc generation pipeline. The renderer now ships as the external unscoped npm package `api-extractor-llms` (its own repo, `spencerbeggs/api-extractor-llms`); mcp consumes it as a build-time devDependency. This doc covers the single output system, the injectable FrontmatterRenderer + RouteFormatter, the extraction/formatter/cross-linker modules, and the boundaries.

## Ecosystem Context

This repo is the hub of the Silk Suite ecosystem spanning 33 repositories. The ecosystem is organized
into 7 layers: Foundation Libraries (Effect-based) → Package Management → Build Systems → Developer
Experience → CI/CD Pipeline → AI/Agent Tooling → Documentation & Templates.

Key coordination points:

- `@savvy-web/pnpm-plugin-silk` provides version catalogs consumed by all repos
- `@savvy-web/github-action-effects` provides Effect services for all GitHub Actions
- `github-readme-private` (.github-private) houses org-level reusable workflows
- Rebrand from "Workflow" to "Silk Suite" complete

## Conventions

- Source package.json `"private": true` is transformed by builders based on publishConfig.access
- Use `catalog:silk` for pinned dependencies, `catalog:silkPeers` for peer dependency ranges
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`
- README.md is for external users; .claude/design/ for package architecture docs
- `@savvy-web/cli` and `@savvy-web/silk` must NOT import each other (the cli↔silk non-import invariant); `@savvy-web/mcp` imports neither cli nor silk — all three depend only on silk-effects within the repo (the cli↔silk↔mcp non-import invariant) — see `@./.claude/design/cli/architecture.md` and `@./.claude/design/mcp/architecture.md`; mcp depends on the external unscoped npm package `api-extractor-llms` as a build-time devDependency for its API-doc pipeline; that build chain runs via turbo: the four migrated leaf targets' `build:meta` (which writes the api-model into `meta.localPaths`, decoupled from `build:prod`) → mcp `generate:api-docs` (using `api-extractor-llms`, `dependsOn` the four leaves' `#build:meta`) → `build:catalog` → mcp `build`
- `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp` are a `fixed` changeset group (versioned and released together); silk ships dual-format esm+cjs for its CJS consumers; silk's changeset config carries the `versionFiles` glob that bumps the `plugins/*` plugin manifests in lockstep with the group's version
- `@savvy-web/bundler` and `@savvy-web/tsdown-plugins` version independently (changesets auto-bumps the bundler when tsdown-plugins changes; not a fixed group); both SELF-HOST — built by their own escape-hatch `savvy.build.ts` (M2) — and the other seven packages (the four leaves `templates`/`github-action-effects`/`silk-effects`/`github-action-builder` plus `cli`/`mcp`/`silk`) build via the bundler's front-door `defineBuild`/`runBuild`; `@savvy-web/rslib-builder` and `@rslib/core` are decommissioned from `systems` (M6), and Track E (full publishability) is still outstanding; the bundler ships `@savvy-web/bundler/ecma.json` (the shared TS base config replacing rslib's `tsconfig/ecma/lib.json` — leaves extend it, the bundler extends its own `./public/ecma.json`, tsdown-plugins keeps a synced local copy guarded by a unit test); `tsdown-plugins` is authored against rolldown's `Plugin` type only (no tsdown peer), delegates catalog/`workspace:` resolution to `workspaces-effect@^1.2.0`'s `CatalogResolver`, owns all API Extractor meta generation (`generateMeta` over `@microsoft/api-extractor`/`@microsoft/tsdoc`), owns the `publishConfig.targets` derivation (`resolveTargets`/`writeTargetsBinding`, throwing the typed `ConfigValidationError`), owns the JSX config (`src/jsx/`, tsconfig-inherited and threaded into dts + tsdown `inputOptions.jsx`), and owns SEA exe support (`src/exe/`, `normalizeExeOptions`/`runExeBuild` interface-only over tsdown's exe mode); the bundler's `runBuild` runs the `ConfigValidator` Effect service first to fast-fail across dev/npm/meta/exe; meta is decoupled from the prod build — `--target meta` writes the api-model into `localPaths` (uncached `build:meta` turbo task, `dependsOn: build:dev`) while `--target npm` emits a `meta/` release asset; Track C makes multi-target publishing declarative — `--target npm` derives byte-variant prod groups from the Record-map `publishConfig.targets` and writes `dist/prod/targets.json`, but a legacy-array `publishConfig.targets` (still used by every current in-repo package) falls back to the single-`npm` default, keeping the new path dormant until migration; Track B adds `--target exe` (SEA compile via `@tsdown/exe ^0.22.1`, a runtime dependency of bundler) and Track D adds tsconfig-inherited JSX with the `defineBuild({ jsx })` override; M1 adds the dual esm+cjs capability — `tsdown-plugins` threads a configurable `BuildFormat` (default esm-only) through the build loop with `cjsDefault` interop, `.d.cts`, and dual `import`/`require` manifest conditions, surfaced via the bundler's `defineBuild({ format })`, capability-only until a package opts in; M3 makes bundled dts the default via a two-pass per-TargetGroup build (per-module JS pass + bundled `emitDtsOnly` dts pass) so every public entry ships a self-contained `.d.ts` (fixes TS2883) while JS stays per-module; M4-M6 add five capabilities used to migrate the last three packages — `bundleNodeModules` (force-bundle JS deps for a self-contained runtime, rslib parity), a dts pass that mirrors the JS bundling posture, `dtsExternals` (externalize deps in the dts pass only), a `cjs-default-interop` rolldown plugin (`module.exports = default` for dual-format CJS entries, rslib `cjsInterop` parity), and a flat-manifest-from-shared-`createEntryName` derivation with an entry-name collision guard; `@savvy-web/silk` exercises these (force-bundles silk-effects + transitive deps via `bundleNodeModules`, externalizes `effect`/`@effect/platform` in the dts via `dtsExternals` + declares them + `semver` as runtime deps) — see `@./.claude/design/bundler/architecture.md` and `@./.claude/design/tsdown-plugins/architecture.md`
