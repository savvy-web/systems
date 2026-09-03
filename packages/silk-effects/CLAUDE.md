# @savvy-web/silk-effects

Shared Effect library for the Silk Suite, and the home of the dev-tooling business logic consumed by `cli`, `mcp`, and `silk`. Single root export (`.`), dual-format ESM+CJS, exporting six namespaces — `Changesets`, `Commitlint`, `Lint`, `PrBody`, `Turbo`, `Repos` — plus standalone services (`SilkWorkspaceAnalyzer`, `SilkPublishability`, `SavvySections`), schemas, and tagged errors. Every namespace has its own design doc below; load it before changing that namespace.

## Rules

Verified against the code; each one has been broken by an agent before.

- **The kit owns its mechanisms — do NOT re-add them here.** `VersioningStrategy`/`TagStyle`/`ReleaseTag` → `@effected/workspaces`; `ToolDiscovery`/`Tool`/`Run` → `@effected/commands` (set env with `Run.extendEnv`, never bare `setEnv`); `ManagedSection`/`Section`/`CommentStyle` → `@effected/templates`; the GitHub issue-reference grammar → `@effected/github-references`. Never re-hand-roll a closing-keyword or `#N` pattern. Read the architecture doc's migration table before hunting a service a stale note mentions (`PointInTimeWorkspace` is now `WorkspaceSnapshots`; `ClosingReferences.BARE_LINE_PATTERN` is gone — call `parseBare`).
- **`src/index.ts` re-exports NOTHING from the kit**: consumers import `@effected/*` directly, so one type never gets two import paths.
- **Effect patterns:** class-based `Context.Service` (each with a companion `*Shape` interface), `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`. Result types are Effect `Schema` as the single source of truth, with derived interfaces.
- **Map membership is `Object.hasOwn`**, never a bare bracket read or `map[id] === undefined` — `Repos`' `getRepoEntry` and `ReleasePlanner`'s `changelogModules` both exist so a key named `"constructor"` fails typed instead of reading an inherited function.
- **`PrBody.Markers` is FROZEN.** The `silk-release:` token names the contract, not the emitting action; never parameterize or rename it. Byte-parity with `silk-release-action` is pinned by `__test__/fixtures/pr-body/expected.json`, and `__test__/pr-body/skill-sync.test.ts` drift-lints the plugin skills against the literals. `LinkedIssueRef.isClosed` is the only sanctioned closedness test.
- **`Repos` invariants (load `repos.md` before touching any of them):** the lock covers the WORKTREE only, never the submodule gitdir; `walkRoot` is asymmetric on purpose (`unlock` still walks the gitdir, `lock` never re-locks it) and that asymmetry IS the migration — do not "fix" it. `sync` and `add` both write `submodule.<path>.update = none` + `fetch.recurseSubmodules = false` into LOCAL config, never `.gitmodules`; never set `active = false`. The permissions are the boundary; the silk plugin's guards are early-warning UX in front of them. The invariant is "drift is detected and one command from repaired", not "the pin cannot drift". Reports state what was ACHIEVED (`boundaryMarked`, `stillDirty`, `removedEntry`), not attempted.
- **`VersionFiles` has two error postures on purpose** — `processVersionFiles` dies (legacy defect parity), `processResolvedVersionFiles` fails typed for `ReleasePlanner.apply` — do not re-unify them. Edits are format-preserving jsonc `modify`+`applyEdits`; never reintroduce a `JSON.parse`/`JSON.stringify` round-trip.
- **`DepsRegen`** needs a spawn-capable platform layer (`NodeServices.layer`), never filesystem-only — `WorkspaceSnapshots` reads git history. A pure dependency changeset is deleted ONLY when in scope AND rewritten this run AND authored on this branch.
- **`Lint` handlers have TWO entry points** — lint-staged `create()` and `savvy lint fmt <name>` — so any formatting step is a public static both call, and options must be serialized onto the `fmt` command line (`encodeFormatOptions`/`parseFormatOptions`). Prettier and `yaml-lint` are no longer dependencies; YAML runs on `@effected/yaml`.
- **`Commitlint`:** check `config/factory.ts` before claiming a rule is enforced (`silk/body-prose-only` exists but is not enabled, so dash bullets are legal). `silk/body-no-markdown` detects bold via `**text**` only, so `__SNAKE_CASE__` is not flagged. `VERBOSITY_LINE_THRESHOLD`/`VERBOSITY_WORD_THRESHOLD` (12/150) encode the squash-merge brevity the `commit-create` skill teaches — move the two together. `closes-trailer` is strictly whole-line; a keyword mid-prose does not satisfy it, deliberately.
- **Changelog rendering:** release lines carry NO commit-link prefixes (do not re-add), emit decisions are made on mdast node TYPE never string prefixes, and attribution never lands in a table cell or heading.
- **`Turbo` is read-only:** every call is `--dry`; it never executes a task.
- **Tests:** the `ReposLockdown` blocks and `services__config-store.test.ts`'s `it.live` lock tests stay on real tmpdirs (memfs records mode bits without enforcing them) — do not "finish the migration". Test-only helpers are exported from their own module and deliberately NOT from the index — do not "tidy" them in.

