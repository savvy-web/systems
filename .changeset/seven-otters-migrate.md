---
"@savvy-web/silk-effects": major
---

## Breaking Changes

Several services, schemas, and errors move out of `@savvy-web/silk-effects` and onto the released `@effected/*` kit. `src/index.ts` no longer re-exports anything from the kit, so each type now has exactly one import path.

### Tag and versioning classification moved to `@effected/workspaces`

`TagStrategy`, `TagStrategyLive`, `TagStrategyShape`, `TagStrategyType`, `VersioningStrategy`, `VersioningStrategyLive`, `VersioningStrategyShape`, `VersioningStrategyResult`, `VersioningStrategyType`, `TagFormatError`, and `VersioningDetectionError` are removed. The equivalent logic now lives in `@effected/workspaces` as pure value classes — `classify` is pure and total, so there is no error channel to catch:

```typescript
import { VersioningStrategy } from "@effected/workspaces";

const strategy = VersioningStrategy.classify({ packages: publishablePackages, fixedGroups });
const tags = strategy.tagsFor([{ name: "@savvy-web/silk-effects", version: "1.0.0" }]);
// => [ReleaseTag { value: "@savvy-web/silk-effects@1.0.0" }]
```

### Tool discovery and command execution moved to `@effected/commands`

`ToolDiscovery`, `ToolDiscoveryLive`, `ToolDiscoveryShape`, the `ToolDefinition`/`ResolvedTool`/`ToolResults` schemas, `ToolNotFoundError`, `ToolResolutionError`, `ToolVersionMismatchError`, and `ToolCommand` are removed in favor of `@effected/commands`'s `ToolDiscovery` service, wired to a workspace with `Workspaces.localExecLayer()`:

```typescript
import { ToolDiscovery } from "@effected/commands";
import { Workspaces } from "@effected/workspaces";

const ToolsLive = ToolDiscovery.layer.pipe(Layer.provide(Workspaces.localExecLayer()));
```

`Turbo.TurboInspectorLive` now requires this kit `ToolDiscovery` in place of the deleted local service.

### Managed section templating moved to `@effected/templates`

`ManagedSection`, `ManagedSectionLive`, `ManagedSectionShape`, the `SectionDefinition`/`SectionBlock`/`SectionResults`/`CommentStyle` schemas, and `SectionParseError`, `SectionValidationError`, `SectionWriteError` are removed. Husky hook sections now render through `@effected/templates`'s `ManagedSection` service:

```typescript
import { ManagedSection } from "@effected/templates";

const ms = yield* ManagedSection;
const results = yield* ms.syncAll(".husky/commit-msg", [
	/* section list */
]);
```

`SavvySections` is rewritten on the kit's `SectionId` type, whose keys are uppercase (`SAVVY-BASE`, `SAVVY-HOOKS`) — marker compatibility with already-installed hook files is preserved.

### Removed with no replacement

The changesets `MarkdownService`, `MarkdownLive`, and `MarkdownShape` are deleted outright — they had zero call sites.

### Layer requirement changes

`SilkWorkspaceAnalyzer`'s layer requirements are reduced to four. A consumer providing its own layer graph for these services should re-check what each service now requires before upgrading.

### Migration

Add `@effected/commands`, `@effected/templates`, and `@effected/workspaces` (already transitive dependencies of this package) to your own manifest if you import them directly, then replace each removed import with its kit equivalent listed above.
