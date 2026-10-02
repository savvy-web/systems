---
"@savvy-web/silk-effects": minor
"@savvy-web/cli": minor
---

## Features

`Changesets.DepsRegen.execute` and `Changesets.ReleasePlanner.apply` accept an optional `onStep` callback that reports each completed write as it lands, so a caller can show partial progress when a run fails partway.

```ts
yield* regen.execute(plan, {
  onStep: (step) => Effect.logInfo(`${step._tag} ${step.file}`),
})
```

- `execute` reports `RegenStep.Written` after each changeset write and `RegenStep.Deleted` after each successful stale-changeset delete.
- `apply` reports `ApplyStep.EngineApplied` once versions, CHANGELOGs and changeset deletions are done, then `ApplyStep.VersionFilesUpdated` when any version file changed. A dry run reports nothing.
- New exported types: `RegenStep`, `DepsRegenExecuteOptions`, `ApplyStep`, `ApplyOptions`, `AppliedReleaseEntry`, `VersionFileUpdateRecord`. Callers that pass no `onStep` are unchanged.

`savvy changeset deps regen` and `savvy changeset version` now print each completed step as it happens. `deps regen` lists each written and deleted changeset on its own line and ends with `Wrote N fresh and deleted M pure dependency changeset(s)`. `--json` and `--dry-run` output are unchanged.
