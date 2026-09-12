# @savvy-web/silk-effects

Shared Effect library for the Silk Suite — the L2 engine both front ends (`cli`, `mcp`) and `silk` run. Single root export (`.`), dual-format ESM+CJS, exporting six namespaces — `Changesets`, `Commitlint`, `Lint`, `PrBody`, `Turbo`, `Repos` — plus standalone services (`SilkWorkspaceAnalyzer`, `SilkPublishability`, `SavvySections`), schemas, and tagged errors. Depends on `@savvy-web/silk-core` (L1: platform-free schemas, errors, the `PrBody` contract) and re-exports all of it under the same names, so consumers see one surface; a new schema goes in silk-core unless it needs a platform service. Every namespace has its own design doc below; load it before changing that namespace.

## Rules

Each one has been broken by an agent before.

- **The kit owns its mechanisms — do NOT re-add them here.** `VersioningStrategy`/`TagStyle`/`ReleaseTag` → `@effected/workspaces`; `ToolDiscovery`/`Tool`/`Run` → `@effected/commands` (set env with `Run.extendEnv`, never bare `setEnv`); `ManagedSection`/`Section`/`CommentStyle` → `@effected/templates`; the issue-reference grammar → `@effected/github-references`. Never re-hand-roll a closing-keyword or `#N` pattern. Read the architecture doc's migration table before hunting a service a stale note mentions (`PointInTimeWorkspace` is now `WorkspaceSnapshots`; `ClosingReferences.BARE_LINE_PATTERN` is gone — call `parseBare`).
- **The engine boundary: no `process` reads in shared code.** A `process` read here bakes one host's environment into the other front end. `__test__/boundaries.test.ts` walks `src/` with silk-core's tokenizer scanner (`../silk-core/__test__/utils/boundaries.ts` — imported, never copied) and fails on any file touching the `process` identifier in code. NO per-file allowlist. The ONLY carve-out is two top-level directories skipped BY NAME — `lint/` and `commitlint/` — because they are host adapters: entry points invoked by lint-staged, markdownlint-cli2 and commitlint, foreign host processes that supply no context. Everything else is engine: `ConfigDiscovery`/`BiomeSchemaSync` take a required `cwd` (no `process.cwd()` default), the changesets logger reads its mode from the `Changesets.ChangesetLogMode` reference (default `"stderr"`; `@savvy-web/changelog` supplies `"silent"`/`"github"` from ITS `process.env` via `Changesets.makeChangelogFunctions`). `@changesets/get-github-info` reads `GITHUB_TOKEN`/`GITHUB_SERVER_URL`/`.env` internally — a known gap, not an allowlist entry.
- **`src/index.ts` re-exports NOTHING from the kit**: consumers import `@effected/*` directly, so no type gets two import paths.
- **Effect patterns:** class-based `Context.Service` (each with a companion `*Shape` interface), `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`. Result types are Effect `Schema` as the single source of truth, with derived interfaces.
- **Map membership is `Object.hasOwn`**, never a bare bracket read — `Repos`' `getRepoEntry` and `ReleasePlanner`'s `changelogModules` exist so a key named `"constructor"` fails typed instead of reading an inherited function.
- **`PrBody.Markers` is FROZEN.** The `silk-release:` token names the contract, not the emitting action; never parameterize or rename it. `PrBody` now lives in silk-core (re-exported here); its byte-parity fixture and the `skill-sync` drift-lint live under `packages/silk-core/__test__/`. `LinkedIssueRef.isClosed` is the only sanctioned closedness test.
- **`Repos` invariants (load `repos.md` before touching any of them):** the lock covers the WORKTREE only, never the submodule gitdir; `walkRoot` is asymmetric on purpose (`unlock` still walks the gitdir, `lock` never re-locks it) and that asymmetry IS the migration — do not "fix" it. `sync` and `add` both write `submodule.<path>.update = none` + `fetch.recurseSubmodules = false` into LOCAL config, never `.gitmodules`; never set `active = false`. The permissions are the boundary; the plugin's guards are early-warning UX in front of them. The invariant is "drift is detected and one command from repaired", not "the pin cannot drift". Reports state what was ACHIEVED (`boundaryMarked`, `stillDirty`, `removedEntry`), not attempted.
- **`VersionFiles` has two error postures on purpose** — `processVersionFiles` dies (legacy defect parity), `processResolvedVersionFiles` fails typed for `ReleasePlanner.apply` — do not re-unify them. Edits are format-preserving jsonc `modify`+`applyEdits`; never a `JSON.parse`/`JSON.stringify` round-trip.
- **`DepsRegen`** needs a spawn-capable platform layer (`NodeServices.layer`), never filesystem-only — `WorkspaceSnapshots` reads git history. A pure dependency changeset is deleted ONLY when in scope AND rewritten this run AND authored on this branch.
- **`Lint` handlers have TWO entry points** — lint-staged `create()` and `savvy lint fmt <name>` — so any formatting step is a public static both call, and options must be serialized onto the `fmt` command line (`encodeFormatOptions`/`parseFormatOptions`). Prettier and `yaml-lint` are gone; YAML runs on `@effected/yaml`.
- **`Commitlint`:** check `config/factory.ts` before claiming a rule is enforced (`silk/body-prose-only` exists but is not enabled, so dash bullets are legal). `silk/body-no-markdown` detects bold via `**text**` only. `VERBOSITY_LINE_THRESHOLD`/`VERBOSITY_WORD_THRESHOLD` (12/150) encode the squash-merge brevity the `commit-create` skill teaches — move the two together. `closes-trailer` is strictly whole-line, deliberately.
- **Changelog rendering:** release lines carry NO commit-link prefixes (do not re-add), emit decisions key on mdast node TYPE never string prefixes, and attribution never lands in a table cell or heading.
- **`Turbo` is read-only:** every call is `--dry`; never executes a task.
- **Tests:** the `ReposLockdown` blocks and `services__config-store.test.ts`'s `it.live` lock tests stay on real tmpdirs (memfs records mode bits without enforcing them) — do not "finish the migration". Test-only helpers are exported from their own module, deliberately NOT from the index — do not "tidy" them in. Unit tests of moved code live in silk-core beside their subjects.

