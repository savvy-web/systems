---
"@savvy-web/bundler": minor
---

## Features

### Issues artifact written on every build

`runBuild` now writes `dist/<target>/issues.json` at the end of every dev and prod build. The file contains all warnings, errors, and suppressed diagnostics from the build in a stable, de-duplicated JSON format.

```ts
// No config change required — the artifact is written automatically.
await runBuild(config, options);
// → dist/dev/issues.json and dist/prod/issues.json are created alongside the bundle.
```

A new injectable `writeIssues` option on `RunOptions` lets tests or custom pipelines swap the writer without touching the filesystem:

```ts
await runBuild(config, {
  writeIssues: ({ cwd, target, reports }) => {
    // custom writer — return the path written
    return myWriter(cwd, target, reports);
  },
});
```
