---
"@savvy-web/silk-effects": minor
---

## Bug Fixes

### npm and GitHub Packages targets opt into provenance by default

`SilkPublishability.detect` now derives `PublishTarget.provenance` from the target registry: `true` for the npm public registry and GitHub Packages, `false` for JSR and custom registries. Previously every resolved target defaulted to `provenance: false`, so a consumer that gates attestation on the flag — such as the release action — never attested a published tarball and left the provenance column of its release summary empty.

The default is registry-derived rather than keyed to the `npm`/`github` target ids, so a custom target key pointed at `registry.npmjs.org` or `npm.pkg.github.com` also opts in.
