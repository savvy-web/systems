---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Issues artifact

Three new exports — `flattenIssues`, `serializeIssues`, and `writeIssuesArtifact` — write an aggregated `dist/<target>/issues.json` file at the end of every dev/prod build. The artifact collects all warnings, errors, and suppressed diagnostics from the full build report in a stable, de-duplicated JSON format that downstream tooling (agents, CI scripts) can read without parsing terminal output.

```ts
import { writeIssuesArtifact } from "@savvy-web/tsdown-plugins";

// Called automatically by runBuild; also available directly for custom pipelines.
const outPath = writeIssuesArtifact({ cwd, target: "prod", reports });
// → "path/to/dist/prod/issues.json"
```

The JSON shape written to disk:

```json
{
  "generatedAt": "2026-06-21T00:00:00.000Z",
  "package": "@savvy-web/my-package",
  "target": "prod",
  "warnings": [{ "source": "api-extractor", "level": "warn", "text": "...", "code": "ae-missing-release-tag" }],
  "errors": [],
  "suppressed": []
}
```

Two supporting types are also exported: `BuildIssues` (the artifact schema) and `PlainDiagnostic` (a single flattened diagnostic entry).
