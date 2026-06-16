---
"@savvy-web/github-action-effects": minor
---

## Features

### Custom step icon and a `Step.line` display primitive

`Step.withStep` accepts an `icon` option so a step's success summary renders with a domain glyph (e.g. `📦`) in place of the default `✅`; the failure path still renders `❌`. A new `Step.line(icon, text)` primitive emits a standalone display row indented beneath the current step or group — for informational rows such as a provenance or SBOM URL that are not themselves pass/fail steps.

### `publishTarball` surfaces npm's native provenance URL

`PackagePublish.publishTarball` now resolves to a `PublishTarballResult` carrying the optional `provenanceUrl` — npm's trusted-publishing transparency-log entry, lifted from the publish output when a tarball publishes to the npm public registry with provenance. The publish runs through `execCapture` so the output is both streamed live and captured. Callers that ignore the result are unaffected.
