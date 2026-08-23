---
"@savvy-web/silk-effects": minor
---

## Features

### Rendered thanks section for contributors

Changelog rendering now emits a `### Thanks` section at the end of each version block, aggregating contributor attributions instead of smushing them inline. A new `thanks` option controls it:

```typescript
import { Changesets } from "@savvy-web/silk-effects";

const options: Changesets.ChangesetOptions = {
  repo: "owner/repo",
  thanks: false, // strip attribution entirely; PR links are kept either way
};
```

`thanks` defaults to `true` and is plumbed through `.changeset/config.json`'s changelog options, `ChangelogTransformer`, and `ReleasePlanner`.

### Unified CSH005 dependency-section validation (#456, #457)

The remark-lint rule and the markdownlint rule now share one dependency-section scanner. Prose written before or after a `## Dependencies` table is now accepted by both engines — previously markdownlint alone flagged it. Missing-table diagnostics now anchor at the `## Dependencies` heading in both engines. Rule docs (`CSH001`–`CSH005`) moved in-repo under `packages/silk-effects/docs/rules/`, replacing links to the archived `savvy-web/changesets` repo.

### Cross-seeded catalog resolution in dependency diffs (#539)

`Changesets.DepsRegen`'s dependency diff now seeds each side of the diff with the other side's catalog declarations at lower precedence, via `@effected/workspaces`' `WorkspaceStateSnapshot.crossSeed`. Config-dependency-injected catalogs (e.g. `catalog:effected`) now resolve to their declared ranges instead of falling through to concrete lockfile versions, eliminating false `^` → exact rows in generated dependency tables. The service graph now composes `Workspaces.layerWithGitAndConfigDependenciesSubprocess`, so subprocess-replayed config-dependency catalog hooks work in bundled hosts (like `savvy-mcp`) that can't rely on an in-process dynamic `import()`.

### `runtime` and `packageManager` dependency-table types (#544)

The dependency-table `Type` vocabulary gains `runtime` (language runtime bumps, e.g. node) and `packageManager` (the package manager's self-upgrade, e.g. pnpm). Both validate through CSH005 in both lint engines, survive table aggregation, and are classified release-neutral — the same bucket as `devDependency`.

### `coexisting` bucket on dependency regeneration (#279)

`Changesets.DepsRegen.plan`/`execute` results now include a `coexisting` list: prose-only changesets that reference an in-scope package but aren't touched by the regeneration pass. A new `Changesets.parseChangesetPackages` helper extracts the package names declared in a changeset's frontmatter.

### Better unmapped-file attribution (#290, #487)

`Changesets.ConfigInspector` now returns a machine-readable hint on files it can't attribute to a package — for example, a path that used to match a since-deleted `versionFiles`/`additionalScopes` entry, or a known template-mirror path. Discovered package paths are also re-rooted onto the per-call project directory, so inspection now works correctly from git worktrees, not just the primary checkout.

### Vanilla changelog renderer re-export (#413)

`Changesets.vanillaChangelogFunctions` re-exports `@changesets/changelog-git` unmodified, for consumers (like `silk-release-action`) that need stock changesets rendering — plain summary lines, no sections, no attribution, no dependency tables — without declaring the dependency themselves.

```typescript
import { Changesets } from "@savvy-web/silk-effects";

const line = await Changesets.vanillaChangelogFunctions.getReleaseLine(
  { id: "x", summary: "Fix a thing", releases: [{ name: "pkg", type: "patch" }] },
  "patch",
  null,
);
```

### Canonical markdown emission via `@effected/markdown`

Changelog rendering now emits through `@effected/markdown`'s canonical stringifier (a documented stability commitment) instead of `remark-stringify`. Rendered output shifts accordingly: `-` bullets, compact table cells, and canonically escaped cell text (`\~`, `\_` — values round-trip unchanged through parsing). Language-less code fences stay fenced via an explicit emit policy.

## Bug Fixes

* Changelog rendering is now AST-native: `### Sub-headings` inside a changeset render as `#### Sub-headings` in the CHANGELOG instead of being demoted to bullets, and tables, code fences, and blockquotes pass through as blocks instead of getting bullet-wrapped
* Contributor attribution no longer lands inside a table cell, fixing duplicated or bulleted dependency tables in released notes
* `aggregate-dependency-tables` now unwraps legacy bullet-wrapped dependency tables and merges authored and synthesized tables into a single table per version, preserving surrounding non-table bullets in place
* Attribution lands on the deepest trailing bullet of a nested list, and list items emptied by attribution stripping no longer leave bare bullets behind
* All five CSH rules recognize setext headings in the markdownlint engine (parity with remark), and changeset classification ignores `## Dependencies` headings quoted inside fenced code blocks
* Harvesting an existing `### Thanks` section whose body is itself attribution-shaped no longer deletes the following sibling section
* `ConfigInspector.refreshIn` on a child directory now also clears the cached parent workspace root, matching its documented contract
