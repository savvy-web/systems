---
"@savvy-web/cli": minor
---

## Features

### `savvy repos` command group

Adds a `savvy repos` command group for managing vendored reference repos under `.repos/`:

```bash
savvy repos status [--json]
savvy repos sync
savvy repos pin <name> <ref>
savvy repos add <url> --ref <ref> --purpose <text> [--name <name>] [--sparse <path>...]
savvy repos note <name> add <text>
savvy repos note <name> remove <id>
savvy repos note <name> promote <id> --into layout|startHere
```

- `status` prints a drift report (gitlink vs. manifest ref, dirty and unsynced submodules); `--json` emits the structured report.
- `sync` reconciles the working tree with the manifest, self-healing stale submodule locks.
- `pin` and `add` stage their changes (manifest, gitlink, `.gitmodules`) and print a ready-made commit message rather than committing on the caller's behalf — review and commit is a separate, deliberate step.
- `add` requires `--purpose`, documenting why the repo is vendored.

A missing `.repos/config.json` is treated as the common, friendly case — a plain message (or an empty JSON report) and exit code 0. A manifest that exists but is corrupt or unreadable is a real failure and exits 1.
