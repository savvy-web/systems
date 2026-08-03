---
"@savvy-web/github-action-builder": patch
---

## Documentation

`docs/05-architecture.md` is corrected against `src/layers/app.ts` and `src/services/persist-local.ts`:

* The "Combined application layer" and "Adding a new service" `AppLayer` examples were both missing `PersistLocalLayer`; the real definition merges four layers, not three.
* `PersistLocalService` previously appeared only in the file-structure tree. Added a service section matching the depth of `ConfigService`/`ValidationService`/`BuildService`, plus its `PersistLocalError`/`ActionYmlPathError` entries in the error-categories list.
