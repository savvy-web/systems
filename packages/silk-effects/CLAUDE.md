# @savvy-web/silk-effects

Shared Effect library for the Silk Suite, and the home of the dev-tooling business logic consumed by `cli`, `mcp`, and `silk`. Single root export, dual-format ESM+CJS.

## Key surface

- One entry point (`.`) exporting four namespaces — `Changesets`, `Commitlint`, `Lint`, `Turbo` — plus standalone services, schemas, and tagged errors.
- `Turbo` is a read-only Turborepo inspection namespace: `TurboInspector` service + `TurboDigest` pure transforms (`diagnoseCache`/`taskGraph`/`affected`), all `--dry`, never executes tasks.
- `Changesets` includes `ConfigInspector`, `BranchAnalyzer`, `ChangesetLinter`, `ReleasePlanner` (`plan`/`preview`/`apply` over the genuine `@changesets` engine; `apply` does native version bumping, dry-run-aware), and `DepsRegen` (`plan`/`execute` split owning dependency-changeset orchestration; snapshots both diff sides via `workspaces-effect`'s `PointInTimeWorkspace`, resolving `catalog:`/`workspace:` per ref BEFORE diffing so equal-resolved rows are suppressed, and drops `devDependency` rows). Gating is "versionable minus ignored" — a package is in scope when `publishable OR privatePackages.version` AND not on the changeset ignore list (ignore wins over `--package`). File I/O runs through `@effect/platform` `FileSystem` (`ChangesetIOError`). `DepsRegenLive` requires `PointInTimeWorkspace | WorkspaceDiscovery | PublishabilityDetector | ChangesetConfig | ConfigInspector | FileSystem`; `DepsRegenDefault` is the batteries-included layer supplying silk's opinionated defaults (needs only a `CommandExecutor`-capable platform layer).
- `ChangesetLinter.validateContent` now enforces the dependency-table format (CSH005) via the remark `DependencyTableFormatRule`; prose `## Dependencies` sections are rejected.
- Changelog rendering: release lines carry NO commit-link prefixes (git history is the reference — do not re-add them), dependency tables emit their own `### Dependencies` heading, and changeset-less releases (fixed/linked co-bumps) render a `### Maintenance` note via `deriveMaintenanceReason` + `MaintenanceNotePlugin` (parameterized per version block by `ReleasePlanner`, deliberately not a preset member). `ChangelogTransformer` runs the full `SilkChangesetTransformPreset`.
- `Commitlint`'s `silk/body-no-markdown` rule detects bold via the asterisk form only (`**text**`), so `__SNAKE_CASE__` identifiers are not flagged.
- `SilkPublishability.detect(pkgName, raw, binding)` resolves publish targets from the bundler's `dist/prod/targets.json` binding (Record-map `publishConfig.targets` form); public API `readTargetsBinding` + types `TargetsBinding`/`TargetBinding`/`TargetGroupBinding`.
- `SilkWorkspaceAnalyzer` is the composite workspace service; `ManagedSection` drives the shared husky-hook shells.
- Result types are Effect `Schema` as the single source of truth, with derived interfaces.
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.

## Design

Load for service patterns, value-object conventions, layer composition, and the full service inventory:
→ `@../../.claude/design/silk-effects/architecture.md`
Load when implementing a new service, changing a result schema, or onboarding a consumer repo.
