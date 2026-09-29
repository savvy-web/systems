---
"@savvy-web/silk": patch
---

## Bug Fixes

### Override Audit Probes With the Repo's Package Manager

The dogfood skill's `override-audit.mjs` now detects the audited repo's package manager (`devEngines.packageManager`, then `packageManager`, then the lockfile, then npm) and probes the registry with that manager's own view command. Previously it always ran `npm view` from inside the repo, which npm 11 rejects with `EBADDEVENGINES` in any repo declaring pnpm in `devEngines`, so every override was reported unverified. Yarn repos probe through npm because `yarn npm info` does not resolve ranges, and npm probes run from outside the repo. When a probe still cannot answer, the unverified line names the detected manager, the commands tried, and the cause (`EBADDEVENGINES`, a missing binary, or a network or registry error).

### Dogfood Doorbell Retries Delivery

The `--send` doorbell now rings the counterpart with `it2 session send-text --retry 3 --retry-delay 2s`. Idle sessions routinely rejected the first attempts, so most mails reached the counterpart only through the filesystem monitor. A doorbell that still fails stays silent.

## Documentation

### Release Probes Use the Repo's Package Manager

The dogfood skill's release-verification guidance now probes each published version with the repo's own package manager (for example `pnpm view "<pkg>@<version>" version`) instead of a bare `npm view` from the repo root.