## Design

Overview — export surface, what the kit owns (migration table), service patterns, consumer guide, testing strategy:
→ `@../../.claude/design/silk-effects/architecture.md`
Load when implementing a new service, changing a result schema, onboarding a consumer repo, or deciding `it.effect` vs `it.live`.

Load before changing any `@effected/*` dependency in this package's manifest, or when a consumer reports a duplicate kit copy:
→ `@../../.claude/design/silk-effects/kit-peer-dependencies.md`
Why `@effected/workspaces`, `@effected/git` and `@effected/commands` are REQUIRED PEERS (`catalog:effected:peers`), the two-copies type-identity failure, and the `configDependencies` bump trap.

Subsystem docs — load the one matching the namespace you are touching:
→ `@../../.claude/design/silk-effects/workspace-analysis.md` — `SilkWorkspaceAnalyzer`, `SilkPublishability`/`readTargetsBinding`, changeset-config accessors (`src/services/`, `src/schemas/`).
→ `@../../.claude/design/silk-effects/hook-sections.md` — `SavvySections` shared husky hook content, its render/reconcile engine, the uppercase `SectionId` marker-compat guard.
→ `@../../.claude/design/silk-effects/changesets.md` — `ConfigInspector` attribution precedence, `ChangesetLinter` (CSH001–CSH005), `ReleasePlanner`, `DepsRegen` gating and catalog cross-seeding, `VersionFiles`, changelog rendering.
→ `@../../.claude/design/silk-effects/commitlint.md` — config factory, the `silk/*` rule menu, DCO/scope detection, the `savvy commit hook` logic.
→ `@../../.claude/design/silk-effects/lint.md` — per-file-kind handlers, the two-entry-point contract, `Preset`/`createConfig`, `@effected/yaml` formatting.
→ `@../../.claude/design/silk-effects/issue-references.md` — why issue-reference parsing is `@effected/github-references` and never re-hand-rolled; `closes-trailer` semantics.
→ `@../../.claude/design/silk-effects/turbo.md` — `TurboInspector` + `TurboDigest` (`diagnoseCache`/`taskGraph`/`affected`).
→ `@../../.claude/design/silk-effects/repos.md` — all four `Repos` services, lifecycle operations (`sync`/`add`/`pin`/`remove`/`rename`/`restore`/`deregister`), `withUnlocked`, five-authority drift reconciliation, `ReposLockdown`.
→ `@../../.claude/design/silk-effects/pr-body.md` — the `PrBody` managed PR-description contract: `Markers`, `Region`, `ManagedPrBody`, `ClosingReferences` (two spellings, neither consumer accepts the other's), `PrBodyDiagnostic`.