## Design

Overview — export surface, the layered graph and silk-core extraction, what the kit owns (migration table), service patterns, testing strategy:
→ `@../../.claude/design/silk-effects/architecture.md`
Load when implementing a new service, changing a result schema, moving code to silk-core, or deciding `it.effect` vs `it.live`.

Load before changing any `@effected/*` dependency in this package's manifest, or when a consumer reports a duplicate kit copy:
→ `@../../.claude/design/silk-effects/kit-peer-dependencies.md`
Why `@effected/workspaces`, `@effected/git` and `@effected/commands` are REQUIRED PEERS, the two-copies type-identity failure, and the `configDependencies` bump trap.

Subsystem docs — load the one for the namespace you are touching:
→ `@../../.claude/design/silk-effects/workspace-analysis.md` — `SilkWorkspaceAnalyzer`, `SilkPublishability`/`readTargetsBinding`, changeset-config accessors.
→ `@../../.claude/design/silk-effects/hook-sections.md` — `SavvySections` shared husky hook content, render/reconcile engine, the uppercase `SectionId` marker-compat guard.
→ `@../../.claude/design/silk-effects/changesets.md` — `ConfigInspector` attribution precedence, `ChangesetLinter` (CSH001–CSH005), `ReleasePlanner`, `DepsRegen` gating, `VersionFiles`, changelog rendering.
→ `@../../.claude/design/silk-effects/commitlint.md` — config factory, the `silk/*` rule menu, DCO/scope detection, the `savvy commit hook` logic.
→ `@../../.claude/design/silk-effects/lint.md` — per-file-kind handlers, the two-entry-point contract, `Preset`/`createConfig`, `@effected/yaml` formatting.
→ `@../../.claude/design/silk-effects/issue-references.md` — why issue-reference parsing is `@effected/github-references` and never re-hand-rolled; `closes-trailer` semantics.
→ `@../../.claude/design/silk-effects/turbo.md` — `TurboInspector` + `TurboDigest` (`diagnoseCache`/`taskGraph`/`affected`).
→ `@../../.claude/design/silk-effects/repos.md` — all four `Repos` services, the lifecycle operations, `withUnlocked`, five-authority drift reconciliation, `ReposLockdown`.
→ `@../../.claude/design/silk-effects/pr-body.md` — the `PrBody` managed PR-description contract: `Markers`, `Region`, `ManagedPrBody`, `ClosingReferences` (two spellings, neither consumer accepts the other's).
