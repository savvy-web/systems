---
"@savvy-web/cli": major
---

## Breaking Changes

### `runCli` removed from the barrel; process entry moves to `@savvy-web/cli/main`

Importing `@savvy-web/cli` is now side-effect free. The assembled root command and its runtime are no longer reachable through `runCli` on the package root — the process-owning entry point lives at the new `./main` subpath.

```ts
// before
import { runCli } from "@savvy-web/cli";

// after
import { main } from "@savvy-web/cli/main";
main();
```

`main(): void` runs the `savvy` root command over `NodeRuntime.runMain` with the full runtime layer stack. The command groups and their named handlers (`changesetCommand`, `commitCommand`, `lintCommand`, `reposCommand`, `runCheck`, …) remain on the barrel unchanged.

The `savvy` bin is unaffected for end users — it is the same command surface, now also shipped by `@savvy-web/silk` as a shim over `@savvy-web/cli/main`. The `./package.json` subpath is now exported.
