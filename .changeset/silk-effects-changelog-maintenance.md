---
"@savvy-web/silk-effects": minor
---

## Features

### Release lines no longer carry commit-link prefixes

Generated CHANGELOG release lines drop the `` [`abc1234`](.../commit/abc1234) `` prefix that used to lead every entry. Squash-merge workflows collapse a PR into a single squash commit, so per-changeset commit links pointed at the wrong commit and added no useful history — git history is already the reference. Authored links, issue references (`Closes`/`Fixes`/`Refs`), and PR/user attribution are unchanged.

Before:

```markdown
- [`abc1234`](https://github.com/org/repo/commit/abc1234) Fixed the thing
```

After:

```markdown
- Fixed the thing
```

One consequence: identical summaries from separate changesets now genuinely deduplicate. Commit-hash prefixes previously made every rendered line unique, which masked `DeduplicateItemsPlugin` from collapsing duplicate entries across sections.

**Upgrading:** No action required. Regenerating `CHANGELOG.md` with this version drops the prefix on newly rendered entries; previously published entries are unaffected until re-rendered.

## Features

### Maintenance notes for changeset-less releases

Version-only releases forced by `fixed`/`linked` version groups now get a generated `### Maintenance` note instead of shipping an empty version block. The note names the triggering package (e.g. "Released in lockstep with `@scope/pkg@1.2.3` (fixed version group)."), with a generic fallback sentence when the trigger can't be determined.

New public API: `MaintenanceNotePlugin`, `deriveMaintenanceReason`, `MaintenanceReasonSchema`, `MaintenanceTriggerSchema`, the derived `MaintenanceReason`/`MaintenanceTrigger` types, and a `maintenance` option on `ChangelogTransformer`'s `TransformOptions`.

### Dependency tables under their own heading

Dependency update tables are now emitted under their own `### Dependencies` heading instead of surfacing beneath the engine's default `### Patch Changes` wrapper.

## Bug Fixes

- `ChangelogTransformer.transformContent` now runs the full `SilkChangesetTransformPreset`, restoring the `AggregateDependencyTablesPlugin` pass that merges duplicate dependency tables.
