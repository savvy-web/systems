---
"@savvy-web/changelog": patch
---

## Maintenance

* Reads `VITEST`/`GITHUB_ACTIONS` itself and builds the changelog functions via `Changesets.makeChangelogFunctions({ logMode })`, now that `@savvy-web/silk-effects` no longer sniffs the environment. Behaviour under the changesets CLI is unchanged: `::warning::` annotations in GitHub Actions, silence under vitest, stderr otherwise.
